import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { VentaConDetalles } from '../types/database'
import { generarReciboVenta, generarReportePeriodoPDF } from '../utils/generadorPDF'
import { formatearFechaComprobante } from '../lib/format'
import { useAuth } from '../contexts/AuthContext'
import { toast } from '../components/Toaster'

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
  montoEfectivo: number
  montoTransferencia: number
  ventaOriginal: VentaConDetalles
  cantidadDevuelta: number
  montoDevueltoEfectivo: number
  montoDevueltoTransferencia: number
}

interface TopItem {
  id_repuesto: number
  categoria: string
  marca: string
  modelo: string
  cantidad: number
  total: number
}

// Reconstruye los ítems del ticket tal cual se vendieron en el carrito,
// a partir de la venta original completa (todos sus detalles_venta).
function detallesParaRecibo(venta: VentaConDetalles) {
  return venta.detalles_venta.map((det) => ({
    categoria: det.repuestos.categorias?.nombre ?? '—',
    marca: det.repuestos.modelos?.marcas?.nombre ?? '—',
    modelo: det.repuestos.modelos?.nombre ?? '—',
    cantidad: det.cantidad,
    precioUnitario: det.precio_unitario,
    subtotal: det.subtotal,
  }))
}

function ModalDevolucion({
  venta,
  onClose,
  onSuccess,
}: {
  venta: VentaConDetalles
  onClose: () => void
  onSuccess: () => void
}) {
  const [cantidades, setCantidades] = useState<Record<number, number>>({})
  const [reembolsoEfectivo, setReembolsoEfectivo] = useState('')
  const [reembolsoTransferencia, setReembolsoTransferencia] = useState('')
  const [enviando, setEnviando] = useState(false)

  const detalles = venta.detalles_venta
  const itemsSeleccionados = detalles.filter((d) => (cantidades[d.id_detalle] ?? 0) > 0)
  const totalDevolver = itemsSeleccionados.reduce(
    (sum, d) => sum + (cantidades[d.id_detalle] ?? 0) * d.precio_unitario,
    0,
  )
  const reembolsoValido =
    Math.round((Number(reembolsoEfectivo) + Number(reembolsoTransferencia)) * 100) ===
    Math.round(totalDevolver * 100)

  const setCantidad = (id: number, max: number, valor: number) => {
    const v = Math.min(max, Math.max(0, valor))
    setCantidades((prev) => ({ ...prev, [id]: v }))
  }

  const handleConfirm = async () => {
    if (itemsSeleccionados.length === 0 || !reembolsoValido) return
    setEnviando(true)
    try {
      const montoEfectivo = Number(reembolsoEfectivo) || 0
      const montoTransferencia = Number(reembolsoTransferencia) || 0

      // a) Incrementar cantidad_devuelta por cada ítem seleccionado.
      for (const d of itemsSeleccionados) {
        const cantidad = cantidades[d.id_detalle] ?? 0
        const { error: errDet } = await supabase
          .from('detalles_venta')
          .update({ cantidad_devuelta: (d.cantidad_devuelta ?? 0) + cantidad })
          .eq('id_detalle', d.id_detalle)
        if (errDet) throw errDet
      }

      // b) Reponer stock, agrupando por repuesto para no escribir dos veces el mismo.
      const cantidadPorRepuesto = new Map<number, number>()
      for (const d of itemsSeleccionados) {
        const cantidad = cantidades[d.id_detalle] ?? 0
        cantidadPorRepuesto.set(
          d.id_repuesto,
          (cantidadPorRepuesto.get(d.id_repuesto) ?? 0) + cantidad,
        )
      }
      for (const [idRepuesto, cantidad] of cantidadPorRepuesto) {
        const { data: rep, error: errRep } = await supabase
          .from('repuestos')
          .select('stock')
          .eq('id_repuesto', idRepuesto)
          .single()
        if (errRep) throw errRep
        const { error: errStock } = await supabase
          .from('repuestos')
          .update({ stock: (rep?.stock ?? 0) + cantidad })
          .eq('id_repuesto', idRepuesto)
        if (errStock) throw errStock
      }

      // c) Sumar los montos devueltos según el origen elegido.
      const { data: ventaRow, error: errVenta } = await supabase
        .from('ventas')
        .select('monto_devuelto_efectivo, monto_devuelto_transferencia')
        .eq('id_venta', venta.id_venta)
        .single()
      if (errVenta) throw errVenta
      const { error: errMonto } = await supabase
        .from('ventas')
        .update({
          monto_devuelto_efectivo: (ventaRow?.monto_devuelto_efectivo ?? 0) + montoEfectivo,
          monto_devuelto_transferencia:
            (ventaRow?.monto_devuelto_transferencia ?? 0) + montoTransferencia,
        })
        .eq('id_venta', venta.id_venta)
      if (errMonto) throw errMonto

      toast.success(`Devolución registrada: $ ${totalDevolver.toFixed(2)} reembolsados`)
      onSuccess()
    } catch (error) {
      console.error('Error en devolución:', error)
      toast.error(
        'Error al procesar la devolución: ' +
          ((error as Error).message || JSON.stringify(error)),
      )
      setEnviando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-slate-800">Devolución de Venta</h3>
        <p className="text-sm text-slate-600">
          Cliente: <span className="font-medium text-slate-800">{venta.alias_tecnico}</span>
        </p>

        <div className="rounded-lg border border-slate-200 divide-y divide-slate-100 max-h-60 overflow-y-auto">
          {detalles.map((det) => {
            const devueltoPrevio = det.cantidad_devuelta ?? 0
            const maxDevolver = det.cantidad - devueltoPrevio
            const agotado = maxDevolver <= 0
            const categoria = det.repuestos.categorias?.nombre ?? '—'
            const marca = det.repuestos.modelos?.marcas?.nombre ?? '—'
            const modelo = det.repuestos.modelos?.nombre ?? '—'
            return (
              <div
                key={det.id_detalle}
                className={`px-3 py-2 ${agotado ? 'opacity-60' : ''}`}
              >
                <div className="flex items-center gap-2">
                  <span className="flex-1 truncate text-sm text-slate-700">
                    {det.cantidad}x {categoria} {marca} {modelo}
                  </span>
                  <span className="text-xs text-slate-500 whitespace-nowrap">
                    $ {det.precio_unitario.toFixed(2)} c/u
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  {devueltoPrevio > 0 && (
                    <span className="text-xs text-slate-500">Ya devuelto: {devueltoPrevio}</span>
                  )}
                  {agotado ? (
                    <span className="ml-auto rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-xs font-semibold whitespace-nowrap">
                      Devuelto
                    </span>
                  ) : (
                    <label className="ml-auto flex items-center gap-1 text-xs text-slate-500">
                      Devolver
                      <input
                        type="number"
                        min={0}
                        max={maxDevolver}
                        value={cantidades[det.id_detalle] ?? 0}
                        disabled={enviando}
                        onChange={(e) =>
                          setCantidad(det.id_detalle, maxDevolver, Number(e.target.value) || 0)
                        }
                        className="w-16 rounded-lg border border-slate-300 px-2 py-1 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50"
                      />
                    </label>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-slate-700">
            Total a devolver ({itemsSeleccionados.length} ítem
            {itemsSeleccionados.length === 1 ? '' : 's'})
          </span>
          <span className="text-base font-bold text-red-600 font-mono">
            $ {totalDevolver.toFixed(2)}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-600">
              Reembolsar de Efectivo ($)
            </label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={reembolsoEfectivo}
              disabled={enviando}
              onChange={(e) => setReembolsoEfectivo(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-600">
              Reembolsar de Transferencia ($)
            </label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={reembolsoTransferencia}
              disabled={enviando}
              onChange={(e) => setReembolsoTransferencia(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50"
            />
          </div>
        </div>
        {!reembolsoValido && totalDevolver > 0 && (
          <p className="text-xs text-red-600">
            La suma de Efectivo + Transferencia debe ser $ {totalDevolver.toFixed(2)}
          </p>
        )}

        <div className="flex justify-end gap-3 pt-1">
          <button
            onClick={onClose}
            disabled={enviando}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={enviando || itemsSeleccionados.length === 0 || !reembolsoValido}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition-colors cursor-pointer"
          >
            {enviando ? 'Procesando…' : `Devolver $ ${totalDevolver.toFixed(2)}`}
          </button>
        </div>
      </div>
    </div>
  )
}

export function Reportes() {
  const { isAdmin } = useAuth()
  const [fechaInicio, setFechaInicio] = useState(hoyISO())
  const [fechaFin, setFechaFin] = useState(hoyISO())
  const [vistaActiva, setVistaActiva] = useState<'top10' | 'historial' | 'cobros'>('top10')
  const [ventas, setVentas] = useState<VentaConDetalles[]>([])
  const [deudaGlobal, setDeudaGlobal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [busquedaHistorial, setBusquedaHistorial] = useState('')
  const [devolviendo, setDevolviendo] = useState<VentaConDetalles | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

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
      // sin importar cuándo se vendió la venta padre. Se anida la venta padre con TODOS
      // sus detalles para poder reconstruir el ticket completo de deudas antiguas.
      const queryDetalles = supabase
        .from('detalles_venta')
        .select(`*, ${relacionesRepuestos}, ventas(*, detalles_venta(*, ${relacionesRepuestos}))`)
        .eq('estado_item', 'Liquidado')
        .gte('fecha_pago_item', inicioISO)
        .lte('fecha_pago_item', finISO)
        .order('fecha_pago_item', { ascending: false })

      const [resVentas, resDetalles] = await Promise.all([queryVentas, queryDetalles])

      const ventasDirectas = (resVentas.data ?? []) as unknown as VentaConDetalles[]
      const detallesCobrados = (resDetalles.data ?? []) as unknown as Array<
        VentaConDetalles['detalles_venta'][number] & { ventas: VentaConDetalles }
      >

      // Unificación: el Query 2 ahora anida la venta padre con TODOS sus detalles,
      // así que basta con incorporarla íntegra al mapa (sin duplicar) cuando aún no está.
      const mapa = new Map<number, VentaConDetalles>()
      for (const v of ventasDirectas) mapa.set(v.id_venta, v)
      for (const detRaw of detallesCobrados) {
        const ventaPadre = detRaw.ventas
        if (ventaPadre && !mapa.has(ventaPadre.id_venta)) {
          mapa.set(ventaPadre.id_venta, ventaPadre)
        }
      }

      const ventasUnificadas = Array.from(mapa.values())

      setVentas(ventasUnificadas)
      setIsLoading(false)
    }

    fetchData()
  }, [fechaInicio, fechaFin, refreshKey])

  useEffect(() => {
    supabase
      .from('ventas')
      .select('total, monto_devuelto_efectivo, monto_devuelto_transferencia')
      .in('estado_pago', ['Fiado', 'A Prueba'])
      .then(({ data }) => {
        const total = (data ?? []).reduce(
          (sum, v) =>
            sum +
            parseFloat(String(v.total ?? 0) || '0') -
            (parseFloat(String(v.monto_devuelto_efectivo ?? 0) || '0') +
              parseFloat(String(v.monto_devuelto_transferencia ?? 0) || '0')),
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
      montoEfectivo: number
      montoTransferencia: number
      ventaOriginal: VentaConDetalles
      cantidadDevuelta: number
      montoDevueltoEfectivo: number
      montoDevueltoTransferencia: number
    }

    const tx: Tx[] = []

    // Query 1 — Ventas directas: pagadas al momento.
    // Una fila por ÍTEM vendido (para que el historial y el PDF muestren todos los
    // repuestos de una misma venta). Los montos de efectivo/transferencia de la venta
    // se reparten proporcionalmente entre sus ítems para no duplicar el total de la factura.
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

      const sumaSubtotales = v.detalles_venta.reduce(
        (sum, d) => sum + (d.subtotal ?? d.precio_unitario * d.cantidad),
        0,
      )
      let montoEfectivoVenta = parseFloat(String(v.monto_efectivo ?? 0) || '0')
      let montoTransferenciaVenta = parseFloat(String(v.monto_transferencia ?? 0) || '0')

      // Respaldo histórico: registros previos al cambio de BD (columnas en 0),
      // o ventas 100% efectivo/transferencia que nunca llenaron el desglose.
      if (montoEfectivoVenta === 0 && montoTransferenciaVenta === 0) {
        if (v.metodo_pago === 'Efectivo') montoEfectivoVenta = parseFloat(String(v.total ?? 0) || '0')
        if (v.metodo_pago === 'Transferencia') montoTransferenciaVenta = parseFloat(String(v.total ?? 0) || '0')
      }

      // Devoluciones de la venta (se reparten proporcionalmente entre sus ítems).
      const montoDevueltoEfectivoVenta = parseFloat(String(v.monto_devuelto_efectivo ?? 0) || '0')
      const montoDevueltoTransferenciaVenta = parseFloat(
        String(v.monto_devuelto_transferencia ?? 0) || '0',
      )

      for (const det of v.detalles_venta) {
        const subtotalDetalle = det.subtotal ?? det.precio_unitario * det.cantidad
        const proporcion =
          sumaSubtotales > 0 ? subtotalDetalle / sumaSubtotales : 1 / v.detalles_venta.length

        tx.push({
          id: `v-${v.id_venta}-${det.id_detalle}`,
          fechaISO,
          fechaCobroISO: null,
          categoria: det.repuestos.categorias?.nombre ?? '—',
          marca: det.repuestos.modelos?.marcas?.nombre ?? '—',
          modelo: det.repuestos.modelos?.nombre ?? '—',
          cantidad: det.cantidad,
          monto: subtotalDetalle,
          metodo: v.metodo_pago ?? '—',
          referencia: v.numero_comprobante ?? null,
          estadoPago: v.estado_pago,
          alias: v.alias_tecnico,
          precioUnitario: det.precio_unitario,
          montoEfectivo: montoEfectivoVenta * proporcion,
          montoTransferencia: montoTransferenciaVenta * proporcion,
          ventaOriginal: v,
          cantidadDevuelta: det.cantidad_devuelta ?? 0,
          montoDevueltoEfectivo: montoDevueltoEfectivoVenta * proporcion,
          montoDevueltoTransferencia: montoDevueltoTransferenciaVenta * proporcion,
        })
      }
    }

    // Query 2 — Cobros diferidos: ítems liquidados (una fila por ítem, monto = detalle.subtotal).
    // Las devoluciones de la venta se reparten proporcionalmente entre sus ítems liquidados.
    for (const v of ventas) {
      const itemsLiquidados = v.detalles_venta.filter(
        (det) => det.estado_item === 'Liquidado' && enRango(det.fecha_pago_item),
      )
      if (itemsLiquidados.length === 0) continue

      const sumaLiquidados = itemsLiquidados.reduce((sum, det) => sum + det.subtotal, 0)
      const montoDevueltoEfectivoVenta = parseFloat(String(v.monto_devuelto_efectivo ?? 0) || '0')
      const montoDevueltoTransferenciaVenta = parseFloat(
        String(v.monto_devuelto_transferencia ?? 0) || '0',
      )

      for (const det of itemsLiquidados) {
        const proporcion =
          sumaLiquidados > 0 ? det.subtotal / sumaLiquidados : 1 / itemsLiquidados.length

        let montoEfectivoItem = parseFloat(String(det.monto_efectivo_item ?? 0) || '0')
        let montoTransferenciaItem = parseFloat(String(det.monto_transferencia_item ?? 0) || '0')

        // Respaldo histórico para cobros de registros previos al cambio de BD.
        if (montoEfectivoItem === 0 && montoTransferenciaItem === 0) {
          if (det.metodo_pago_item === 'Efectivo') montoEfectivoItem = det.subtotal
          if (det.metodo_pago_item === 'Transferencia') montoTransferenciaItem = det.subtotal
        }

        tx.push({
          id: `d-${v.id_venta}-${det.id_detalle}`,
          fechaISO: det.fecha_pago_item!,
          fechaCobroISO: det.fecha_pago_item ?? null,
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
          montoEfectivo: montoEfectivoItem,
          montoTransferencia: montoTransferenciaItem,
          ventaOriginal: v,
          cantidadDevuelta: det.cantidad_devuelta ?? 0,
          montoDevueltoEfectivo: montoDevueltoEfectivoVenta * proporcion,
          montoDevueltoTransferencia: montoDevueltoTransferenciaVenta * proporcion,
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
        montoEfectivo: t.montoEfectivo,
        montoTransferencia: t.montoTransferencia,
        ventaOriginal: t.ventaOriginal,
        cantidadDevuelta: t.cantidadDevuelta,
        montoDevueltoEfectivo: t.montoDevueltoEfectivo,
        montoDevueltoTransferencia: t.montoDevueltoTransferencia,
      }))

    return resultado
  })()

  const metricas = (() => {
    let ingresosTotales = 0
    let efectivoCaja = 0
    let totalTransferencias = 0

    const sinMilisegundos = (iso: string) => iso.replace(/\.\d{3}Z$/, 'Z')
    const inicioISO = sinMilisegundos(new Date(`${fechaInicio}T00:00:00`).toISOString())
    const finISO = sinMilisegundos(new Date(`${fechaFin}T23:59:59`).toISOString())
    const enRango = (iso?: string | null) => !!iso && iso >= inicioISO && iso <= finISO

    // 1. Ventas directas del período: sumar cada venta UNA sola vez (no por ítem),
    // evitando duplicar ingresos cuando una misma venta tiene varios repuestos.
    for (const v of ventas) {
      if ((v.estado_pago || '').toLowerCase() !== 'pagado') continue
      if (v.detalles_venta.some((d) => d.estado_item === 'Liquidado')) continue

      let montoEfectivoVenta = parseFloat(String(v.monto_efectivo ?? 0) || '0')
      let montoTransferenciaVenta = parseFloat(String(v.monto_transferencia ?? 0) || '0')

      // Respaldo histórico: registros previos al cambio de BD (columnas en 0),
      // o ventas 100% efectivo/transferencia que nunca llenaron el desglose.
      if (montoEfectivoVenta === 0 && montoTransferenciaVenta === 0) {
        if (v.metodo_pago === 'Efectivo') montoEfectivoVenta = parseFloat(String(v.total ?? 0) || '0')
        if (v.metodo_pago === 'Transferencia') montoTransferenciaVenta = parseFloat(String(v.total ?? 0) || '0')
      }

      // Ajuste contable: restar devoluciones por método de origen (evita saldos
      // negativos en caja al devolver ventas que fueron por transferencia).
      const montoDevueltoEfectivo = parseFloat(String(v.monto_devuelto_efectivo ?? 0) || '0')
      const montoDevueltoTransferencia = parseFloat(
        String(v.monto_devuelto_transferencia ?? 0) || '0',
      )

      ingresosTotales +=
        parseFloat(String(v.total ?? 0) || '0') -
        (montoDevueltoEfectivo + montoDevueltoTransferencia)
      efectivoCaja += montoEfectivoVenta - montoDevueltoEfectivo
      totalTransferencias += montoTransferenciaVenta - montoDevueltoTransferencia
    }

    // 2. Cobros diferidos del período: por ítem liquidado (una sola vez cada uno).
    for (const v of ventas) {
      let contoAlgunItem = false
      for (const det of v.detalles_venta) {
        if (det.estado_item !== 'Liquidado' || !enRango(det.fecha_pago_item)) continue

        let montoEfectivoItem = parseFloat(String(det.monto_efectivo_item ?? 0) || '0')
        let montoTransferenciaItem = parseFloat(String(det.monto_transferencia_item ?? 0) || '0')

        // Respaldo histórico: cobros de registros previos al cambio de BD.
        if (montoEfectivoItem === 0 && montoTransferenciaItem === 0) {
          if (det.metodo_pago_item === 'Efectivo') montoEfectivoItem = det.subtotal
          if (det.metodo_pago_item === 'Transferencia') montoTransferenciaItem = det.subtotal
        }

        ingresosTotales += det.subtotal
        efectivoCaja += montoEfectivoItem
        totalTransferencias += montoTransferenciaItem
        contoAlgunItem = true
      }
      // Restar devoluciones una sola vez por venta, por método de origen.
      if (contoAlgunItem) {
        const montoDevueltoEfectivo = parseFloat(String(v.monto_devuelto_efectivo ?? 0) || '0')
        const montoDevueltoTransferencia = parseFloat(
          String(v.monto_devuelto_transferencia ?? 0) || '0',
        )
        ingresosTotales -= montoDevueltoEfectivo + montoDevueltoTransferencia
        efectivoCaja -= montoDevueltoEfectivo
        totalTransferencias -= montoDevueltoTransferencia
      }
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
            onClick={() =>
              generarReportePeriodoPDF(
                transaccionesDelPeriodo.map((t) => ({
                  categoria: t.categoria,
                  marca: t.marca,
                  modelo: t.modelo,
                  cantidad: t.cantidad,
                  total: t.total,
                  metodoPago: t.metodoPago,
                  montoEfectivo: t.montoEfectivo,
                  montoTransferencia: t.montoTransferencia,
                  cantidadDevuelta: t.cantidadDevuelta,
                  montoDevueltoEfectivo: t.montoDevueltoEfectivo,
                  montoDevueltoTransferencia: t.montoDevueltoTransferencia,
                })),
                fechaInicio,
                fechaFin,
              )
            }
            disabled={transaccionesDelPeriodo.length === 0}
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
                    <th className="text-center px-5 py-3 font-medium w-40">ACCIONES</th>
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
                        {fila.cantidadDevuelta > 0 && (
                          <span className="ml-2 inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                            Devuelto: {fila.cantidadDevuelta}
                          </span>
                        )}
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
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() =>
                              generarReciboVenta({
                                tituloDocumento: 'COMPROBANTE DE PAGO',
                                nombreCliente: fila.alias,
                                fecha: fila.fechaCobro ?? fila.fecha,
                                detallesRepuesto: detallesParaRecibo(fila.ventaOriginal),
                                total: fila.ventaOriginal.total,
                              })
                            }
                            className="text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline transition-colors cursor-pointer"
                          >
                            Ver PDF
                          </button>
                          {isAdmin && (
                            <button
                              onClick={() => setDevolviendo(fila.ventaOriginal)}
                              className="text-xs font-medium text-red-600 border border-red-300 rounded-lg px-2 py-1 hover:bg-red-50 transition-colors cursor-pointer whitespace-nowrap"
                            >
                              Devolución
                            </button>
                          )}
                        </div>
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
                  <th className="text-center px-5 py-3 font-medium w-40">ACCIONES</th>
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
                      {fila.cantidadDevuelta > 0 && (
                        <span className="ml-2 inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                          Devuelto: {fila.cantidadDevuelta}
                        </span>
                      )}
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
                    <td className="px-5 py-3 text-right font-bold text-slate-800 whitespace-nowrap">
                      $ {fila.total.toFixed(2)}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
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
                              detallesRepuesto: detallesParaRecibo(fila.ventaOriginal),
                              total: fila.ventaOriginal.total,
                            })
                          }
                          className="text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline transition-colors cursor-pointer"
                        >
                          Ver PDF
                        </button>
                        {isAdmin && (
                          <button
                            onClick={() => setDevolviendo(fila.ventaOriginal)}
                            className="text-xs font-medium text-red-600 border border-red-300 rounded-lg px-2 py-1 hover:bg-red-50 transition-colors cursor-pointer whitespace-nowrap"
                          >
                            Devolución
                          </button>
                        )}
                      </div>
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

      {devolviendo && (
        <ModalDevolucion
          venta={devolviendo}
          onClose={() => setDevolviendo(null)}
          onSuccess={() => {
            setDevolviendo(null)
            setRefreshKey((k) => k + 1)
          }}
        />
      )}
    </section>
  )
}
