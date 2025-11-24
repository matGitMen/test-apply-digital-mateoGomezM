import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportsController } from '@reports/controllers/reports.controller';
import { ProductEntity } from '@entity/products/entity/product.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ProductEntity])],
  controllers: [ReportsController],
})
export class ReportsModule {}
