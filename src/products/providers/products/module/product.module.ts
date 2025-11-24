import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ProductEntity } from '@entity/products/entity/product.entity';
import { ProductService } from '@providers/products/provider/product.service';
import { GetProductController } from '@controllers/products/product.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProductEntity]),
    HttpModule,
    ConfigModule,
  ],
  controllers: [GetProductController],
  providers: [ProductService],
  exports: [ProductService],
})
export class ProductModule {}
