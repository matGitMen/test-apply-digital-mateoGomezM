import { Controller, Get, UseGuards, Query } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductEntity } from '@entity/products/entity/product.entity';
import { DeletedProductsReport, NonDeletedProductsReport, ProductsByCategoryReport } from '@reports/strategies/report.strategy';
import { AuthGuard } from '@common/guards/auth.guard';

@Controller('reports')
@UseGuards(AuthGuard)
export class ReportsController {
  constructor(
    @InjectRepository(ProductEntity)
    private readonly productRepository: Repository<ProductEntity>,
  ) {}

  @Get('deleted-percentage')
  async getDeletedPercentage() {
    const strategy = new DeletedProductsReport();
    return strategy.generate(this.productRepository);
  }

  @Get('non-deleted-percentage')
  async getNonDeletedPercentage(@Query('withPrice') withPrice?: string, @Query('startDate') startDate?: string, @Query('endDate') endDate?: string) {
    const strategy = new NonDeletedProductsReport();
    const params: any = {};

    if (withPrice !== undefined) {
        params.withPrice = withPrice === 'true';
    }
    if (startDate && endDate) {
        params.startDate = new Date(startDate);
        params.endDate = new Date(endDate);
    }

    return strategy.generate(this.productRepository, params);
  }

  @Get('products-by-category')
  async getProductsByCategory() {
    const strategy = new ProductsByCategoryReport();
    return strategy.generate(this.productRepository);
  }
}
