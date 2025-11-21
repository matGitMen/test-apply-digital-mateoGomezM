export interface ProductSys {
  id: string;
  type: string;
  createdAt: string;
  updatedAt: string;
  locale: string;
}

export interface ProductFields {
  sku: number;
  name: string;
  brand: string;
  model: string;
  category: string;
  color: string;
  price: number;
  currency: string;
  stock: number;
}

export interface ProductItem {
  metadata: {
    tags: any[];
    concepts: any[];
  };
  sys: ProductSys;
  fields: ProductFields;
}

export interface ProductResponse {
  sys: { type: string };
  total: number;
  skip: number;
  limit: number;
  items: ProductItem[];
}