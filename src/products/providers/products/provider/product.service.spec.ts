import { Test, TestingModule } from '@nestjs/testing';
import { ProductService } from './product.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ProductEntity } from '@entity/products/entity/product.entity';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Repository } from 'typeorm';
import { of } from 'rxjs';

const mockQueryBuilder = {
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
  getCount: jest.fn().mockResolvedValue(0),
  withDeleted: jest.fn().mockReturnThis(),
};

const mockProductRepository = () => ({
  createQueryBuilder: jest.fn(() => mockQueryBuilder),
  findOne: jest.fn(),
  save: jest.fn(),
  softDelete: jest.fn(),
  update: jest.fn(),
  count: jest.fn().mockResolvedValue(0),
});

const mockHttpService = {
  get: jest.fn(),
};

const mockConfigService = {
  get: jest.fn((key: string) => {
    const config = {
      CONTENTFUL_SPACE_ID: 'test-space',
      CONTENTFUL_ENVIRONMENT: 'master',
      CONTENTFUL_ACCESS_TOKEN: 'test-token',
      CONTENTFUL_CONTENT_TYPE: 'product',
    };
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return config[key];
  }),
};

const mockCacheManager = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn().mockResolvedValue(undefined),
  reset: jest.fn(),
  store: {
    keys: jest.fn().mockResolvedValue([]),
    del: jest.fn(),
    reset: jest.fn().mockResolvedValue(undefined),
  },
};

describe('ProductService', () => {
  let service: ProductService;
  let repository: Repository<ProductEntity>;
  let httpService: HttpService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductService,
        {
          provide: getRepositoryToken(ProductEntity),
          useFactory: mockProductRepository,
        },
        { provide: HttpService, useValue: mockHttpService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: CACHE_MANAGER, useValue: mockCacheManager },
      ],
    }).compile();

    service = module.get<ProductService>(ProductService);
    repository = module.get<Repository<ProductEntity>>(
      getRepositoryToken(ProductEntity),
    );
    httpService = module.get<HttpService>(HttpService);

    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return cached data if available', async () => {
      const cachedResult = {
        data: [],
        total: 0,
        page: 1,
        limit: 5,
        totalPages: 0,
      };
      mockCacheManager.get.mockResolvedValue(cachedResult);

      const result = await service.findAll({ page: 1, limit: 5 }, {});

      expect(result).toEqual(cachedResult);
      expect(mockCacheManager.get).toHaveBeenCalled();
      expect(repository.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('should fetch from db and cache if not in cache', async () => {
      mockCacheManager.get.mockResolvedValue(null);

      const result = await service.findAll({ page: 1, limit: 5 }, {});

      expect(repository.createQueryBuilder).toHaveBeenCalled();
      expect(mockCacheManager.set).toHaveBeenCalled();
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('page');
      expect(result).toHaveProperty('limit');
      expect(result).toHaveProperty('totalPages');
    });

    it('should apply name filter when provided', async () => {
      mockCacheManager.get.mockResolvedValue(null);

      await service.findAll({ page: 1, limit: 5 }, { name: 'Test Product' });

      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'product.deletedAt IS NULL',
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'product.name ILIKE :name',
        { name: '%Test Product%' },
      );
    });

    it('should apply category filter when provided', async () => {
      mockCacheManager.get.mockResolvedValue(null);

      await service.findAll({ page: 1, limit: 5 }, { category: 'Electronics' });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'product.category = :category',
        { category: 'Electronics' },
      );
    });

    it('should apply price range filters when provided', async () => {
      mockCacheManager.get.mockResolvedValue(null);

      await service.findAll(
        { page: 1, limit: 5 },
        { minPrice: 10, maxPrice: 100 },
      );

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'product.price >= :minPrice',
        { minPrice: 10 },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'product.price <= :maxPrice',
        { maxPrice: 100 },
      );
    });

    it('should calculate correct pagination values', async () => {
      mockCacheManager.get.mockResolvedValue(null);
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 25]);

      const result = await service.findAll({ page: 2, limit: 10 }, {});

      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(10);
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(10);
      expect(result.totalPages).toBe(3);
    });
  });

  describe('softDelete', () => {
    it('should soft delete a product with UUID', async () => {
      const testUuid = '7e35aa47-0dc6-42d1-a158-4703987e1ce7';

      await service.softDelete(testUuid);

      expect(repository.softDelete).toHaveBeenCalledWith(testUuid);
    });

    it('should invalidate cache after soft delete', async () => {
      const testUuid = 'test-uuid-123';
      mockCacheManager.store.keys.mockResolvedValue(['products_1_5_{}']);

      await service.softDelete(testUuid);

      expect(mockCacheManager.store.keys).toHaveBeenCalledWith('products_*');
      expect(mockCacheManager.del).toHaveBeenCalled();
    });
  });

  describe('fetchFromContentful', () => {
    it('should fetch and save products from Contentful', async () => {
      const mockContentfulResponse = {
        data: {
          items: [
            {
              sys: { id: 'contentful-1', createdAt: '2024-01-01T00:00:00Z' },
              fields: {
                sku: 12345,
                name: 'Test Product',
                brand: 'Test Brand',
                model: 'Model X',
                category: 'Electronics',
                color: 'Black',
                price: 99.99,
                currency: 'USD',
                stock: 10,
              },
            },
          ],
        },
      };

      mockHttpService.get.mockReturnValue(of(mockContentfulResponse));
      (repository.findOne as jest.Mock).mockResolvedValue(null);

      await service.fetchFromContentful();

      expect(httpService.get).toHaveBeenCalled();
      expect(repository.save).toHaveBeenCalled();
    });

    it('should update existing products from Contentful', async () => {
      const mockContentfulResponse = {
        data: {
          items: [
            {
              sys: { id: 'contentful-1', createdAt: '2024-01-01T00:00:00Z' },
              fields: {
                sku: 12345,
                name: 'Updated Product',
                brand: 'Test Brand',
                model: 'Model X',
                category: 'Electronics',
                color: 'Black',
                price: 99.99,
                currency: 'USD',
                stock: 10,
              },
            },
          ],
        },
      };

      const existingProduct = {
        id: 'existing-uuid',
        contentfulId: 'contentful-1',
      };
      mockHttpService.get.mockReturnValue(of(mockContentfulResponse));
      (repository.findOne as jest.Mock).mockResolvedValue(existingProduct);

      await service.fetchFromContentful();

      expect(repository.update).toHaveBeenCalled();

      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should invalidate cache after Contentful sync', async () => {
      const mockContentfulResponse = {
        data: { items: [] },
      };

      mockHttpService.get.mockReturnValue(of(mockContentfulResponse));
      mockCacheManager.store.keys.mockResolvedValue(['products_1_5_{}']);

      await service.fetchFromContentful();

      expect(mockCacheManager.store.keys).toHaveBeenCalledWith('products_*');
    });
  });
});
