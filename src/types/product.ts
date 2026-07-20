export interface Product {
  id: string
  name: string
  description: string | null
  sku: string
  price: number
  category: string | null
  created_at: string
  updated_at: string
}

export type ProductInsert = Omit<Product, 'id' | 'created_at' | 'updated_at'>
export type ProductUpdate = Partial<ProductInsert>
