import { useState } from 'react'
import { supabase } from '../lib/supabase'
import type { VentaConDetalles, MetodoPago } from '../types/database'
import { formatearDetalles, formatearFechaComprobante } from '../lib/format'
import { generarReciboVenta } from '../utils/generadorPDF'
import { toast } from './Toaster'

interface Props {
  venta: VentaConDetalles
  detalle: VentaConDetalles['detalles_venta'][number]
  onClose: () => void
  onSuccess: () => void
}

export function LiquidarModal({ venta, detalle, onClose, onSuccess }: Props) {
  const [metodo, setMetodo] = useState<MetodoPago>('Efectivo')
  const [referencia, setReferencia] = useState('')
  const [montoEfectivo, setMontoEfectivo] = useState('')
  const [montoTransferencia, setMontoTransferencia] = useState('')
  const [enviando, setEnviando] = useState(false)
  const esTransferencia = metodo === 'Transferencia'
  const esMixto = metodo === 'Mixto'
  const esMixtoValido =
    Math.round((Number(montoEfectivo) + Number(montoTransferencia)) * 100) ===
    Math.round(detalle.subtotal * 100)

  const descripcion = (() => {
    const cat = detalle.repuestos.categorias?.nombre ?? '—'
    const ma = detalle.repuestos.modelos?.marcas?.nombre ?? '—'
    const m = detalle.repuestos.modelos?.nombre ?? '—'
    const dist = detalle.repuestos.distribuidores?.nombre ?? ''
    const extras = formatearDetalles(dist, detalle.repuestos.atributos ?? {})
    return `${detalle.cantidad}x ${cat} ${ma} ${m}${extras ? ` (${extras})` : ''}`
  })()

  const handleConfirm = async () => {
    if ((esTransferencia || esMixto) && !referencia.trim()) {
      toast.error('Por favor, ingresa la referencia de la transferencia.')
      return
    }
    if (esMixto && !esMixtoValido) return

    setEnviando(true)

    try {
      const fechaPago = new Date().toISOString()

      const montos =
        metodo === 'Efectivo'
          ? { monto_efectivo_item: detalle.subtotal, monto_transferencia_item: 0 }
          : metodo === 'Transferencia'
            ? { monto_efectivo_item: 0, monto_transferencia_item: detalle.subtotal }
            : metodo === 'Mixto'
              ? { monto_efectivo_item: Number(montoEfectivo) || 0, monto_transferencia_item: Number(montoTransferencia) || 0 }
              : { monto_efectivo_item: 0, monto_transferencia_item: 0 }

      const { error: errDet } = await supabase
        .from('detalles_venta')
        .update({
          estado_item: 'Liquidado',
          fecha_pago_item: fechaPago,
          metodo_pago_item: metodo,
          referencia_item: referencia.trim() || null,
          ...montos,
        })
        .eq('id_detalle', detalle.id_detalle)
      if (errDet) throw errDet

      const nuevoTotal = Math.max(
        0,
        Math.round(
          venta.detalles_venta
            .filter(
              (d) =>
                d.id_detalle !== detalle.id_detalle &&
                d.estado_item !== 'Liquidado' &&
                d.estado_item !== 'Devuelto',
            )
            .reduce((sum, d) => sum + d.subtotal, 0) * 100,
        ) / 100,
      )

      const updateVenta: Record<string, unknown> = {
        total: nuevoTotal,
        metodo_pago: metodo,
        numero_comprobante: (esTransferencia || esMixto) ? referencia.trim() : null,
        monto_efectivo: montos.monto_efectivo_item,
        monto_transferencia: montos.monto_transferencia_item,
      }
      if (nuevoTotal <= 0) {
        updateVenta.estado_pago = 'Pagado'
        updateVenta.fecha_cobro = 'now()'
      }

      const { error } = await supabase
        .from('ventas')
        .update(updateVenta)
        .eq('id_venta', venta.id_venta)
      if (error) throw error

      generarReciboVenta({
        tituloDocumento: 'COMPROBANTE DE PAGO',
        nombreCliente: venta.alias_tecnico,
        fecha: formatearFechaComprobante(fechaPago) ?? '—',
        detallesRepuesto: [
          {
            categoria: detalle.repuestos.categorias?.nombre ?? '—',
            marca: detalle.repuestos.modelos?.marcas?.nombre ?? '—',
            modelo: detalle.repuestos.modelos?.nombre ?? '—',
            cantidad: detalle.cantidad,
            precioUnitario: detalle.precio_unitario,
            subtotal: detalle.subtotal,
          },
        ],
        total: detalle.subtotal,
      })

      setEnviando(false)
      onClose()
      onSuccess()
    } catch (error) {
      setEnviando(false)
      console.error('Error detallado:', error)
      toast.error('Error al procesar el pago: ' + ((error as Error).message || JSON.stringify(error)))
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-slate-800">Liquidar Deuda</h3>

        <div className="space-y-2 text-sm text-slate-600">
          <p>
            <span className="font-medium text-slate-700">Técnico:</span>{' '}
            {venta.alias_tecnico}
          </p>
          <p>
            <span className="font-medium text-slate-700">Repuesto:</span>{' '}
            {descripcion}
          </p>
          <p className="pt-1">
            <span className="text-base font-bold text-slate-800 font-mono">
              Monto a liquidar: $ {detalle.subtotal.toFixed(2)}
            </span>
          </p>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700">Método de Pago</label>
          <select
            value={metodo}
            onChange={(e) => {
              const nuevo = e.target.value as MetodoPago
              if (nuevo === 'Efectivo') setReferencia('')
              if (nuevo !== 'Mixto') {
                setMontoEfectivo('')
                setMontoTransferencia('')
              }
              setMetodo(nuevo)
            }}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="Efectivo">Efectivo</option>
            <option value="Transferencia">Transferencia</option>
            <option value="Mixto">Mixto</option>
          </select>
        </div>

        {(esTransferencia || esMixto) && (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">
              Número de Comprobante <span className="text-red-500">(Obligatorio)</span>
            </label>
            <input
              type="text"
              value={referencia}
              onChange={(e) => setReferencia(e.target.value)}
              placeholder="Ej: #000123456"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        {esMixto && (
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-600">Efectivo ($)</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={montoEfectivo}
                onChange={(e) => setMontoEfectivo(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-600">Transferencia ($)</label>
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
            La suma de Efectivo + Transferencia debe ser $ {detalle.subtotal.toFixed(2)}
          </p>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            disabled={enviando}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={enviando || ((esTransferencia || esMixto) && !referencia.trim()) || (esMixto && !esMixtoValido)}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors cursor-pointer"
          >
            {enviando ? 'Procesando…' : 'Confirmar Pago'}
          </button>
        </div>
      </div>
    </div>
  )
}
