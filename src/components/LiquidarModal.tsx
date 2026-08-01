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
  const [comprobante, setComprobante] = useState('')
  const [enviando, setEnviando] = useState(false)
  const esTransferencia = metodo === 'Transferencia'

  const descripcion = (() => {
    const cat = detalle.repuestos.categorias?.nombre ?? '—'
    const ma = detalle.repuestos.modelos?.marcas?.nombre ?? '—'
    const m = detalle.repuestos.modelos?.nombre ?? '—'
    const dist = detalle.repuestos.distribuidores?.nombre ?? ''
    const extras = formatearDetalles(dist, detalle.repuestos.atributos ?? {})
    return `${detalle.cantidad}x ${cat} ${ma} ${m}${extras ? ` (${extras})` : ''}`
  })()

  const handleConfirm = async () => {
    if (esTransferencia && !comprobante.trim()) {
      toast.error('Por favor, ingresa el número de comprobante.')
      return
    }

    setEnviando(true)

    try {
      const otrosSubtotales = venta.detalles_venta
        .filter((d) => d.id_detalle !== detalle.id_detalle)
        .reduce((sum, d) => sum + d.subtotal, 0)
      const nuevoTotal = Math.max(0, Math.round(otrosSubtotales * 100) / 100)

      const { error: errDel } = await supabase
        .from('detalles_venta')
        .delete()
        .eq('id_detalle', detalle.id_detalle)
      if (errDel) throw errDel

      if (nuevoTotal <= 0) {
        const { error } = await supabase
          .from('ventas')
          .update({
            estado_pago: 'Pagado',
            metodo_pago: metodo,
            numero_comprobante: esTransferencia ? comprobante.trim() : null,
            fecha_cobro: 'now()',
            total: 0,
          })
          .eq('id_venta', venta.id_venta)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('ventas')
          .update({ total: nuevoTotal })
          .eq('id_venta', venta.id_venta)
        if (error) throw error
      }

      generarReciboVenta({
        tituloDocumento: 'COMPROBANTE DE PAGO',
        nombreCliente: venta.alias_tecnico,
        fecha:
          formatearFechaComprobante(venta.fecha_cobro ?? venta.fecha_hora) ?? '—',
        detallesRepuesto: [detalle].map((det) => {
          const marca = det.repuestos.modelos?.marcas?.nombre ?? '—'
          const modelo = det.repuestos.modelos?.nombre ?? '—'
          const categoria = det.repuestos.categorias?.nombre ?? '—'
          return {
            categoria,
            marca,
            modelo,
            cantidad: det.cantidad,
            precioUnitario: det.precio_unitario,
            subtotal: det.subtotal,
          }
        }),
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
            onChange={(e) => setMetodo(e.target.value as MetodoPago)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="Efectivo">Efectivo</option>
            <option value="Transferencia">Transferencia</option>
          </select>
        </div>

        {esTransferencia && (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">Número de Comprobante</label>
            <input
              type="text"
              value={comprobante}
              onChange={(e) => setComprobante(e.target.value)}
              placeholder="Ej: #000123456"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
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
            disabled={enviando || (esTransferencia && !comprobante.trim())}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors cursor-pointer"
          >
            {enviando ? 'Procesando…' : 'Confirmar Pago'}
          </button>
        </div>
      </div>
    </div>
  )
}
