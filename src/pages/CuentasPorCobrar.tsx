import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { VentaConDetalles, MetodoPago } from '../types/database'
import { formatearDetalles, formatearFechaComprobante } from '../lib/format'
import { LiquidarModal } from '../components/LiquidarModal'
import { ModalGarantiaCliente } from '../components/ModalGarantiaCliente'
import { generarTicketCobroLote } from '../utils/generadorPDF'
import { toast } from '../components/Toaster'

type DetalleDeuda = VentaConDetalles['detalles_venta'][number]
type FilaDeuda = VentaConDetalles & { detalle_enfocado: DetalleDeuda }
type TabInterna = 'Pendientes' | 'Historial'

interface GrupoCliente {
  cliente: string
  itemsPendientes: FilaDeuda[]
  itemsHistorial: FilaDeuda[]
  deudaActiva: number
}

function agruparPorCliente(ventas: VentaConDetalles[]): GrupoCliente[] {
  const mapa = new Map<string, VentaConDetalles[]>()
  for (const v of ventas) {
    const arr = mapa.get(v.alias_tecnico) ?? []
    arr.push(v)
    mapa.set(v.alias_tecnico, arr)
  }

  const grupos: GrupoCliente[] = []
  for (const [cliente, ventasCliente] of mapa) {
    const itemsPendientes: FilaDeuda[] = ventasCliente
      .filter((v) => v.estado_pago === 'Fiado' || v.estado_pago === 'A Prueba')
      .flatMap((venta) =>
        venta.detalles_venta
          .filter((d) => d.estado_item !== 'Liquidado' && d.estado_item !== 'Devuelto')
          .map((detalle) => ({ ...venta, detalle_enfocado: detalle })),
      )
    const itemsHistorial: FilaDeuda[] = ventasCliente.flatMap((venta) =>
      venta.detalles_venta
        .filter((d) => d.estado_item === 'Liquidado' || d.estado_item === 'Devuelto')
        .map((detalle) => ({ ...venta, detalle_enfocado: detalle })),
    )
    const deudaActiva = itemsPendientes.reduce(
      (sum, f) => sum + f.detalle_enfocado.subtotal,
      0,
    )
    grupos.push({ cliente, itemsPendientes, itemsHistorial, deudaActiva })
  }

  return grupos.sort((a, b) => a.cliente.localeCompare(b.cliente))
}

function descripcionItem(det: DetalleDeuda) {
  const modelo = det.repuestos.modelos?.nombre ?? '—'
  const marca = det.repuestos.modelos?.marcas?.nombre ?? '—'
  const categoria = det.repuestos.categorias?.nombre ?? '—'
  const distribuidor = det.repuestos.distribuidores?.nombre ?? ''
  const extras = formatearDetalles(distribuidor, det.repuestos.atributos ?? {})
  return { modelo, marca, categoria, extras }
}

