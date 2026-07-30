import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { VentaConDetalles } from '../types/database'

type FiltroTiempo = 'Hoy' | 'Semana' | 'Mes'

interface TopRepuesto {
  id_repuesto: number
  nombre: string
  cantidad: number
  total: number
}

export function Reportes() {
  const [filtroTiempo, setFiltroTiempo] = useState<FiltroTiempo>('Hoy')
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

  const topRepuestos: TopRepuesto[] = (() => {
    const map = new Map<number, { nombre: string; cantidad: number; total: number }>()

    for (const v of ventas) {
      if (v.estado_pago !== 'Pagado') continue
      for (const det of v.detalles_venta) {
        const id = det.id_repuesto
        const cat = det.repuestos.categorias?.nombre ?? ''
        const marca = det.repuestos.modelos?.marcas?.nombre ?? ''
        const modelo = det.repuestos.modelos?.nombre ?? ''
        const nombre = `${cat} ${marca} ${modelo}`.trim()

        const entry = map.get(id)
        if (entry) {
          entry.cantidad += det.cantidad
          entry.total += det.subtotal
        } else {
          map.set(id, { nombre, cantidad: det.cantidad, total: det.subtotal })
        }
      }
    }

    return Array.from(map.entries())
      .map(([id_repuesto, d]) => ({ id_repuesto, ...d }))
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 5)
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
          <h3 className="text-base font-semibold text-slate-800">
            Top 5 Repuestos más vendidos
          </h3>
        </div>
        {topRepuestos.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-slate-500">
            No hay ventas registradas en este período.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-slate-500 text-xs uppercase tracking-wide">
                  <th className="text-left px-5 py-3 font-medium">#</th>
                  <th className="text-left px-5 py-3 font-medium">Repuesto</th>
                  <th className="text-right px-5 py-3 font-medium">Cantidad</th>
                  <th className="text-right px-5 py-3 font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {topRepuestos.map((item, idx) => (
                  <tr
                    key={item.id_repuesto}
                    className="border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors"
                  >
                    <td className="px-5 py-3 text-slate-400 font-mono">{idx + 1}</td>
                    <td className="px-5 py-3 font-medium text-slate-800">{item.nombre}</td>
                    <td className="px-5 py-3 text-right font-mono text-slate-700">{item.cantidad}</td>
                    <td className="px-5 py-3 text-right font-mono font-semibold text-slate-800">
                      $ {item.total.toFixed(2)}
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
