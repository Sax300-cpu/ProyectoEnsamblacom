export interface InventoryItem {
  id: string
  product_id: string
  quantity: number
  min_stock: number
  location: string | null
  created_at: string
  updated_at: string
}

export interface InventoryMovement {
  id: string
  product_id: string
  type: 'in' | 'out' | 'adjustment'
  quantity: number
  reference: string | null
  created_at: string
}

export type InventoryItemInsert = Omit<InventoryItem, 'id' | 'created_at' | 'updated_at'>
