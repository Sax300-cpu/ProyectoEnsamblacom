import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { VentaConDetalles } from '../types/database'
import { generarReciboVenta } from '../utils/generadorPDF'

type FiltroTiempo = 'Hoy' | 'Semana' | 'Mes'

interface FilaVenta {
  id_venta: string
  categoria: string
  marca: string
  modelo: string
  cantidad: number
  total: number
  metodoPago: string
  numeroComprobante: string | null
  estadoPago: string
  alias: string
  fecha: string
  precioUnitario: number
}

interface TopItem {
  id_repuesto: number
  categoria: string
  marca: string
  modelo: string
  cantidad: number
  total: number
}

export function Reportes() {
  const [filtroTiempo, setFiltroTiempo] = useState<FiltroTiempo>('Hoy')
  const [vistaActiva, setVistaActiva] = useState<'top10' | 'historial'>('top10')
  const [ventas, setVentas] = useState<VentaConDetalles[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const now = new Date()
    const y = now.getFullYear()
    const m = now.getMonth()
    const d = now.getDate()

    const localEnd = new Date(y, m, d, 23, 59, 59, 999)

    let localStart: Date
    switch (filtroTiempo) {
      case 'Hoy':
        localStart = new Date(y, m, d, 0, 0, 0, 0)
        break
      case 'Semana':
        localStart = new Date(y, m, d - 6, 0, 0, 0, 0)
        break
      case 'Mes':
        localStart = new Date(y, m, d - 29, 0, 0, 0, 0)
        break
    }

    const fetchData = async () => {
      setIsLoading(true)
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
        .gte('fecha_hora', localStart.toISOString())
        .lte('fecha_hora', localEnd.toISOString())
        .order('fecha_hora', { ascending: false })

      if (data) {
        const ventasData = data as unknown as VentaConDetalles[]
        setVentas(ventasData)
      } else {
        setVentas([])
      }

      setIsLoading(false)
    }

    fetchData()
  }, [filtroTiempo])

  const metricas = (() => {
    let ingresosTotales = 0
    let efectivoCaja = 0
    let totalTransferencias = 0
    let dineroCalle = 0

    for (const v of ventas) {
      if (v.estado_pago === 'Pagado') {
        ingresosTotales += v.total
        if (v.metodo_pago === 'Efectivo') efectivoCaja += v.total
        else if (v.metodo_pago === 'Transferencia') totalTransferencias += v.total
      } else if (v.estado_pago === 'Fiado' || v.estado_pago === 'A Prueba') {
        dineroCalle += v.total
      }
    }

    return { ingresosTotales, efectivoCaja, totalTransferencias, dineroCalle }
  })()

  const filasVenta: FilaVenta[] = (() => {
    const result: FilaVenta[] = []

    for (const v of ventas) {
      if (v.estado_pago !== 'Pagado') continue
      const det = v.detalles_venta[0]
      if (!det) continue

      result.push({
        id_venta: v.id_venta,
        categoria: det.repuestos.categorias?.nombre ?? '—',
        marca: det.repuestos.modelos?.marcas?.nombre ?? '—',
        modelo: det.repuestos.modelos?.nombre ?? '—',
        cantidad: det.cantidad,
        total: v.total,
        metodoPago: v.metodo_pago ?? '—',
        numeroComprobante: v.numero_comprobante ?? null,
        estadoPago: v.estado_pago,
        alias: v.alias_tecnico,
        fecha: new Date(v.fecha_hora).toLocaleDateString('es-PE', {
          year: 'numeric', month: 'long', day: 'numeric',
          hour: '2-digit', minute: '2-digit',
        }),
        precioUnitario: det.precio_unitario,
      })
    }

    return result
  })()

  const top10: TopItem[] = (() => {
    const map = new Map<number, Omit<TopItem, 'id_repuesto'>>()

    for (const v of ventas) {
      if (v.estado_pago !== 'Pagado') continue
      for (const det of v.detalles_venta) {
        const id = det.id_repuesto
        const categoria = det.repuestos.categorias?.nombre ?? ''
        const marca = det.repuestos.modelos?.marcas?.nombre ?? ''
        const modelo = det.repuestos.modelos?.nombre ?? ''

        const entry = map.get(id)
        if (entry) {
          entry.cantidad += det.cantidad
          entry.total += det.subtotal
        } else {
          map.set(id, { categoria, marca, modelo, cantidad: det.cantidad, total: det.subtotal })
        }
      }
    }

    return Array.from(map.entries())
      .map(([id_repuesto, d]) => ({ id_repuesto, ...d }))
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 10)
  })()

  if (isLoading) {
    return (
      <div className="flex justify-center py-12 text-slate-500 text-sm">
        Cargando…
      </div>
    )
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="text-2xl font-semibold text-slate-800">
          Cierre de Caja y Reportes
        </h2>
        <select
          value={filtroTiempo}
          onChange={(e) => setFiltroTiempo(e.target.value as FiltroTiempo)}
          className="w-full sm:w-44 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="Hoy">Hoy</option>
          <option value="Semana">Últimos 7 días</option>
          <option value="Mes">Últimos 30 días</option>
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
            Ingresos Totales
          </p>
          <p className="text-2xl font-bold text-emerald-800 font-mono">
            $ {metricas.ingresosTotales.toFixed(2)}
          </p>
        </div>

        <div className="rounded-xl border border-green-200 bg-green-50 p-5 space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-green-600">
            Efectivo en Caja
          </p>
          <p className="text-2xl font-bold text-green-800 font-mono">
            $ {metricas.efectivoCaja.toFixed(2)}
          </p>
        </div>

        <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
            Total Transferencias
          </p>
          <p className="text-2xl font-bold text-blue-800 font-mono">
            $ {metricas.totalTransferencias.toFixed(2)}
          </p>
        </div>

        <div className="rounded-xl border border-orange-200 bg-orange-50 p-5 space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-orange-600">
            Dinero en la Calle
          </p>
          <p className="text-2xl font-bold text-orange-800 font-mono">
            $ {metricas.dineroCalle.toFixed(2)}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-6">
            <h3 className="text-base font-semibold text-slate-800">
              Ventas del Periodo
            </h3>
            <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
              <button
                onClick={() => setVistaActiva('top10')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors cursor-pointer ${
                  vistaActiva === 'top10'
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Top 10 Más Vendidos
              </button>
              <button
                onClick={() => setVistaActiva('historial')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors cursor-pointer ${
                  vistaActiva === 'historial'
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Historial Completo
              </button>
            </div>
          </div>
        </div>

        {vistaActiva === 'top10' ? (
          top10.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-slate-500">
              No hay ventas registradas en este período.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-500 text-xs uppercase tracking-wide">
                    <th className="text-left px-5 py-3 font-medium w-8">#</th>
                    <th className="text-left px-5 py-3 font-medium">CATEGORÍA</th>
                    <th className="text-left px-5 py-3 font-medium">MODELO</th>
                    <th className="text-center px-5 py-3 font-medium w-20">CANTIDAD</th>
                    <th className="text-right px-5 py-3 font-medium w-28">TOTAL</th>
                  </tr>
                </thead>
                <tbody>
                  {top10.map((item, idx) => (
                    <tr
                      key={item.id_repuesto}
                      className="border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors"
                    >
                      <td className="px-5 py-3 text-slate-400 font-mono">{idx + 1}</td>
                      <td className="px-5 py-3 text-slate-700">{item.categoria}</td>
                      <td className="px-5 py-3 font-medium text-slate-800">
                        {item.marca} {item.modelo}
                      </td>
                      <td className="px-5 py-3 text-center font-mono text-slate-700">{item.cantidad}</td>
                      <td className="px-5 py-3 text-right font-bold text-slate-800 whitespace-nowrap">
                        $ {item.total.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : filasVenta.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-slate-500">
            No hay ventas registradas en este período.
          </div>
        ) : (
          <div className="overflow-x-auto max-h-96 overflow-y-auto relative">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white z-10">
                <tr className="border-b border-slate-100 text-slate-500 text-xs uppercase tracking-wide">
                  <th className="text-left px-5 py-3 font-medium w-8">#</th>
                  <th className="text-left px-5 py-3 font-medium">CATEGORÍA</th>
                  <th className="text-left px-5 py-3 font-medium">MODELO</th>
                  <th className="text-center px-5 py-3 font-medium w-20">CANT</th>
                  <th className="text-center px-5 py-3 font-medium w-24">PAGO</th>
                  <th className="text-right px-5 py-3 font-medium w-28">TOTAL</th>
                  <th className="text-center px-5 py-3 font-medium w-24">ACCIONES</th>
                </tr>
              </thead>
              <tbody>
                {filasVenta.map((fila, idx) => (
                  <tr
                    key={fila.id_venta}
                    className="border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors"
                  >
                    <td className="px-5 py-3 text-slate-400 font-mono">{idx + 1}</td>
                    <td className="px-5 py-3 text-slate-700">{fila.categoria}</td>
                    <td className="px-5 py-3 font-medium text-slate-800">
                      {fila.marca} {fila.modelo}
                    </td>
                    <td className="px-5 py-3 text-center font-mono text-slate-700">{fila.cantidad}</td>
                    <td className="px-5 py-3 text-center text-slate-600">
                      {fila.metodoPago}
                      {fila.metodoPago === 'Transferencia' && fila.numeroComprobante && (
                        <span className="block text-xs text-gray-500 mt-0.5">
                          Ref: {fila.numeroComprobante}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right font-bold text-slate-800 whitespace-nowrap">
                      $ {fila.total.toFixed(2)}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <button
                        onClick={() =>
                          generarReciboVenta({
                            tituloDocumento:
                              fila.estadoPago === 'Fiado' || fila.estadoPago === 'A Prueba'
                                ? 'COMPROBANTE DE CRÉDITO'
                                : 'COMPROBANTE DE VENTA',
                            nombreCliente: fila.alias,
                            fecha: fila.fecha,
                            detallesRepuesto: [
                              {
                                categoria: fila.categoria,
                                marca: fila.marca,
                                modelo: fila.modelo,
                                cantidad: fila.cantidad,
                                precioUnitario: fila.precioUnitario,
                                subtotal: fila.total,
                              },
                            ],
                            total: fila.total,
                          })
                        }
                        className="text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline transition-colors cursor-pointer"
                      >
                        Ver PDF
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}
