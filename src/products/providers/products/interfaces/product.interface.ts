import { ProductEntity } from '@entity/products/entity/product.entity';
import {
  FilterProductDto,
  PaginationDto,
} from '@providers/products/dto/product.dto';

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface IProductService {
  findAll(
    paginationDto: PaginationDto,
    filterDto: FilterProductDto,
  ): Promise<PaginatedResult<ProductEntity>>;
  softDelete(id: string): Promise<void>;
  fetchFromContentful(): Promise<void>;
}
