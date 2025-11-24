import { ProductEntity } from '@entity/products/entity/product.entity';
import { Repository } from 'typeorm';

export interface IReportStrategy {
  generate(repo: Repository<ProductEntity>, params?: any): Promise<any>;
}

export class DeletedProductsReport implements IReportStrategy {
  async generate(repo: Repository<ProductEntity>): Promise<any> {

    const totalCount = await repo
      .createQueryBuilder('product')
      .withDeleted()
      .getCount();


    const deletedCount = await repo
      .createQueryBuilder('product')
      .withDeleted()
      .where('product.deletedAt IS NOT NULL')
      .getCount();

    return {
      total: totalCount,
      deleted: deletedCount,
      percentage: totalCount === 0 ? 0 : Math.round((deletedCount / totalCount) * 100),
    };
  }
}

export class NonDeletedProductsReport implements IReportStrategy {
  async generate(repo: Repository<ProductEntity>, params?: { withPrice?: boolean;
    startDate?: Date; endDate?: Date }): Promise<any> {
    const qb = repo.createQueryBuilder('product');

    if (params?.withPrice !== undefined) {
        if (params.withPrice) {
             qb.andWhere('product.price IS NOT NULL');
        } else {
             qb.andWhere('product.price IS NULL');
        }
    }

    if (params?.startDate && params?.endDate) {
      qb.andWhere('product.createdAt BETWEEN :startDate AND :endDate', {
        startDate: params.startDate,
        endDate: params.endDate,
      });
    }

    const count = await qb.getCount();
    const totalNonDeleted = await repo.count();

    return {
      count,
      percentage: totalNonDeleted === 0 ? 0 : (count / totalNonDeleted) * 100,
    };
  }
}

export class ProductsByCategoryReport implements IReportStrategy {
  async generate(repo: Repository<ProductEntity>): Promise<any> {
    const result = await repo
      .createQueryBuilder('product')
      .select('product.category', 'category')
      .addSelect('COUNT(product.id)', 'count')
      .where('product.deletedAt IS NULL')
      .groupBy('product.category')
      .getRawMany();

    const total = await repo.count();

    return result.map((item) => ({
      category: item.category,
      count: parseInt(item.count, 10),
      percentage: total === 0 ? 0 : (parseInt(item.count, 10) / total) * 100,
    }));
  }
}
