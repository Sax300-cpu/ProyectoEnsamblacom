import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { VentaConDetalles } from '../types/database'
import { formatearDetalles } from '../lib/format'
import { LiquidarModal } from '../components/LiquidarModal'
import { ModalGarantiaCliente } from '../components/ModalGarantiaCliente'
import { toast } from '../components/Toaster'

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

  const detallePrincipal = venta.detalles_venta[0]
  const cantidadMax = detallePrincipal?.cantidad ?? 1
  const [cantidadDevuelta, setCantidadDevuelta] = useState(cantidadMax)

  const { nuevoTotalRestante, esParcial } = (() => {
    if (!detallePrincipal) return { nuevoTotalRestante: 0, esParcial: false }
    const pu = detallePrincipal.subtotal / detallePrincipal.cantidad
    const esP = cantidadDevuelta < cantidadMax
    const ntr = (cantidadMax - cantidadDevuelta) * pu
    return { nuevoTotalRestante: ntr, esParcial: esP }
  })()

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

      toast.success('Devolución procesada y stock actualizado')
      onSuccess()
    } catch (error) {
      setEnviando(false)
      console.error('Error detallado:', error)
      toast.error('Error al procesar: ' + ((error as Error).message || JSON.stringify(error)))
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-slate-800">Devolución a Stock</h3>

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

        <div className="flex flex-col gap-2 pt-2">
          <button
            onClick={handleBueno}
            disabled={enviando}
            className="w-full rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50 transition-colors cursor-pointer"
          >
            {enviando ? 'Procesando…' : 'Regresar a Stock'}
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
  const [garantia, setGarantia] = useState<VentaConDetalles | null>(null)
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
          Total Filtrado: $ {totalAcumulado.toFixed(2)}
        </div>
      </div>

      {ventasFiltradas.length === 0 ? (
        <div className="text-center py-12 text-slate-500 text-sm">
          No se encontraron deudas para este técnico.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 shadow-sm">
          <table className="w-full text-xs md:text-sm">
            <thead>
              <tr className="bg-slate-100 text-slate-600 uppercase text-xs tracking-wider">
                <th className="text-left px-3 py-3 font-semibold">FECHA</th>
                <th className="text-left px-3 py-3 font-semibold">CLIENTE</th>
                <th className="text-center px-3 py-3 font-semibold">ESTADO</th>
                <th className="text-left px-3 py-3 font-semibold">CATEGORÍA</th>
                <th className="text-left px-3 py-3 font-semibold">MODELO</th>
                <th className="text-center px-3 py-3 font-semibold">CANT</th>
                <th className="text-right px-3 py-3 font-semibold">DEUDA</th>
                <th className="text-right px-3 py-3 font-semibold">ACCIONES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {ventasFiltradas.map((venta) => {
                const det = venta.detalles_venta[0]
                const modelo = det?.repuestos.modelos?.nombre ?? '—'
                const marca = det?.repuestos.modelos?.marcas?.nombre ?? '—'
                const categoria = det?.repuestos.categorias?.nombre ?? '—'
                const distribuidor = det?.repuestos.distribuidores?.nombre ?? ''
                const detalles = det?.repuestos.atributos ?? {}
                const extras = det ? formatearDetalles(distribuidor, detalles) : ''
                return (
                  <tr key={venta.id_venta} className="hover:bg-gray-50 transition-colors">
                    <td className="px-3 py-3 text-slate-500 whitespace-nowrap">
                      {formatFecha(venta.fecha_hora)}
                    </td>
                    <td className="px-3 py-3 font-medium text-slate-800 whitespace-nowrap">
                      {venta.alias_tecnico}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          venta.estado_pago === 'Fiado'
                            ? 'bg-orange-100 text-orange-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        {venta.estado_pago}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-slate-700">
                      {categoria}
                    </td>
                    <td className="px-3 py-3">
                      {det ? (
                        <>
                          <span className="font-medium text-slate-800">
                            {marca} {modelo}
                          </span>
                          {extras && (
                            <p className="text-xs text-gray-500 mt-0.5">
                              [{extras}]
                            </p>
                          )}
                        </>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center font-medium text-slate-800">
                      {det?.cantidad ?? '—'}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <span className="font-bold text-slate-800 whitespace-nowrap">
                        $ {venta.total.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setDevolviendo(venta)}
                          title="Devolver pieza en buen estado a stock"
                          className="rounded-lg border border-blue-300 px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                        >
                          Devolver
                        </button>
                        <button
                          onClick={() => setLiquidando(venta)}
                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors cursor-pointer"
                        >
                          Liquidar
                        </button>
                        <button
                          onClick={() => setGarantia(venta)}
                          title="Devolución / Garantía"
                          className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600 transition-colors cursor-pointer"
                        >
                          🛡️
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
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

      {garantia && (
        <ModalGarantiaCliente
          venta={garantia}
          onClose={() => setGarantia(null)}
          onSuccess={() => {
            setGarantia(null)
            cargarVentas()
          }}
        />
      )}
    </section>
  )
}
