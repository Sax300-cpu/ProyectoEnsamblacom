import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useCart } from '../contexts/CartContext'
import { formatearDetalles } from '../lib/format'
import { generarReciboVenta } from '../utils/generadorPDF'
import { toast } from '../components/Toaster'
import type { EstadoPago, MetodoPago } from '../types/database'

interface ClienteOption {
  nombre: string
}

interface CartDrawerProps {
  onVentaExitosa?: () => void
}

export function CartDrawer({ onVentaExitosa }: CartDrawerProps) {
  const {
    items, isOpen, closeCart, removeFromCart, updateQuantity,
    total, clearCart, enviando, setEnviando, transactionSuccess,
  } = useCart()
  const [alias, setAlias] = useState('')
  const [estado, setEstado] = useState<EstadoPago>('Pagado')
  const [metodoPago, setMetodoPago] = useState<MetodoPago>('Efectivo')
  const [nroComprobante, setNroComprobante] = useState('')
  const [montoEfectivo, setMontoEfectivo] = useState('')
  const [montoTransferencia, setMontoTransferencia] = useState('')
  const [clientes, setClientes] = useState<ClienteOption[]>([])

  useEffect(() => {
    if (!isOpen) return
    supabase
      .from('clientes')
      .select('nombre')
      .order('nombre', { ascending: true })
      .then(({ data }) => {
        if (data) setClientes(data as ClienteOption[])
      })
  }, [isOpen])

  useEffect(() => {
    if (estado === 'Fiado' || estado === 'A Prueba') {
      setMetodoPago('Pendiente')
    } else {
      setMetodoPago('Efectivo')
    }
  }, [estado])

  const esPagoDiferido = estado === 'Fiado' || estado === 'A Prueba'
  const esTransferencia = metodoPago === 'Transferencia'
  const esMixto = metodoPago === 'Mixto'
  const esMixtoValido =
    Math.round((Number(montoEfectivo) + Number(montoTransferencia)) * 100) ===
    Math.round(total * 100)
  const confirmDisabled = items.length === 0 || !alias.trim() || enviando ||
    ((esTransferencia || esMixto) && !nroComprobante.trim())

  const handleConfirm = async () => {
    if (items.length === 0) return
    if (confirmDisabled) return

    // Validación estricta de montos (antes del insert a Supabase).
    const montoTrans = Number(montoTransferencia) || 0
    if (esTransferencia && montoTrans > total) {
      toast.error(
        `El monto de transferencia ($${montoTrans.toFixed(2)}) no puede superar el total del carrito ($${total.toFixed(2)}).`,
      )
      return
    }
    if (esMixto && !esMixtoValido) {
      toast.error(
        `La suma de Efectivo + Transferencia debe ser exactamente $${total.toFixed(2)}.`,
      )
      return
    }

    setEnviando(true)

    const nombreAlias = alias.trim()

    try {
      /* ───── Paso 0: Buscar o crear cliente (resolver id_cliente ANTES de la venta) ───── */
      const buscarOCrearCliente = async (nombre: string): Promise<number> => {
        const { data: existentes, error: errFind } = await supabase
          .from('clientes')
          .select('id_cliente')
          .ilike('nombre', nombre)
          .limit(1)

        if (errFind) throw new Error(errFind.message)
        if (existentes && existentes.length > 0) return existentes[0].id_cliente

        const { data: nuevo, error: errC } = await supabase
          .from('clientes')
          .insert({ nombre })
          .select('id_cliente')
          .single()

        if (errC) throw new Error(errC.message)
        if (!nuevo?.id_cliente) throw new Error('No se pudo crear el cliente')

        setClientes((prev) => [...prev, { nombre }])
        return nuevo.id_cliente
      }

      const idCliente = await buscarOCrearCliente(nombreAlias)

      /* ───── Paso A: Insertar venta ───── */
      const montos =
        metodoPago === 'Efectivo'
          ? { monto_efectivo: total, monto_transferencia: 0 }
          : metodoPago === 'Transferencia'
            ? { monto_efectivo: 0, monto_transferencia: total }
            : metodoPago === 'Mixto'
              ? { monto_efectivo: Number(montoEfectivo) || 0, monto_transferencia: Number(montoTransferencia) || 0 }
              : { monto_efectivo: 0, monto_transferencia: 0 }

      const ventaPayload: Record<string, unknown> = {
        alias_tecnico: nombreAlias,
        id_cliente: idCliente,
        estado_pago: estado,
        metodo_pago: metodoPago,
        total,
        notas: null,
        numero_comprobante: (esTransferencia || esMixto) ? nroComprobante.trim() : null,
        ...montos,
      }

      const { data: venta, error: errV } = await supabase
        .from('ventas')
        .insert(ventaPayload)
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

      /* ───── Paso D: Generar PDF según estado ───── */
      if (estado === 'A Prueba') {
        /* silencio — no generar PDF */
      } else if (estado === 'Fiado') {
        generarReciboVenta({
          tituloDocumento: 'COMPROBANTE DE CRÉDITO',
          nombreCliente: nombreAlias,
          fecha: new Date().toLocaleDateString('es-PE', {
            year: 'numeric', month: 'long', day: 'numeric',
            hour: '2-digit', minute: '2-digit',
          }),
          detallesRepuesto: items.map((item) => ({
            categoria: item.categoria,
            marca: item.marca_nombre,
            modelo: item.modelo_nombre,
            cantidad: item.cantidad,
            precioUnitario: item.precio,
            subtotal: item.precio * item.cantidad,
          })),
          total,
        })
      } else {
        generarReciboVenta({
          tituloDocumento: 'COMPROBANTE DE VENTA',
          nombreCliente: nombreAlias,
          fecha: new Date().toLocaleDateString('es-PE', {
            year: 'numeric', month: 'long', day: 'numeric',
            hour: '2-digit', minute: '2-digit',
          }),
          detallesRepuesto: items.map((item) => ({
            categoria: item.categoria,
            marca: item.marca_nombre,
            modelo: item.modelo_nombre,
            cantidad: item.cantidad,
            precioUnitario: item.precio,
            subtotal: item.precio * item.cantidad,
          })),
          total,
        })
      }

      /* ───── Paso E: Limpiar y refrescar ───── */
      clearCart()
      setAlias('')
      setEstado('Pagado')
      setMetodoPago('Efectivo')
      setNroComprobante('')
      setMontoEfectivo('')
      setMontoTransferencia('')
      transactionSuccess()
      onVentaExitosa?.()
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
                      <p className="text-xs text-gray-500">
                        {formatearDetalles(item.distribuidor, item.detalles)}
                      </p>
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

                    <span className="ml-auto text-xs font-semibold text-slate-600">
                      P. Técnico
                    </span>

                    <span className="text-sm font-mono font-semibold text-slate-800 min-w-[5rem] text-right">
                      $ {(item.precio * item.cantidad).toFixed(2)}
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
                <span className="font-mono">$ {total.toFixed(2)}</span>
              </div>

              <input
                type="text"
                placeholder="Alias del Técnico *"
                value={alias}
                onChange={(e) => setAlias(e.target.value)}
                list="lista-clientes"
                autoComplete="off"
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
              <datalist id="lista-clientes">
                {clientes.map((c, i) => (
                  <option key={i} value={c.nombre} />
                ))}
              </datalist>

              <div className="grid grid-cols-2 gap-2">
                <select
                  value={estado}
                  onChange={(e) => setEstado(e.target.value as EstadoPago)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Pagado">Pagado</option>
                  <option value="Fiado">Fiado</option>
                  <option value="A Prueba">A Prueba</option>
                </select>

                <select
                  value={metodoPago}
                  disabled={esPagoDiferido}
                  onChange={(e) => {
                    setMetodoPago(e.target.value as MetodoPago)
                    if (e.target.value !== 'Transferencia' && e.target.value !== 'Mixto') setNroComprobante('')
                    if (e.target.value !== 'Mixto') {
                      setMontoEfectivo('')
                      setMontoTransferencia('')
                    }
                  }}
                  className={`rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    esPagoDiferido
                      ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                      : 'bg-white border-slate-300'
                  }`}
                >
                  {esPagoDiferido ? (
                    <option value="Pendiente">Pendiente</option>
                  ) : (
                    <>
                      <option value="Efectivo">Efectivo</option>
                      <option value="Transferencia">Transferencia</option>
                      <option value="Mixto">Mixto</option>
                    </>
                  )}
                </select>
              </div>

              {(esTransferencia || esMixto) && (
                <input
                  type="text"
                  placeholder="Nro. de Comprobante *"
                  value={nroComprobante}
                  onChange={(e) => setNroComprobante(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              )}

              {esMixto && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Efectivo ($)</label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={montoEfectivo}
                      onChange={(e) => setMontoEfectivo(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Transferencia ($)</label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={montoTransferencia}
                      onChange={(e) => setMontoTransferencia(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}
              {esMixto && !esMixtoValido && (
                <p className="text-xs text-red-600">
                  La suma de Efectivo + Transferencia debe ser $ {total.toFixed(2)}
                </p>
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
