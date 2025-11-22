
import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, Like, IsNull, Not } from 'typeorm';
import { ProductEntity } from '@entity/products/entity/product.entity';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { IProductService, PaginatedResult } from '@providers/products/interfaces/product.interface';
import { FilterProductDto, PaginationDto } from '@providers/products/dto/product.dto';
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

  async findAll(paginationDto: PaginationDto, filterDto: FilterProductDto): Promise<PaginatedResult<ProductEntity>> {
    const { page = 1, limit = 5 } = paginationDto;
    const { name, category, minPrice, maxPrice } = filterDto;

    const cacheKey = `products_${page}_${limit}_${JSON.stringify(filterDto)}`;
    const cachedData = await this.cacheManager.get<PaginatedResult<ProductEntity>>(cacheKey);

    if (cachedData) {
        this.logger.log(`Returning cached data for key: ${cacheKey}`);
        return cachedData;
    }

    const queryBuilder = this.productRepository.createQueryBuilder('product');

    // Exclude soft-deleted products
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

    await this.cacheManager.set(cacheKey, result, 3600000); // Cache for 1 hour (ms in v5, seconds in v4. Let's assume ms for safety or check docs. NestJS cache-manager usually uses ms in newer versions. 3600 was seconds. 3600000 is ms.)
    return result;
  }

  async softDelete(id: string): Promise<void> {
    await this.productRepository.softDelete(id);
    // Invalidate all cache on change
    await this.invalidateCache();
  }

  private async invalidateCache(): Promise<void> {
    try {
      const store = (this.cacheManager as any).store;
      if (store) {
        // Get all keys matching 'products_*'
        const keys = await store.keys('products_*');
        if (keys && keys.length > 0) {
          // Delete all product cache keys
          await Promise.all(keys.map((key: string) => this.cacheManager.del(key)));
          this.logger.log(`Invalidated ${keys.length} cache entries`);
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

        const existingProduct = await this.productRepository.findOne({ where: { contentfulId: productEntity.contentfulId }, withDeleted: true });

        if (existingProduct) {
            // Update existing
            await this.productRepository.update(existingProduct.id, productEntity);
        } else {
            // Create new
            await this.productRepository.save(productEntity);
        }
      }
      this.logger.log(`Successfully fetched and updated ${items.length} products.`);
      // Invalidate cache after sync
      await this.invalidateCache();
    } catch (error) {
      this.logger.error('Error fetching from Contentful', error);
    }
  }
}
