import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductEntity } from '@entity/products/entity/product.entity';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import {
  IProductService,
  PaginatedResult,
} from '@providers/products/interfaces/product.interface';
import {
  FilterProductDto,
  PaginationDto,
} from '@providers/products/dto/product.dto';
import { ContentfulAdapter } from '@providers/products/adapters/contentful.adapter';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

@Injectable()
export class ProductService implements IProductService {
  private readonly logger = new Logger(ProductService.name);

  constructor(
    @InjectRepository(ProductEntity)
    private readonly productRepository: Repository<ProductEntity>,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async findAll(
    paginationDto: PaginationDto,
    filterDto: FilterProductDto,
  ): Promise<PaginatedResult<ProductEntity>> {
    const { page = 1, limit = 5 } = paginationDto;
    const { name, category, minPrice, maxPrice } = filterDto;

    const cacheKey = `products_${page}_${limit}_${JSON.stringify(filterDto)}`;
    const cachedData =
      await this.cacheManager.get<PaginatedResult<ProductEntity>>(cacheKey);

    if (cachedData) {
      this.logger.log(`Returning cached data for key: ${cacheKey}`);
      return cachedData;
    }

    const queryBuilder = this.productRepository.createQueryBuilder('product');

    queryBuilder.where('product.deletedAt IS NULL');

    if (name) {
      queryBuilder.andWhere('product.name ILIKE :name', { name: `%${name}%` });
    }

    if (category) {
      queryBuilder.andWhere('product.category = :category', { category });
    }

    if (minPrice !== undefined) {
      queryBuilder.andWhere('product.price >= :minPrice', { minPrice });
    }

    if (maxPrice !== undefined) {
      queryBuilder.andWhere('product.price <= :maxPrice', { maxPrice });
    }

    queryBuilder.skip((page - 1) * limit).take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();

    const result = {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };

    await this.cacheManager.set(cacheKey, result, 3600000);
    return result;
  }

  async softDelete(id: string): Promise<void> {
    await this.productRepository.softDelete(id);
    await this.invalidateCache();
  }

  private async invalidateCache(): Promise<void> {
    try {
      this.logger.log('Invalidating cache...');

      const store = (this.cacheManager as any).store;

      // cache-manager-redis-yet exposes the client
      if (store && store.client) {
        const keys = await store.client.keys('products_*');

        this.logger.log(
          `Found ${keys.length} cache keys to invalidate: ${keys.join(', ')}`,
        );

        if (keys.length > 0) {
          const promises = keys.map(async (key: string) => {
            try {
              await this.cacheManager.del(key);
            } catch (e) {
              this.logger.error(`Failed to delete key ${key}`, e);
            }
          });

          await Promise.all(promises);

          this.logger.log(`Invalidated ${keys.length} cache entries`);
        }
      } else {
        this.logger.warn(
          'Cache store does not support "keys" method. Cannot invalidate specific keys.',
        );

        if (typeof (this.cacheManager as any).clear === 'function') {
          this.logger.log('Using cacheManager.clear() as fallback');

          await (this.cacheManager as any).clear();
        } else if (typeof (this.cacheManager as any).reset === 'function') {
          this.logger.log('Using cacheManager.reset() as fallback');

          await (this.cacheManager as any).reset();
        } else {
          this.logger.error('No clear/reset method found on cache manager');
        }
      }
    } catch (error) {
      this.logger.warn('Failed to invalidate cache', error);
    }
  }

  async fetchFromContentful(): Promise<void> {
    this.logger.log('Fetching products from Contentful...');
    const space = this.configService.get<string>('CONTENTFUL_SPACE_ID');
    const env = this.configService.get<string>('CONTENTFUL_ENVIRONMENT');
    const token = this.configService.get<string>('CONTENTFUL_ACCESS_TOKEN');
    const type = this.configService.get<string>('CONTENTFUL_CONTENT_TYPE');

    const url = `https://cdn.contentful.com/spaces/${space}/environments/${env}/entries?access_token=${token}&content_type=${type}`;

    try {
      const response = await firstValueFrom(this.httpService.get(url));

      const items = response.data.items;

      for (const item of items) {
        const productEntity = ContentfulAdapter.toProductEntity(item);

        const existingProduct = await this.productRepository.findOne({
          where: { contentfulId: productEntity.contentfulId },
          withDeleted: true,
        });

        if (existingProduct) {
          await this.productRepository.update(
            existingProduct.id,
            productEntity,
          );
        } else {
          await this.productRepository.save(productEntity);
        }
      }

      this.logger.log(
        `Successfully fetched and updated ${items.length} products.`,
      );
      await this.invalidateCache();
    } catch (error) {
      this.logger.error('Error fetching from Contentful', error);
    }
  }
}
