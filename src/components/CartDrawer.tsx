import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useCart } from '../contexts/CartContext'

export function CartDrawer() {
  const {
    items, isOpen, closeCart, removeFromCart, updateQuantity, updatePrecio,
    total, clearCart, enviando, setEnviando, transactionSuccess,
  } = useCart()
  const [alias, setAlias] = useState('')
  const [estado, setEstado] = useState('Pagado')
  const [metodoPago, setMetodoPago] = useState('Efectivo')
  const [nroComprobante, setNroComprobante] = useState('')

  const esTransferencia = metodoPago === 'Transferencia'
  const confirmDisabled = !alias.trim() || enviando || (esTransferencia && !nroComprobante.trim())

  const handleConfirm = async () => {
    if (confirmDisabled) return
    setEnviando(true)

    const notas = esTransferencia ? `Comprobante: ${nroComprobante.trim()}` : null

    try {
      /* ───── Paso A: Insertar venta ───── */
      const { data: venta, error: errV } = await supabase
        .from('ventas')
        .insert({
          alias_tecnico: alias.trim(),
          estado_pago: estado,
          metodo_pago: metodoPago,
          total,
          notas,
        })
        .select('id_venta')
        .single()

      if (errV || !venta) throw new Error(errV?.message ?? 'Error al crear venta')

      const idVenta = venta.id_venta

      /* ───── Pasos B y C: Insertar detalles + descontar stock ───── */
      for (const item of items) {
        const subtotal = item.precio * item.cantidad

        const { error: errD } = await supabase.from('detalles_venta').insert({
          id_venta: idVenta,
          id_repuesto: item.id_repuesto,
          cantidad: item.cantidad,
          precio_unitario: item.precio,
          subtotal,
        })
        if (errD) throw new Error(errD.message)

        const { data: rep } = await supabase
          .from('repuestos')
          .select('stock')
          .eq('id_repuesto', item.id_repuesto)
          .single()

        if (rep) {
          const { error: errS } = await supabase
            .from('repuestos')
            .update({ stock: rep.stock - item.cantidad })
            .eq('id_repuesto', item.id_repuesto)

          if (errS) throw new Error(errS.message)
        }
      }

      /* ───── Paso D: Limpiar y refrescar ───── */
      clearCart()
      setAlias('')
      setEstado('Pagado')
      setMetodoPago('Efectivo')
      setNroComprobante('')
      transactionSuccess()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error al procesar la transacción')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 transition-opacity"
          onClick={closeCart}
        />
      )}

      <div
        className={`fixed inset-y-0 right-0 z-50 w-96 bg-white shadow-xl transform transition-transform ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-800">Ticket de Venta</h2>
            <button
              onClick={closeCart}
              className="text-slate-400 hover:text-slate-600 text-xl leading-none cursor-pointer"
            >
              &times;
            </button>
          </div>

          {/* Items */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
            {items.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">Carrito vacío</p>
            ) : (
              items.map((item) => (
                <div
                  key={item.id_repuesto}
                  className="rounded-lg border border-slate-200 p-3 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-800 truncate">{item.descripcion}</p>
                      <p className="text-xs text-slate-500">{item.categoria}</p>
                    </div>
                    <button
                      onClick={() => removeFromCart(item.id_repuesto)}
                      className="text-red-400 hover:text-red-600 text-sm cursor-pointer shrink-0"
                    >
                      &times;
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateQuantity(item.id_repuesto, item.cantidad - 1)}
                      disabled={item.cantidad <= 1}
                      className="w-7 h-7 rounded border border-slate-300 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-30 transition-colors cursor-pointer"
                    >
                      &minus;
                    </button>
                    <span className="w-8 text-center text-sm font-semibold text-slate-800">{item.cantidad}</span>
                    <button
                      onClick={() => updateQuantity(item.id_repuesto, item.cantidad + 1)}
                      disabled={item.cantidad >= item.stock_disponible}
                      className="w-7 h-7 rounded border border-slate-300 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-30 transition-colors cursor-pointer"
                    >
                      +
                    </button>

                    <select
                      value={item.tipo_precio}
                      onChange={(e) => {
                        const tipo = e.target.value as 'tecnico' | 'cliente'
                        updatePrecio(item.id_repuesto, item.precio, tipo)
                      }}
                      className="ml-auto text-xs border border-slate-300 rounded px-1 py-1 focus:outline-none"
                    >
                      <option value="tecnico">P. Técnico</option>
                      <option value="cliente">P. Cliente</option>
                    </select>

                    <span className="text-sm font-mono font-semibold text-slate-800 min-w-[5rem] text-right">
                      S/ {(item.precio * item.cantidad).toFixed(2)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {items.length > 0 && (
            <div className="border-t border-slate-200 px-5 py-4 space-y-3">
              <div className="flex justify-between text-sm font-semibold text-slate-800">
                <span>Total:</span>
                <span className="font-mono">S/ {total.toFixed(2)}</span>
              </div>

              <input
                type="text"
                placeholder="Alias del Técnico *"
                value={alias}
                onChange={(e) => setAlias(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

              <div className="grid grid-cols-2 gap-2">
                <select
                  value={estado}
                  onChange={(e) => setEstado(e.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Pagado">Pagado</option>
                  <option value="Fiado">Fiado</option>
                  <option value="A Prueba">A Prueba</option>
                </select>

                <select
                  value={metodoPago}
                  onChange={(e) => {
                    setMetodoPago(e.target.value)
                    if (e.target.value !== 'Transferencia') setNroComprobante('')
                  }}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Efectivo">Efectivo</option>
                  <option value="Transferencia">Transferencia</option>
                  <option value="Pendiente">Pendiente</option>
                </select>
              </div>

              {esTransferencia && (
                <input
                  type="text"
                  placeholder="Nro. de Comprobante *"
                  value={nroComprobante}
                  onChange={(e) => setNroComprobante(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              )}

              <button
                onClick={handleConfirm}
                disabled={confirmDisabled}
                className="w-full rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50 transition-colors cursor-pointer"
              >
                {enviando ? 'Procesando…' : 'Confirmar Transacción'}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
