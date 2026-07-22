import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { VentaConDetalles } from '../types/database'
import { formatearDetalles } from '../lib/format'

function LiquidarModal({
  venta,
  onClose,
  onSuccess,
}: {
  venta: VentaConDetalles
  onClose: () => void
  onSuccess: () => void
}) {
  const [metodo, setMetodo] = useState('Efectivo')
  const [comprobante, setComprobante] = useState('')
  const [enviando, setEnviando] = useState(false)
  const esTransferencia = metodo === 'Transferencia'

  const handleConfirm = async () => {
    if (esTransferencia && !comprobante.trim()) return
    setEnviando(true)

    const notas = esTransferencia
      ? `Comprobante: ${comprobante.trim()}`
      : venta.notas

    const { error } = await supabase
      .from('ventas')
      .update({
        estado_pago: 'Pagado',
        metodo_pago: metodo,
        notas,
      })
      .eq('id_venta', venta.id_venta)

    setEnviando(false)
    if (!error) onSuccess()
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center" onClick={onClose}>
        <div
          className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6 space-y-4"
          onClick={(e) => e.stopPropagation()}
        >
          <h3 className="text-lg font-semibold text-slate-800">Liquidar Venta</h3>
          <p className="text-sm text-slate-600">
            Total: <span className="font-semibold font-mono">S/ {venta.total.toFixed(2)}</span>
          </p>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">Método de Pago</label>
            <select
              value={metodo}
              onChange={(e) => setMetodo(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="Efectivo">Efectivo</option>
              <option value="Transferencia">Transferencia</option>
            </select>
          </div>

          {esTransferencia && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">Nro. de Comprobante</label>
              <input
                type="text"
                value={comprobante}
                onChange={(e) => setComprobante(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              disabled={enviando || (esTransferencia && !comprobante.trim())}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {enviando ? 'Procesando…' : 'Confirmar'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

export function CuentasPorCobrar() {
  const [ventas, setVentas] = useState<VentaConDetalles[]>([])
  const [cargando, setCargando] = useState(true)
  const [liquidando, setLiquidando] = useState<VentaConDetalles | null>(null)

  const formatFecha = (fechaString: string) => {
    if (!fechaString) return 'Sin fecha'
    try {
      const d = new Date(fechaString)
      return isNaN(d.getTime())
        ? 'Fecha inválida'
        : d.toLocaleString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })
    } catch {
      return 'Error de fecha'
    }
  }

  const cargarVentas = async () => {
    setCargando(true)
    const { data } = await supabase
      .from('ventas')
      .select(`
        *,
        detalles_venta (
          *,
          repuestos (
            *,
            modelos:id_modelo_principal (
              id_modelo,
              nombre,
              marcas (
                id_marca,
                nombre
              )
            ),
            categorias!inner (
              id_categoria,
              nombre
            ),
            distribuidores!inner (
              id_distribuidor,
              nombre
            )
          )
        )
      `)
      .in('estado_pago', ['Fiado', 'A Prueba'])
      .order('fecha_hora', { ascending: false })

    if (data) setVentas(data as unknown as VentaConDetalles[])
    setCargando(false)
  }

  useEffect(() => {
    cargarVentas()
  }, [])

  if (cargando) {
    return (
      <div className="flex justify-center py-12 text-slate-500 text-sm">
        Cargando…
      </div>
    )
  }

  if (ventas.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500 text-sm">
        No hay cuentas por cobrar.
      </div>
    )
  }

  return (
    <section>
      <h2 className="text-2xl font-semibold text-slate-800 mb-4">Por Cobrar</h2>

      <div className="grid gap-4">
        {ventas.map((venta) => (
          <div
            key={venta.id_venta}
            className="rounded-xl border border-slate-200 bg-white shadow-sm p-5 space-y-3"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="text-sm text-slate-500">
                  {formatFecha(venta.fecha_hora)}
                </p>
                <p className="text-sm font-medium text-slate-800">
                  {venta.alias_tecnico}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span
                  className={`inline-block rounded-full px-3 py-0.5 text-xs font-semibold ${
                    venta.estado_pago === 'Fiado'
                      ? 'bg-orange-100 text-orange-700'
                      : 'bg-blue-100 text-blue-700'
                  }`}
                >
                  {venta.estado_pago}
                </span>
              </div>
            </div>

            {/* Items */}
            <div className="space-y-1">
              {venta.detalles_venta.map((det) => {
                const modelo = det.repuestos.modelos?.nombre ?? '—'
                const marca = det.repuestos.modelos?.marcas?.nombre ?? '—'
                const distribuidor = det.repuestos.distribuidores?.nombre ?? ''
                const detalles = det.repuestos.atributos ?? {}
                const extras = formatearDetalles(distribuidor, detalles)
                return (
                  <p key={det.id_detalle} className="text-sm text-slate-600">
                    {det.cantidad}x {marca} {modelo}
                    {extras && ` (${extras})`}
                  </p>
                )
              })}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <span className="text-base font-semibold text-slate-800 font-mono">
                S/ {venta.total.toFixed(2)}
              </span>
              <button
                onClick={() => setLiquidando(venta)}
                className="rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors cursor-pointer"
              >
                Liquidar / Pagar
              </button>
            </div>
          </div>
        ))}
      </div>

      {liquidando && (
        <LiquidarModal
          venta={liquidando}
          onClose={() => setLiquidando(null)}
          onSuccess={() => {
            setLiquidando(null)
            cargarVentas()
          }}
        />
      )}
    </section>
  )
}
