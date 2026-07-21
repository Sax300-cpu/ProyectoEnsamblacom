import { createContext, useContext, useState, useMemo, useCallback, type ReactNode } from 'react'

export interface CartItem {
  id_repuesto: number
  cantidad: number
  precio: number
  precio_tecnico: number
  precio_cliente: number
  tipo_precio: 'tecnico' | 'cliente'
  descripcion: string
  categoria: string
  modelo_nombre: string
  stock_disponible: number
}

interface CartContextType {
  items: CartItem[]
  addToCart: (item: CartItem) => void
  removeFromCart: (id_repuesto: number) => void
  updateQuantity: (id_repuesto: number, cantidad: number) => void
  updatePrecio: (id_repuesto: number, precio: number, tipo: 'tecnico' | 'cliente') => void
  clearCart: () => void
  total: number
  itemCount: number
  isOpen: boolean
  openCart: () => void
  closeCart: () => void
  enviando: boolean
  setEnviando: (v: boolean) => void
  refreshKey: number
  transactionSuccess: () => void
}

const CartContext = createContext<CartContextType | null>(null)

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  const transactionSuccess = useCallback(() => {
    setRefreshKey((k) => k + 1)
  }, [])

  const addToCart = (item: CartItem) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.id_repuesto === item.id_repuesto)
      if (existing) {
        const nuevaCant = Math.min(existing.cantidad + item.cantidad, item.stock_disponible)
        return prev.map((i) =>
          i.id_repuesto === item.id_repuesto
            ? { ...i, cantidad: nuevaCant }
            : i,
        )
      }
      return [...prev, { ...item, cantidad: Math.min(item.cantidad, item.stock_disponible) }]
    })
    setIsOpen(true)
  }

  const removeFromCart = (id_repuesto: number) => {
    setItems((prev) => prev.filter((i) => i.id_repuesto !== id_repuesto))
  }

  const updateQuantity = (id_repuesto: number, cantidad: number) => {
    if (cantidad < 1) return
    setItems((prev) =>
      prev.map((i) => {
        if (i.id_repuesto !== id_repuesto) return i
        return { ...i, cantidad: Math.min(cantidad, i.stock_disponible) }
      }),
    )
  }

  const updatePrecio = (id_repuesto: number, _precio: number, tipo: 'tecnico' | 'cliente') => {
    setItems((prev) =>
      prev.map((i) =>
        i.id_repuesto === id_repuesto
          ? { ...i, precio: tipo === 'tecnico' ? i.precio_tecnico : i.precio_cliente, tipo_precio: tipo }
          : i,
      ),
    )
  }

  const clearCart = () => {
    setItems([])
    setIsOpen(false)
  }

  const total = useMemo(
    () => items.reduce((sum, i) => sum + i.precio * i.cantidad, 0),
    [items],
  )

  const itemCount = useMemo(
    () => items.reduce((sum, i) => sum + i.cantidad, 0),
    [items],
  )

  return (
    <CartContext.Provider
      value={{
        items,
        addToCart,
        removeFromCart,
        updateQuantity,
        updatePrecio,
        clearCart,
        total,
        itemCount,
        isOpen,
        openCart: () => setIsOpen(true),
        closeCart: () => setIsOpen(false),
        enviando,
        setEnviando,
        refreshKey,
        transactionSuccess,
      }}
    >
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within a CartProvider')
  return ctx
}
