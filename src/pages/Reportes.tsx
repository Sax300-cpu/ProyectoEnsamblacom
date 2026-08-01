import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Venta, VentaConDetalles } from '../types/database'
import { generarReciboVenta, generarReportePeriodoPDF } from '../utils/generadorPDF'
import { formatearFechaComprobante } from '../lib/format'

function hoyISO() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

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
  fechaCobro: string | null
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
  const [fechaInicio, setFechaInicio] = useState(hoyISO())
  const [fechaFin, setFechaFin] = useState(hoyISO())
  const [vistaActiva, setVistaActiva] = useState<'top10' | 'historial' | 'cobros'>('top10')
  const [ventas, setVentas] = useState<VentaConDetalles[]>([])
  const [deudaGlobal, setDeudaGlobal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [busquedaHistorial, setBusquedaHistorial] = useState('')

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      const sinMilisegundos = (iso: string) => iso.replace(/\.\d{3}Z$/, 'Z')
      const inicioISO = sinMilisegundos(new Date(`${fechaInicio}T00:00:00`).toISOString())
      const finISO = sinMilisegundos(new Date(`${fechaFin}T23:59:59`).toISOString())

      const relacionesRepuestos = `
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
      `

      // Query 1 — Ventas del período (fecha_hora en rango): las directas pagadas
      // hoy y las fiadas vendidas esta semana.
      const queryVentas = supabase
        .from('ventas')
        .select(`*, detalles_venta ( *, ${relacionesRepuestos} )`)
        .gte('fecha_hora', inicioISO)
        .lte('fecha_hora', finISO)
        .order('fecha_hora', { ascending: false })

      // Query 2 — Cobros diferidos: ítems liquidados en el período (fecha_pago_item),
      // sin importar cuándo se vendió la venta padre.
      const queryDetalles = supabase
        .from('detalles_venta')
        .select(`*, ${relacionesRepuestos}, ventas(*)`)
        .eq('estado_item', 'Liquidado')
        .gte('fecha_pago_item', inicioISO)
        .lte('fecha_pago_item', finISO)
        .order('fecha_pago_item', { ascending: false })

      const [resVentas, resDetalles] = await Promise.all([queryVentas, queryDetalles])

      const ventasDirectas = (resVentas.data ?? []) as unknown as VentaConDetalles[]
      const detallesCobrados = (resDetalles.data ?? []) as unknown as Array<
        VentaConDetalles['detalles_venta'][number] & { ventas: Venta }
      >

      // Unificación: fusionar los ítems cobrados en sus ventas padre (sin duplicar)
      const mapa = new Map<number, VentaConDetalles>()
      for (const v of ventasDirectas) mapa.set(v.id_venta, v)
      for (const detRaw of detallesCobrados) {
        if (!detRaw.ventas) continue
        const { ventas: ventaPadre, ...detalle } = detRaw
        const existente = mapa.get(ventaPadre.id_venta)
        if (existente) {
          if (!existente.detalles_venta.some((d) => d.id_detalle === detalle.id_detalle)) {
            existente.detalles_venta.push(detalle)
          }
        } else {
          mapa.set(ventaPadre.id_venta, {
            ...ventaPadre,
            detalles_venta: [detalle],
          })
        }
      }

      const ventasUnificadas = Array.from(mapa.values())

      setVentas(ventasUnificadas)
      setIsLoading(false)
    }

    fetchData()
  }, [fechaInicio, fechaFin])

  useEffect(() => {
    supabase
      .from('ventas')
      .select('total')
      .in('estado_pago', ['Fiado', 'A Prueba'])
      .then(({ data }) => {
        const total = (data ?? []).reduce(
          (sum, v) => sum + parseFloat(String(v.total ?? 0) || '0'),
          0,
        )
        setDeudaGlobal(total)
      })
  }, [])

  const transaccionesDelPeriodo: FilaVenta[] = (() => {
    const sinMilisegundos = (iso: string) => iso.replace(/\.\d{3}Z$/, 'Z')
    const inicioISO = sinMilisegundos(new Date(`${fechaInicio}T00:00:00`).toISOString())
    const finISO = sinMilisegundos(new Date(`${fechaFin}T23:59:59`).toISOString())
    const enRango = (iso?: string | null) => !!iso && iso >= inicioISO && iso <= finISO

    interface Tx {
      id: string
      fechaISO: string
      fechaCobroISO: string | null
      categoria: string
      marca: string
      modelo: string
      cantidad: number
      monto: number
      metodo: string
      referencia: string | null
      estadoPago: string
      alias: string
      precioUnitario: number
    }

    const tx: Tx[] = []

    // Query 1 — Ventas directas: pagadas al momento (una fila por venta, monto = venta.total)
    for (const v of ventas) {
      if ((v.estado_pago || '').toLowerCase() !== 'pagado') continue
      // Si la venta tiene ítems 'Liquidado', su ingreso ya se cuenta por ítem (Query 2):
      // no duplicar montos.
      if (v.detalles_venta.some((d) => d.estado_item === 'Liquidado')) continue

      const fechaISO = enRango(v.fecha_hora)
        ? v.fecha_hora
        : enRango(v.fecha_cobro)
          ? v.fecha_cobro!
          : null
      if (!fechaISO) continue

      const det = v.detalles_venta[0]
      if (!det) continue

      tx.push({
        id: `v-${v.id_venta}`,
        fechaISO,
        fechaCobroISO: null,
        categoria: det.repuestos.categorias?.nombre ?? '—',
        marca: det.repuestos.modelos?.marcas?.nombre ?? '—',
        modelo: det.repuestos.modelos?.nombre ?? '—',
        cantidad: det.cantidad,
        monto: v.total,
        metodo: v.metodo_pago ?? '—',
        referencia: v.numero_comprobante ?? null,
        estadoPago: v.estado_pago,
        alias: v.alias_tecnico,
        precioUnitario: det.precio_unitario,
      })
    }

    // Query 2 — Cobros diferidos: ítems liquidados (una fila por ítem, monto = detalle.subtotal)
    for (const v of ventas) {
      for (const det of v.detalles_venta) {
        if (det.estado_item !== 'Liquidado' || !enRango(det.fecha_pago_item)) continue

        tx.push({
          id: `d-${v.id_venta}-${det.id_detalle}`,
          fechaISO: det.fecha_pago_item!,
          fechaCobroISO: det.fecha_pago_item,
          categoria: det.repuestos.categorias?.nombre ?? '—',
          marca: det.repuestos.modelos?.marcas?.nombre ?? '—',
          modelo: det.repuestos.modelos?.nombre ?? '—',
          cantidad: det.cantidad,
          monto: det.subtotal,
          metodo: det.metodo_pago_item ?? '—',
          referencia: det.referencia_item ?? null,
          estadoPago: v.estado_pago,
          alias: v.alias_tecnico,
          precioUnitario: det.precio_unitario,
        })
      }
    }

    const resultado = tx
      .sort((a, b) => b.fechaISO.localeCompare(a.fechaISO))
      .map((t) => ({
        id_venta: t.id,
        categoria: t.categoria,
        marca: t.marca,
        modelo: t.modelo,
        cantidad: t.cantidad,
        total: t.monto,
        metodoPago: t.metodo,
        numeroComprobante: t.referencia,
        estadoPago: t.estadoPago,
        alias: t.alias,
        fecha: formatearFechaComprobante(t.fechaISO) ?? '—',
        fechaCobro: formatearFechaComprobante(t.fechaCobroISO),
        precioUnitario: t.precioUnitario,
      }))

    return resultado
  })()

  const metricas = (() => {
    let ingresosTotales = 0
    let efectivoCaja = 0
    let totalTransferencias = 0

    for (const t of transaccionesDelPeriodo) {
      ingresosTotales += t.total
      const m = (t.metodoPago || '').toLowerCase()
      if (m === 'efectivo') efectivoCaja += t.total
      else if (m === 'transferencia') totalTransferencias += t.total
    }

    return { ingresosTotales, efectivoCaja, totalTransferencias }
  })()

  const busquedaNormalizada = busquedaHistorial.trim().toLowerCase()

  const filasHistorialFiltradas = busquedaNormalizada
    ? transaccionesDelPeriodo.filter(
        (fila) =>
          fila.categoria.toLowerCase().includes(busquedaNormalizada) ||
          fila.modelo.toLowerCase().includes(busquedaNormalizada) ||
          fila.alias.toLowerCase().includes(busquedaNormalizada),
      )
    : transaccionesDelPeriodo

  const filasCobro = transaccionesDelPeriodo.filter((fila) => fila.fechaCobro)

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
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <span className="font-medium">Desde</span>
            <input
              type="date"
              value={fechaInicio}
              max={fechaFin}
              onChange={(e) => setFechaInicio(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <span className="font-medium">Hasta</span>
            <input
              type="date"
              value={fechaFin}
              min={fechaInicio}
              onChange={(e) => setFechaFin(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </label>
          <button
            onClick={() => generarReportePeriodoPDF(ventas, fechaInicio, fechaFin)}
            disabled={ventas.length === 0}
            className="flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50 transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Descargar Reporte PDF
          </button>
        </div>
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
            Cuentas por Cobrar
          </p>
          <p className="text-2xl font-bold text-orange-800 font-mono">
            $ {deudaGlobal.toFixed(2)}
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
              <button
                onClick={() => setVistaActiva('cobros')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors cursor-pointer ${
                  vistaActiva === 'cobros'
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Cobros Realizados
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
        ) : vistaActiva === 'cobros' ? (
          filasCobro.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-slate-500">
              No hay cobros realizados en este período.
            </div>
          ) : (
            <div className="overflow-x-auto max-h-96 overflow-y-auto relative">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white z-10">
                  <tr className="border-b border-slate-100 text-slate-500 text-xs uppercase tracking-wide">
                    <th className="text-left px-5 py-3 font-medium w-8">#</th>
                    <th className="text-left px-5 py-3 font-medium">FECHA</th>
                    <th className="text-left px-5 py-3 font-medium">CATEGORÍA</th>
                    <th className="text-left px-5 py-3 font-medium">MODELO</th>
                    <th className="text-center px-5 py-3 font-medium w-16">CANT</th>
                    <th className="text-center px-5 py-3 font-medium w-24">PAGO</th>
                    <th className="text-left px-5 py-3 font-medium">FECHA DE COBRO</th>
                    <th className="text-right px-5 py-3 font-medium w-28">TOTAL</th>
                    <th className="text-center px-5 py-3 font-medium w-24">ACCIONES</th>
                  </tr>
                </thead>
                <tbody>
                  {filasCobro.map((fila, idx) => (
                    <tr
                      key={fila.id_venta}
                      className="border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors"
                    >
                      <td className="px-5 py-3 text-slate-400 font-mono">{idx + 1}</td>
                      <td className="px-5 py-3 text-slate-600">{fila.fecha}</td>
                      <td className="px-5 py-3 text-slate-700">{fila.categoria}</td>
                      <td className="px-5 py-3 font-medium text-slate-800">
                        {fila.marca} {fila.modelo}
                      </td>
                      <td className="px-5 py-3 text-center font-mono text-slate-700">{fila.cantidad}</td>
                      <td className="px-5 py-3 text-center text-slate-600">
                        {fila.metodoPago}
                        {fila.numeroComprobante && (
                          <span className="block text-xs text-gray-500 mt-0.5">
                            Ref: {fila.numeroComprobante}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-slate-600">{fila.fechaCobro ?? '---'}</td>
                      <td className="px-5 py-3 text-right font-bold text-slate-800 whitespace-nowrap">
                        $ {fila.total.toFixed(2)}
                      </td>
                      <td className="px-5 py-3 text-center">
                        <button
                          onClick={() =>
                            generarReciboVenta({
                              tituloDocumento: 'COMPROBANTE DE PAGO',
                              nombreCliente: fila.alias,
                              fecha: fila.fechaCobro ?? fila.fecha,
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
          )
        ) : (
          <>
            <div className="px-5 pt-4">
              <input
                type="text"
                value={busquedaHistorial}
                onChange={(e) => setBusquedaHistorial(e.target.value)}
                placeholder="Buscar por categoría, modelo o cliente..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {filasHistorialFiltradas.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-slate-500">
                {busquedaHistorial.trim()
                  ? 'No se encontraron ventas con ese criterio.'
                  : 'No hay ventas registradas en este período.'}
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
                {filasHistorialFiltradas.map((fila, idx) => (
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
                              fila.fechaCobro
                                ? 'COMPROBANTE DE PAGO'
                                : fila.estadoPago === 'Fiado' || fila.estadoPago === 'A Prueba'
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
          </>
        )}
      </div>
    </section>
  )
}
