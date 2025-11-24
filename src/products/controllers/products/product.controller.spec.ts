import { Test, TestingModule } from '@nestjs/testing';
import { GetProductController } from './product.controller';
import { ProductService } from '@providers/products/provider/product.service';

const mockProductService = {
  findAll: jest.fn(),
  softDelete: jest.fn(),
  fetchFromContentful: jest.fn(),
};

describe('GetProductController', () => {
  let controller: GetProductController;
  let productService: ProductService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GetProductController],
      providers: [
        { provide: ProductService, useValue: mockProductService },
      ],
    }).compile();

    controller = module.get<GetProductController>(GetProductController);
    productService = module.get<ProductService>(ProductService);


    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getAllProducts', () => {
    it('should call productService.findAll with correct parameters', async () => {
      const paginationDto = { page: 1, limit: 5 };
      const filterDto = { category: 'Electronics' };
      const expectedResult = {
        data: [],
        total: 0,
        page: 1,
        limit: 5,
        totalPages: 0,
      };

      mockProductService.findAll.mockResolvedValue(expectedResult);

      const result = await controller.getAllProducts(paginationDto, filterDto);

      expect(mockProductService.findAll).toHaveBeenCalledWith(paginationDto, filterDto);
      expect(result).toEqual(expectedResult);
    });

    it('should handle pagination with default values', async () => {
      const paginationDto = {};
      const filterDto = {};

      await controller.getAllProducts(paginationDto, filterDto);

      expect(mockProductService.findAll).toHaveBeenCalledWith(paginationDto, filterDto);
    });

    it('should apply multiple filters', async () => {
      const paginationDto = { page: 2, limit: 10 };
      const filterDto = {
        name: 'Product',
        category: 'Tools',
        minPrice: 10,
        maxPrice: 100,
      };

      await controller.getAllProducts(paginationDto, filterDto);

      expect(mockProductService.findAll).toHaveBeenCalledWith(paginationDto, filterDto);
    });
  });

  describe('deleteProduct', () => {
    it('should call productService.softDelete with UUID', async () => {
      const testUuid = '7e35aa47-0dc6-42d1-a158-4703987e1ce7';

      await controller.deleteProduct(testUuid);

      expect(mockProductService.softDelete).toHaveBeenCalledWith(testUuid);
    });

    it('should handle different UUID formats', async () => {
      const testUuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

      await controller.deleteProduct(testUuid);

      expect(mockProductService.softDelete).toHaveBeenCalledWith(testUuid);
    });

    it('should return result from softDelete', async () => {
      const testUuid = 'test-uuid';
      const expectedResult = { success: true };
      mockProductService.softDelete.mockResolvedValue(expectedResult);

      const result = await controller.deleteProduct(testUuid);

      expect(result).toEqual(expectedResult);
    });
  });

  describe('syncProducts', () => {
    it('should call productService.fetchFromContentful', async () => {
      await controller.syncProducts();

      expect(mockProductService.fetchFromContentful).toHaveBeenCalled();
    });

    it('should return result from fetchFromContentful', async () => {
      const expectedResult = { synced: 10 };
      mockProductService.fetchFromContentful.mockResolvedValue(expectedResult);

      const result = await controller.syncProducts();

      expect(result).toEqual(expectedResult);
    });

    it('should handle sync errors gracefully', async () => {
      const error = new Error('Sync failed');
      mockProductService.fetchFromContentful.mockRejectedValue(error);

      await expect(controller.syncProducts()).rejects.toThrow('Sync failed');
    });
  });
});
