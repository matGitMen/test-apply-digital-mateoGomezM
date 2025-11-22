//generate a controller file for a rest api endpoint to get all products
import { Controller, Get, Query, Delete, Param, ParseIntPipe, Post } from '@nestjs/common';
import { ProductService } from '@providers/products/provider/product.service';
import { PaginationDto, FilterProductDto } from '@providers/products/dto/product.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';

@ApiTags('products')
@Controller('products')
export class GetProductController {
  constructor(private readonly productService: ProductService) {}

  @Post('sync')
  @ApiOperation({ summary: 'Sync products from Contentful' })
  @ApiResponse({ status: 201, description: 'Products synced successfully.' })
  async syncProducts() {
    return this.productService.fetchFromContentful();
  }

  @Get()
  @ApiOperation({ summary: 'Get all products' })
  @ApiResponse({ status: 200, description: 'Return all products.' })
  async getAllProducts(
    @Query() paginationDto: PaginationDto,
    @Query() filterDto: FilterProductDto,
  ) {
    return this.productService.findAll(paginationDto, filterDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a product' })
  @ApiResponse({ status: 200, description: 'Product deleted successfully.' })
  @ApiParam({ name: 'id', type: 'string', description: 'Product UUID', example: '7e35aa47-0dc6-42d1-a158-4703987e1ce7' })
  async deleteProduct(@Param('id') id: string) {
    return this.productService.softDelete(id);
  }
}
