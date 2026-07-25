import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { VentaConDetalles } from '../types/database'
import { formatearDetalles } from '../lib/format'
import { LiquidarModal } from '../components/LiquidarModal'

function DevolucionModal({
  venta,
  onClose,
  onSuccess,
}: {
  venta: VentaConDetalles
  onClose: () => void
  onSuccess: () => void
}) {
  const [enviando, setEnviando] = useState(false)
  const [modoDefectuoso, setModoDefectuoso] = useState(false)
  const [motivoDefecto, setMotivoDefecto] = useState('')

  const detallePrincipal = venta.detalles_venta[0]
  const cantidadMax = detallePrincipal?.cantidad ?? 1
  const [cantidadDevuelta, setCantidadDevuelta] = useState(cantidadMax)

  const { precioUnitario, nuevoTotalRestante, esParcial } = (() => {
    if (!detallePrincipal) return { precioUnitario: 0, nuevoTotalRestante: 0, esParcial: false }
    const pu = detallePrincipal.subtotal / detallePrincipal.cantidad
    const esP = cantidadDevuelta < cantidadMax
    const ntr = (cantidadMax - cantidadDevuelta) * pu
    return { precioUnitario: pu, nuevoTotalRestante: ntr, esParcial: esP }
  })()

  const resetYcerrar = () => {
    setModoDefectuoso(false)
    setMotivoDefecto('')
    setEnviando(false)
    onClose()
    onSuccess()
  }

  const handleBueno = async () => {
    if (!detallePrincipal) return
    setEnviando(true)

    try {
      const stockActual = detallePrincipal.repuestos.stock ?? 0
      const { error: errStock } = await supabase
        .from('repuestos')
        .update({ stock: stockActual + cantidadDevuelta })
        .eq('id_repuesto', detallePrincipal.id_repuesto)
      if (errStock) throw errStock

      if (esParcial) {
        const { error: errDet } = await supabase
          .from('detalles_venta')
          .update({ cantidad: cantidadMax - cantidadDevuelta, subtotal: nuevoTotalRestante })
          .eq('id_detalle', detallePrincipal.id_detalle)
        if (errDet) throw errDet

        const { error: errVta } = await supabase
          .from('ventas')
          .update({ total: nuevoTotalRestante })
          .eq('id_venta', venta.id_venta)
        if (errVta) throw errVta
      } else {
        const { error: errDel } = await supabase
          .from('ventas')
          .delete()
          .eq('id_venta', venta.id_venta)
        if (errDel) throw errDel
      }

      resetYcerrar()
    } catch (error) {
      setEnviando(false)
      console.error('Error detallado:', error)
      alert('Error al procesar: ' + ((error as Error).message || JSON.stringify(error)))
    }
  }

  const handleDefectuoso = async () => {
    if (!motivoDefecto.trim() || !detallePrincipal) return
    setEnviando(true)

    try {
      if (esParcial) {
        const { data: newVenta, error: errIns } = await supabase
          .from('ventas')
          .insert({
            alias_tecnico: venta.alias_tecnico,
            estado_pago: 'Garantia',
            metodo_pago: null,
            total: cantidadDevuelta * precioUnitario,
            notas: motivoDefecto.trim(),
          })
          .select('id_venta')
          .single()
        if (errIns || !newVenta) throw errIns ?? new Error('Error al crear venta de garantía')

        const { error: errDetNew } = await supabase
          .from('detalles_venta')
          .insert({
            id_venta: newVenta.id_venta,
            id_repuesto: detallePrincipal.id_repuesto,
            cantidad: cantidadDevuelta,
            precio_unitario: precioUnitario,
            subtotal: cantidadDevuelta * precioUnitario,
          })
        if (errDetNew) throw errDetNew

        const { error: errDetUpd } = await supabase
          .from('detalles_venta')
          .update({ cantidad: cantidadMax - cantidadDevuelta, subtotal: nuevoTotalRestante })
          .eq('id_detalle', detallePrincipal.id_detalle)
        if (errDetUpd) throw errDetUpd

        const { error: errVtaUpd } = await supabase
          .from('ventas')
          .update({ total: nuevoTotalRestante })
          .eq('id_venta', venta.id_venta)
        if (errVtaUpd) throw errVtaUpd
      } else {
        const { error: errUpd } = await supabase
          .from('ventas')
          .update({ estado_pago: 'Garantia', notas: motivoDefecto.trim() })
          .eq('id_venta', venta.id_venta)
        if (errUpd) throw errUpd
      }

      resetYcerrar()
    } catch (error) {
      setEnviando(false)
      console.error('Error detallado:', error)
      alert('Error al guardar: ' + ((error as Error).message || JSON.stringify(error)))
    }
  }

  const volverAlInicio = () => {
    setModoDefectuoso(false)
    setMotivoDefecto('')
    setCantidadDevuelta(cantidadMax)
  }

  const inputCantidad = (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">Cantidad a devolver</label>
      <input
        type="number"
        min={1}
        max={cantidadMax}
        value={cantidadDevuelta}
        onChange={(e) => {
          const v = Math.min(cantidadMax, Math.max(1, Number(e.target.value) || 1))
          setCantidadDevuelta(v)
        }}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  )

  if (modoDefectuoso) {
    return (
      <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
        <div
          className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6 space-y-4"
          onClick={(e) => e.stopPropagation()}
        >
          <h3 className="text-lg font-semibold text-slate-800">Registrar Devolución Defectuosa</h3>

          <p className="text-sm text-slate-600">
            Pieza:{' '}
            <span className="font-medium text-slate-800">
              {detallePrincipal && (() => {
                const m = detallePrincipal.repuestos.modelos?.nombre ?? '—'
                const ma = detallePrincipal.repuestos.modelos?.marcas?.nombre ?? '—'
                const cat = detallePrincipal.repuestos.categorias?.nombre ?? '—'
                return `${detallePrincipal.cantidad}x ${cat} ${ma} ${m}`
              })()}
            </span>
          </p>

          {inputCantidad}

          <textarea
            value={motivoDefecto}
            onChange={(e) => setMotivoDefecto(e.target.value)}
            placeholder="Detalla el problema (Ej: Flex roto por el técnico, táctil no responde, vino trizada…)"
            rows={4}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
          />

          <div className="flex gap-2 pt-2">
            <button
              onClick={volverAlInicio}
              disabled={enviando}
              className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Volver
            </button>
            <button
              onClick={handleDefectuoso}
              disabled={enviando || !motivoDefecto.trim()}
              className="flex-1 rounded-lg bg-red-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {enviando ? 'Procesando…' : 'Confirmar Registro'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-slate-800">Procesar Devolución</h3>

        <p className="text-sm text-slate-600">
          El técnico está devolviendo:{' '}
          <span className="font-medium text-slate-800">
            {detallePrincipal && (() => {
              const m = detallePrincipal.repuestos.modelos?.nombre ?? '—'
              const ma = detallePrincipal.repuestos.modelos?.marcas?.nombre ?? '—'
              const cat = detallePrincipal.repuestos.categorias?.nombre ?? '—'
              return `${detallePrincipal.cantidad}x ${cat} ${ma} ${m}`
            })()}
          </span>
        </p>

        {inputCantidad}

        <p className="text-sm text-slate-600">¿En qué estado se encuentra la pieza?</p>

        <div className="flex flex-col gap-2 pt-2">
          <button
            onClick={handleBueno}
            disabled={enviando}
            className="w-full rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50 transition-colors cursor-pointer"
          >
            {enviando ? 'Procesando…' : 'Bueno — Regresar a Stock'}
          </button>
          <button
            onClick={() => setModoDefectuoso(true)}
            disabled={enviando}
            className="w-full rounded-lg bg-red-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50 transition-colors cursor-pointer"
          >
            Defectuoso — Descartar
          </button>
          <button
            onClick={onClose}
            disabled={enviando}
            className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}



export function CuentasPorCobrar() {
  const [ventas, setVentas] = useState<VentaConDetalles[]>([])
  const [cargando, setCargando] = useState(true)
  const [liquidando, setLiquidando] = useState<VentaConDetalles | null>(null)
  const [devolviendo, setDevolviendo] = useState<VentaConDetalles | null>(null)
  const [busqueda, setBusqueda] = useState('')

  const ventasFiltradas = ventas.filter((v) =>
    v.alias_tecnico.toLowerCase().includes(busqueda.toLowerCase()),
  )
  const totalAcumulado = ventasFiltradas.reduce((sum, v) => sum + v.total, 0)

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
      <section>
        <h2 className="text-2xl font-semibold text-slate-800 mb-4">Por Cobrar</h2>
        <div className="text-center py-12 text-slate-500 text-sm">
          No hay cuentas por cobrar.
        </div>
      </section>
    )
  }

  return (
    <section>
      <h2 className="text-2xl font-semibold text-slate-800 mb-4">Por Cobrar</h2>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
        <input
          type="text"
          placeholder="Buscar por nombre de técnico…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="w-full sm:w-72 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-2 text-sm font-semibold text-emerald-700">
          Total Filtrado: S/ {totalAcumulado.toFixed(2)}
        </div>
      </div>

      {ventasFiltradas.length === 0 ? (
        <div className="text-center py-12 text-slate-500 text-sm">
          No se encontraron deudas para este técnico.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto max-h-[70vh] p-1">
          {ventasFiltradas.map((venta) => (
          <div
            key={venta.id_venta}
            className="rounded-xl border border-slate-200 bg-white shadow-sm p-5 space-y-3 h-full"
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
                const categoria = det.repuestos.categorias?.nombre ?? '—'
                const distribuidor = det.repuestos.distribuidores?.nombre ?? ''
                const detalles = det.repuestos.atributos ?? {}
                const extras = formatearDetalles(distribuidor, detalles)
                return (
                  <p key={det.id_detalle} className="text-sm text-slate-600">
                    {det.cantidad}x {categoria} {marca} {modelo}
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
              <div className="flex gap-2">
                <button
                  onClick={() => setDevolviendo(venta)}
                  className="rounded-lg border border-red-300 px-4 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                >
                  Devolución
                </button>
                <button
                  onClick={() => setLiquidando(venta)}
                  className="rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors cursor-pointer"
                >
                  Liquidar / Pagar
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      )}

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

      {devolviendo && (
        <DevolucionModal
          venta={devolviendo}
          onClose={() => setDevolviendo(null)}
          onSuccess={() => {
            setDevolviendo(null)
            cargarVentas()
          }}
        />
      )}
    </section>
  )
}
