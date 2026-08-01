import { useState } from 'react'
import { supabase } from '../lib/supabase'
import type { VentaConDetalles } from '../types/database'
import { toast } from './Toaster'

interface ModalGarantiaClienteProps {
  venta: VentaConDetalles
  detalleInicial?: VentaConDetalles['detalles_venta'][number] | null
  onClose: () => void
  onSuccess: () => void
}

export function ModalGarantiaCliente({ venta, detalleInicial, onClose, onSuccess }: ModalGarantiaClienteProps) {
  const [idDetalle, setIdDetalle] = useState<number>(
    detalleInicial?.id_detalle ?? venta.detalles_venta[0]?.id_detalle ?? 0,
  )
  const [cantidad, setCantidad] = useState<number>(1)
  const [descripcionFalla, setDescripcionFalla] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const detalleSeleccionado = venta.detalles_venta.find((d) => d.id_detalle === idDetalle) ?? null
  const cantidadMax = detalleSeleccionado?.cantidad ?? 1
  const precioUnitario = detalleSeleccionado
    ? detalleSeleccionado.subtotal / detalleSeleccionado.cantidad
    : 0

  const nombreItem = (d: VentaConDetalles['detalles_venta'][number]) => {
    const m = d.repuestos.modelos?.nombre ?? '—'
    const ma = d.repuestos.modelos?.marcas?.nombre ?? '—'
    const cat = d.repuestos.categorias?.nombre ?? '—'
    return `${d.cantidad}x ${cat} ${ma} ${m}`
  }

  const handleRepuestoChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setIdDetalle(Number(e.target.value))
    setCantidad(1)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!detalleSeleccionado) {
      setError('Selecciona el repuesto que se está devolviendo.')
      return
    }
    if (!descripcionFalla.trim()) {
      setError('La descripción de la falla es obligatoria.')
      return
    }

    const cantidadFinal = Number(cantidad)
    if (!cantidadFinal || cantidadFinal < 1 || cantidadFinal > cantidadMax) {
      setError(`La cantidad debe estar entre 1 y ${cantidadMax}.`)
      return
    }

    setEnviando(true)

    // Paso A: registrar en cuarentena
    const { error: errIns } = await supabase
      .from('cuarentena_defectuosos')
      .insert({
        id_repuesto: detalleSeleccionado.id_repuesto,
        cantidad: cantidadFinal,
        origen: 'Devolucion Cliente',
        estado_revision: 'En tienda',
        descripcion_falla: descripcionFalla.trim(),
        id_venta: venta.id_venta,
        id_cliente: null,
      })

    if (errIns) {
      setEnviando(false)
      setError(errIns.message)
      return
    }

    // Paso B: ajustar el detalle de la venta
    const nuevaCantidad = cantidadMax - cantidadFinal
    if (nuevaCantidad <= 0) {
      const { error: errDel } = await supabase
        .from('detalles_venta')
        .delete()
        .eq('id_detalle', detalleSeleccionado.id_detalle)

      if (errDel) {
        setEnviando(false)
        setError('Se registró en cuarentena, pero no se pudo ajustar la deuda: ' + errDel.message)
        return
      }
    } else {
      const { error: errUpd } = await supabase
        .from('detalles_venta')
        .update({
          cantidad: nuevaCantidad,
          subtotal: nuevaCantidad * precioUnitario,
        })
        .eq('id_detalle', detalleSeleccionado.id_detalle)

      if (errUpd) {
        setEnviando(false)
        setError('Se registró en cuarentena, pero no se pudo ajustar la deuda: ' + errUpd.message)
        return
      }
    }

    // Paso C: recalcular el total de la venta
    const subtotalRestante = venta.detalles_venta
      .filter((d) => d.id_detalle !== detalleSeleccionado.id_detalle)
      .reduce((sum, d) => sum + d.subtotal, 0)
    const nuevoTotal = Math.max(
      0,
      Math.round((subtotalRestante + nuevaCantidad * precioUnitario) * 100) / 100,
    )

    const updateVenta: Record<string, unknown> = { total: nuevoTotal }
    if (nuevoTotal <= 0) updateVenta.estado_pago = 'Garantia'

    const { error: errVta } = await supabase
      .from('ventas')
      .update(updateVenta)
      .eq('id_venta', venta.id_venta)

    setEnviando(false)
    if (errVta) {
      setError('Se registró en cuarentena, pero no se pudo actualizar la deuda: ' + errVta.message)
      return
    }

    toast.success('Garantía procesada y deuda ajustada')
    onSuccess()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">Devolución / Garantía</h3>
            <p className="text-sm text-slate-500 mt-0.5">
              Cliente: <span className="font-medium text-slate-700">{venta.alias_tecnico}</span> · Deuda: $ {venta.total.toFixed(2)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1 rounded-md transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm p-3">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Repuesto devuelto
            </label>
            <select
              value={idDetalle}
              onChange={handleRepuestoChange}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              {venta.detalles_venta.map((d) => (
                <option key={d.id_detalle} value={d.id_detalle}>
                  {nombreItem(d)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Cantidad devuelta</label>
            <input
              type="number"
              name="cantidad"
              min={1}
              max={cantidadMax}
              value={cantidad}
              onChange={(e) => {
                const v = Math.min(cantidadMax, Math.max(1, Number(e.target.value) || 1))
                setCantidad(v)
              }}
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <p className="text-xs text-slate-500 mt-1">
              Máximo {cantidadMax} (cantidad que se llevó de este ítem).
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Descripción de la falla <span className="text-red-500">*</span>
            </label>
            <textarea
              name="descripcion_falla"
              value={descripcionFalla}
              onChange={(e) => setDescripcionFalla(e.target.value)}
              required
              rows={3}
              placeholder="Detalla el problema reportado por el cliente…"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={enviando}
              className="rounded-lg bg-amber-600 px-5 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              {enviando ? 'Procesando…' : 'Procesar Garantía'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
