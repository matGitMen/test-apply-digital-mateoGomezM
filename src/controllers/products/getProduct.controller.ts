//generate a controller file for a rest api endpoint to get all products
import { Controller, Get } from '@nestjs/common';
import { ProductService } from '@providers/product.provider';
import { ProductResponse } from '@common/models/product.model';

@Controller('products')
export class GetProductController {
  constructor(private readonly productService: ProductService) {}
    @Get()
    async getAllProducts(): Promise<ProductResponse[]> {
        return this.productService.getAllProducts();
    }
}