function DevolucionModal({
  venta,
  detalle,
  onClose,
  onSuccess,
}: {
  venta: VentaConDetalles
  detalle: DetalleDeuda
  onClose: () => void
  onSuccess: () => void
}) {
  const [enviando, setEnviando] = useState(false)

  const cantidadMax = detalle.cantidad
  const [cantidadDevuelta, setCantidadDevuelta] = useState(cantidadMax)

  const precioUnitario = detalle.subtotal / detalle.cantidad
  const esParcial = cantidadDevuelta < cantidadMax
  const nuevoSubtotal = (cantidadMax - cantidadDevuelta) * precioUnitario

  const handleBueno = async () => {
    setEnviando(true)

    const stockActual = detalle.repuestos.stock ?? 0
    let stockComprometido = false

    try {
      const { data: repuestoActualizado, error: errStock } = await supabase
        .from('repuestos')
        .update({ stock: stockActual + cantidadDevuelta })
        .eq('id_repuesto', detalle.id_repuesto)
        .select('id_repuesto')
      if (errStock) throw errStock
      if (!repuestoActualizado || repuestoActualizado.length === 0) {
        throw new Error('No se encontró el repuesto para devolver stock')
      }
      stockComprometido = true

      const otrosSubtotales = venta.detalles_venta
        .filter((d) => d.id_detalle !== detalle.id_detalle)
        .reduce((sum, d) => sum + d.subtotal, 0)

      if (esParcial) {
        const { data: detalleActualizado, error: errDet } = await supabase
          .from('detalles_venta')
          .update({ cantidad: cantidadMax - cantidadDevuelta, subtotal: nuevoSubtotal })
          .eq('id_detalle', detalle.id_detalle)
          .select('id_detalle')
        if (errDet) throw errDet
        if (!detalleActualizado || detalleActualizado.length === 0) {
          throw new Error('No se pudo actualizar el detalle de la venta')
        }

        const nuevoTotal = Math.max(0, Math.round((otrosSubtotales + nuevoSubtotal) * 100) / 100)
        const { data: ventaActualizada, error: errVta } = await supabase
          .from('ventas')
          .update({ total: nuevoTotal })
          .eq('id_venta', venta.id_venta)
          .select('id_venta')
        if (errVta) throw errVta
        if (!ventaActualizada || ventaActualizada.length === 0) {
          throw new Error('No se pudo actualizar el total de la venta')
        }
      } else {
        const { data: detalleEliminado, error: errDel } = await supabase
          .from('detalles_venta')
          .delete()
          .eq('id_detalle', detalle.id_detalle)
          .select('id_detalle')
        if (errDel) throw errDel
        if (!detalleEliminado || detalleEliminado.length === 0) {
          throw new Error('No se pudo eliminar el detalle de la venta (¿política RLS de DELETE?)')
        }

        if (otrosSubtotales <= 0) {
          const { data: ventaEliminada, error: errVta } = await supabase
            .from('ventas')
            .delete()
            .eq('id_venta', venta.id_venta)
            .select('id_venta')
          if (errVta) throw errVta
          if (!ventaEliminada || ventaEliminada.length === 0) {
            throw new Error('No se pudo eliminar la venta (¿política RLS de DELETE?)')
          }
        } else {
          const { data: ventaActualizada, error: errVta } = await supabase
            .from('ventas')
            .update({ total: Math.round(otrosSubtotales * 100) / 100 })
            .eq('id_venta', venta.id_venta)
            .select('id_venta')
          if (errVta) throw errVta
          if (!ventaActualizada || ventaActualizada.length === 0) {
            throw new Error('No se pudo actualizar el total de la venta')
          }
        }
      }

      toast.success('Devolución procesada y stock actualizado')
      onSuccess()
    } catch (error) {
      if (stockComprometido) {
        await supabase
          .from('repuestos')
          .update({ stock: stockActual })
          .eq('id_repuesto', detalle.id_repuesto)
      }
      setEnviando(false)
      console.error('Error detallado:', error)
      toast.error('Error al procesar la devolución: ' + ((error as Error).message || JSON.stringify(error)))
    }
  }

  const { modelo, marca, categoria } = descripcionItem(detalle)

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
            {detalle.cantidad}x {categoria} {marca} {modelo}
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

function LiquidarLoteModal({
  items,
  onClose,
  onSuccess,
}: {
  items: FilaDeuda[]
  onClose: () => void
  onSuccess: () => void
}) {
  const [metodo, setMetodo] = useState<MetodoPago>('Efectivo')
  const [referencia, setReferencia] = useState('')
  const [montoEfectivo, setMontoEfectivo] = useState('')
  const [montoTransferencia, setMontoTransferencia] = useState('')
  const [enviando, setEnviando] = useState(false)
  const esTransferencia = metodo === 'Transferencia'
  const esMixto = metodo === 'Mixto'

  const totalLote = items.reduce((sum, f) => sum + f.detalle_enfocado.subtotal, 0)
  const esMixtoValido =
    Math.round((Number(montoEfectivo) + Number(montoTransferencia)) * 100) ===
    Math.round(totalLote * 100)
  const ids = items.map((f) => f.detalle_enfocado.id_detalle)
  const ventasAfectadas = [...new Set(items.map((f) => f.id_venta))]
  const tecnicos = [...new Set(items.map((f) => f.alias_tecnico))]

  const handleConfirm = async () => {
    if ((esTransferencia || esMixto) && !referencia.trim()) {
      toast.error('Por favor, ingresa la referencia de la transferencia.')
      return
    }
    if (esMixto && !esMixtoValido) return

    setEnviando(true)

    try {
      const fechaPago = new Date().toISOString()

      const montoEfectivoTotal = metodo === 'Mixto' ? Number(montoEfectivo) || 0 : 0
      const montoTransferenciaTotal = metodo === 'Mixto' ? Number(montoTransferencia) || 0 : 0

      // Monto individual por ítem (no el total del grupo) para no multiplicar ingresos.
      const montosPorDetalle = new Map<number, { efectivo: number; transferencia: number }>()
      for (const item of items) {
        const det = item.detalle_enfocado
        const proporcion = totalLote > 0 ? det.subtotal / totalLote : 1 / items.length
        const efectivo =
          metodo === 'Efectivo'
            ? det.subtotal
            : metodo === 'Transferencia'
              ? 0
              : montoEfectivoTotal * proporcion
        const transferencia =
          metodo === 'Transferencia'
            ? det.subtotal
            : metodo === 'Efectivo'
              ? 0
              : montoTransferenciaTotal * proporcion
        montosPorDetalle.set(det.id_detalle, { efectivo, transferencia })
      }

      for (const [idDetalle, m] of montosPorDetalle) {
        const { error: errDet } = await supabase
          .from('detalles_venta')
          .update({
            estado_item: 'Liquidado',
            fecha_pago_item: fechaPago,
            metodo_pago_item: metodo,
            referencia_item: referencia.trim() || null,
            monto_efectivo_item: m.efectivo,
            monto_transferencia_item: m.transferencia,
          })
          .eq('id_detalle', idDetalle)
        if (errDet) throw errDet
      }

      for (const idVenta of ventasAfectadas) {
        const venta = items.find((f) => f.id_venta === idVenta)!

        const nuevoTotal = Math.max(
          0,
          Math.round(
            venta.detalles_venta
              .filter(
                (d) =>
                  !ids.includes(d.id_detalle) &&
                  d.estado_item !== 'Liquidado' &&
                  d.estado_item !== 'Devuelto',
              )
              .reduce((sum, d) => sum + d.subtotal, 0) * 100,
          ) / 100,
        )

        const itemsVenta = items.filter((f) => f.id_venta === idVenta)
        const montoEfectivoVenta = itemsVenta.reduce(
          (sum, f) => sum + (montosPorDetalle.get(f.detalle_enfocado.id_detalle)?.efectivo ?? 0),
          0,
        )
        const montoTransferenciaVenta = itemsVenta.reduce(
          (sum, f) =>
            sum + (montosPorDetalle.get(f.detalle_enfocado.id_detalle)?.transferencia ?? 0),
          0,
        )

        const updateVenta: Record<string, unknown> = {
          total: nuevoTotal,
          metodo_pago: metodo,
          numero_comprobante: (esTransferencia || esMixto) ? referencia.trim() : null,
          monto_efectivo: montoEfectivoVenta,
          monto_transferencia: montoTransferenciaVenta,
        }
        if (nuevoTotal <= 0) {
          updateVenta.estado_pago = 'Pagado'
          updateVenta.fecha_cobro = 'now()'
        }

        const { error } = await supabase
          .from('ventas')
          .update(updateVenta)
          .eq('id_venta', idVenta)
        if (error) throw error
      }

      generarTicketCobroLote({
        tituloDocumento: 'COMPROBANTE DE COBRO',
        nombreCliente: tecnicos.join(', '),
        fecha: formatearFechaComprobante(fechaPago) ?? '—',
        detallesRepuesto: items.map((f) => {
          const det = f.detalle_enfocado
          return {
            categoria: det.repuestos.categorias?.nombre ?? '—',
            marca: det.repuestos.modelos?.marcas?.nombre ?? '—',
            modelo: det.repuestos.modelos?.nombre ?? '—',
            cantidad: det.cantidad,
            precioUnitario: det.precio_unitario,
            subtotal: det.subtotal,
          }
        }),
        total: totalLote,
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
        className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-slate-800">Liquidar Deudas Seleccionadas</h3>

        <div className="space-y-2 text-sm text-slate-600">
          <p>
            <span className="font-medium text-slate-700">Técnico:</span>{' '}
            {tecnicos.join(', ')}
          </p>
          <div className="rounded-lg border border-slate-200 divide-y divide-slate-100 max-h-48 overflow-y-auto">
            {items.map((f) => {
              const det = f.detalle_enfocado
              const { modelo, marca, categoria } = descripcionItem(det)
              return (
                <div
                  key={det.id_detalle}
                  className="flex items-center justify-between gap-2 px-3 py-2"
                >
                  <span className="truncate">
                    {det.cantidad}x {categoria} {marca} {modelo}
                  </span>
                  <span className="font-semibold text-slate-800 whitespace-nowrap">
                    $ {det.subtotal.toFixed(2)}
                  </span>
                </div>
              )
            })}
          </div>
          <p className="pt-1 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700">Total a liquidar</span>
            <span className="text-base font-bold text-slate-800 font-mono">
              $ {totalLote.toFixed(2)}
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
            La suma de Efectivo + Transferencia debe ser $ {totalLote.toFixed(2)}
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
            {enviando ? 'Procesando…' : `Liquidar $ ${totalLote.toFixed(2)}`}
          </button>
        </div>
      </div>
    </div>
  )
}

export function CuentasPorCobrar() {
  const [ventas, setVentas] = useState<VentaConDetalles[]>([])
  const [cargando, setCargando] = useState(true)
  const [liquidando, setLiquidando] = useState<FilaDeuda | null>(null)
  const [devolviendo, setDevolviendo] = useState<FilaDeuda | null>(null)
  const [garantia, setGarantia] = useState<FilaDeuda | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [clienteAbierto, setClienteAbierto] = useState<string | null>(null)
  const [tabActivo, setTabActivo] = useState<TabInterna>('Pendientes')
  const [seleccion, setSeleccion] = useState<Set<number>>(new Set())
  const [liquidandoLote, setLiquidandoLote] = useState(false)

  const grupos = agruparPorCliente(ventas)
  const gruposFiltrados = grupos.filter((g) =>
    g.cliente.toLowerCase().includes(busqueda.toLowerCase()),
  )
  const totalAcumulado = gruposFiltrados.reduce((sum, g) => sum + g.deudaActiva, 0)

  const todosPendientes = grupos.flatMap((g) => g.itemsPendientes)
  const idsPendientes = new Set(todosPendientes.map((f) => f.detalle_enfocado.id_detalle))
  const seleccionValida = new Set([...seleccion].filter((id) => idsPendientes.has(id)))
  const itemsSeleccionados = todosPendientes.filter((f) =>
    seleccionValida.has(f.detalle_enfocado.id_detalle),
  )
  const totalSeleccionado = itemsSeleccionados.reduce(
    (sum, f) => sum + f.detalle_enfocado.subtotal,
    0,
  )

  const toggleItem = (id: number) => {
    setSeleccion((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleGrupo = (grupo: GrupoCliente) => {
    setSeleccion((prev) => {
      const next = new Set(prev)
      const idsGrupo = grupo.itemsPendientes.map((f) => f.detalle_enfocado.id_detalle)
      const todosSeleccionados = idsGrupo.every((id) => next.has(id))
      if (todosSeleccionados) idsGrupo.forEach((id) => next.delete(id))
      else idsGrupo.forEach((id) => next.add(id))
      return next
    })
  }

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
      .in('estado_pago', ['Fiado', 'A Prueba', 'Pagado', 'Garantia'])
      .order('fecha_hora', { ascending: false })

    if (data) setVentas(data as unknown as VentaConDetalles[])
    setCargando(false)
  }

  useEffect(() => {
    cargarVentas()
  }, [])

  const toggleCliente = (cliente: string) => {
    setClienteAbierto((prev) => (prev === cliente ? null : cliente))
    setTabActivo('Pendientes')
  }

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

      {gruposFiltrados.length === 0 ? (
        <div className="text-center py-12 text-slate-500 text-sm">
          No se encontraron deudas para este técnico.
        </div>
      ) : (
        <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-2 shadow-sm rounded-lg">
          {gruposFiltrados.map((grupo) => {
            const abierto = clienteAbierto === grupo.cliente
            return (
              <div
                key={grupo.cliente}
                className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden"
              >
                <button
                  onClick={() => toggleCliente(grupo.cliente)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <span className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </span>
                  <span className="flex-1 text-left">
                    <span className="block font-semibold text-slate-800">
                      {grupo.cliente}
                    </span>
                    <span className="block text-xs text-slate-500">
                      {grupo.itemsPendientes.length} ítem(s) pendiente(s)
                    </span>
                  </span>
                  <span
                    className={`rounded-full px-3 py-1 text-sm font-bold whitespace-nowrap ${
                      grupo.deudaActiva > 0
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-emerald-100 text-emerald-700'
                    }`}
                  >
                    $ {grupo.deudaActiva.toFixed(2)}
                  </span>
                  <svg
                    className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${
                      abierto ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {abierto && (
                  <div className="border-t border-slate-200 p-4">
                    <div className="flex gap-1 border-b border-slate-200 mb-3">
                      {(['Pendientes', 'Historial'] as const).map((tab) => (
                        <button
                          key={tab}
                          onClick={() => setTabActivo(tab)}
                          className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
                            tabActivo === tab
                              ? 'border-blue-600 text-blue-700'
                              : 'border-transparent text-slate-500 hover:text-slate-700'
                          }`}
                        >
                          {tab}
                          <span className="ml-1.5 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                            {tab === 'Pendientes'
                              ? grupo.itemsPendientes.length
                              : grupo.itemsHistorial.length}
                          </span>
                        </button>
                      ))}
                    </div>

                    {tabActivo === 'Pendientes' ? (
                      grupo.itemsPendientes.length === 0 ? (
                        <div className="text-center py-8 text-slate-500 text-sm">
                          No hay ítems pendientes para este cliente.
                        </div>
                      ) : (
                        <div className="overflow-x-auto rounded-lg border border-slate-200">
                          <table className="w-full text-xs md:text-sm">
                            <thead>
                              <tr className="bg-slate-50 text-slate-600 uppercase text-xs tracking-wider">
                                <th className="px-3 py-2.5 font-semibold w-10">
                                  <input
                                    type="checkbox"
                                    title="Seleccionar Todo"
                                    checked={grupo.itemsPendientes.every((f) =>
                                      seleccionValida.has(f.detalle_enfocado.id_detalle),
                                    )}
                                    ref={(el) => {
                                      if (!el) return
                                      const seleccionadosGrupo = grupo.itemsPendientes.filter(
                                        (f) => seleccionValida.has(f.detalle_enfocado.id_detalle),
                                      ).length
                                      el.indeterminate =
                                        seleccionadosGrupo > 0 &&
                                        seleccionadosGrupo < grupo.itemsPendientes.length
                                    }}
                                    onChange={() => toggleGrupo(grupo)}
                                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                  />
                                </th>
                                <th className="text-left px-3 py-2.5 font-semibold">FECHA</th>
                                <th className="text-left px-3 py-2.5 font-semibold">ÍTEM</th>
                                <th className="text-center px-3 py-2.5 font-semibold">CANT</th>
                                <th className="text-right px-3 py-2.5 font-semibold">DEUDA</th>
                                <th className="text-right px-3 py-2.5 font-semibold">ACCIONES</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {grupo.itemsPendientes.map((fila) => {
                                const det = fila.detalle_enfocado
                                const { modelo, marca, categoria, extras } = descripcionItem(det)
                                const marcado = seleccionValida.has(det.id_detalle)
                                return (
                                  <tr
                                    key={`${fila.id_venta}-${det.id_detalle}`}
                                    className={`transition-colors ${
                                      marcado ? 'bg-emerald-50' : 'hover:bg-slate-50'
                                    }`}
                                  >
                                    <td className="px-3 py-2.5">
                                      <input
                                        type="checkbox"
                                        checked={marcado}
                                        onChange={() => toggleItem(det.id_detalle)}
                                        className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                      />
                                    </td>
                                    <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">
                                      {formatFecha(fila.fecha_hora)}
                                    </td>
                                    <td className="px-3 py-2.5">
                                      <span className="font-medium text-slate-800">
                                        {categoria} · {marca} {modelo}
                                      </span>
                                      {extras && (
                                        <p className="text-xs text-gray-500 mt-0.5">[{extras}]</p>
                                      )}
                                    </td>
                                    <td className="px-3 py-2.5 text-center font-medium text-slate-800">
                                      {det.cantidad}
                                    </td>
                                    <td className="px-3 py-2.5 text-right">
                                      <span className="font-bold text-slate-800 whitespace-nowrap">
                                        $ {det.subtotal.toFixed(2)}
                                      </span>
                                    </td>
                                    <td className="px-3 py-2.5">
                                      <div className="flex justify-end gap-2">
                                        <button
                                          onClick={() => setDevolviendo(fila)}
                                          title="Devolver pieza en buen estado a stock"
                                          className="rounded-lg border border-blue-300 px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                                        >
                                          Devolver
                                        </button>
                                        <button
                                          onClick={() => setLiquidando(fila)}
                                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors cursor-pointer"
                                        >
                                          Liquidar
                                        </button>
                                        <button
                                          onClick={() => setGarantia(fila)}
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
                      )
                    ) : grupo.itemsHistorial.length === 0 ? (
                      <div className="text-center py-8 text-slate-500 text-sm">
                        Sin historial de pagos para este cliente.
                      </div>
                    ) : (
                      <div className="overflow-x-auto rounded-lg border border-slate-200">
                        <table className="w-full text-xs md:text-sm">
                          <thead>
                            <tr className="bg-slate-50 text-slate-600 uppercase text-xs tracking-wider">
                              <th className="text-left px-3 py-2.5 font-semibold">FECHA</th>
                              <th className="text-left px-3 py-2.5 font-semibold">ÍTEM</th>
                              <th className="text-center px-3 py-2.5 font-semibold">CANT</th>
                              <th className="text-right px-3 py-2.5 font-semibold">MONTO</th>
                              <th className="text-center px-3 py-2.5 font-semibold">ESTADO</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {grupo.itemsHistorial.map((fila) => {
                              const det = fila.detalle_enfocado
                              const { modelo, marca, categoria, extras } = descripcionItem(det)
                              const estado = det.estado_item ?? '—'
                              return (
                                <tr key={`${fila.id_venta}-${det.id_detalle}`} className="hover:bg-slate-50 transition-colors">
                                  <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">
                                    {formatFecha(det.fecha_pago_item ?? fila.fecha_hora)}
                                  </td>
                                  <td className="px-3 py-2.5">
                                    <span className="font-medium text-slate-800">
                                      {categoria} · {marca} {modelo}
                                    </span>
                                    {extras && (
                                      <p className="text-xs text-gray-500 mt-0.5">[{extras}]</p>
                                    )}
                                  </td>
                                  <td className="px-3 py-2.5 text-center font-medium text-slate-800">
                                    {det.cantidad}
                                  </td>
                                  <td className="px-3 py-2.5 text-right">
                                    <span className="font-bold text-slate-800 whitespace-nowrap">
                                      $ {det.subtotal.toFixed(2)}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2.5 text-center">
                                    <span
                                      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                        estado === 'Liquidado'
                                          ? 'bg-emerald-100 text-emerald-700'
                                          : 'bg-blue-100 text-blue-700'
                                      }`}
                                    >
                                      {estado}
                                    </span>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {itemsSeleccionados.length > 0 && (
        <button
          onClick={() => setLiquidandoLote(true)}
          className="fixed bottom-6 right-6 z-40 rounded-full bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-lg hover:bg-emerald-700 transition-colors cursor-pointer"
        >
          Liquidar {itemsSeleccionados.length} Seleccionado
          {itemsSeleccionados.length > 1 ? 's' : ''} — $ {totalSeleccionado.toFixed(2)}
        </button>
      )}

      {liquidando && (
        <LiquidarModal
          venta={liquidando}
          detalle={liquidando.detalle_enfocado}
          onClose={() => setLiquidando(null)}
          onSuccess={() => {
            setLiquidando(null)
            cargarVentas()
          }}
        />
      )}

      {liquidandoLote && itemsSeleccionados.length > 0 && (
        <LiquidarLoteModal
          items={itemsSeleccionados}
          onClose={() => setLiquidandoLote(false)}
          onSuccess={() => {
            setLiquidandoLote(false)
            setSeleccion(new Set())
            cargarVentas()
          }}
        />
      )}

      {devolviendo && (
        <DevolucionModal
          venta={devolviendo}
          detalle={devolviendo.detalle_enfocado}
          onClose={() => setDevolviendo(null)}
          onSuccess={() => {
            const idDetalle = devolviendo.detalle_enfocado.id_detalle
            const idVenta = devolviendo.id_venta

            setVentas((prev) =>
              prev
                .map((v) => {
                  if (v.id_venta !== idVenta) return v
                  const nuevos = v.detalles_venta.filter((d) => d.id_detalle !== idDetalle)
                  if (nuevos.length === 0) return null
                  return { ...v, detalles_venta: nuevos }
                })
                .filter(Boolean) as VentaConDetalles[],
            )
            setDevolviendo(null)
          }}
        />
      )}

      {garantia && (
        <ModalGarantiaCliente
          venta={garantia}
          detalleInicial={garantia.detalle_enfocado}
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
