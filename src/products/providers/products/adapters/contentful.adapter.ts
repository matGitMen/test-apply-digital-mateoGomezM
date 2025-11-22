import { ProductEntity } from '@entity/products/entity/product.entity';

export class ContentfulAdapter {
  static toProductEntity(item: any): ProductEntity {
    const product = new ProductEntity();
    product.contentfulId = item.sys.id;
    product.sku = item.fields.sku;
    product.name = item.fields.name;
    product.brand = item.fields.brand;
    product.model = item.fields.model;
    product.category = item.fields.category;
    product.color = item.fields.color;
    product.price = item.fields.price;
    product.currency = item.fields.currency;
    product.stock = item.fields.stock;
    product.createdAt = new Date(item.sys.createdAt);
    return product;
  }
}
