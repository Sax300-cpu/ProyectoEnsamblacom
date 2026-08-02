import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { toast } from '../components/Toaster'
import { formatearDetalles, formatearFechaComprobante } from '../lib/format'

const ESTADOS_REVISION = [
  'En tienda',
  'Pendiente de Prueba',
  'Devuelto a Proveedor',
  'Perdida Asumida',
  'Reemplazado',
] as const

interface CuarentenaRow {
  id_cuarentena: number
  id_repuesto: number
  cantidad: number
  origen: string
  estado_revision: string
  descripcion_falla: string | null
  fecha_ingreso: string
  id_venta: number | null
  repuestos: {
    stock: number
    atributos: Record<string, unknown>
    modelos: { id_modelo: number; nombre: string; marcas: { id_marca: number; nombre: string } } | null
    categorias: { id_categoria: number; nombre: string }
    distribuidores: { id_distribuidor: number; nombre: string }
  } | null
  ventas: { alias_tecnico: string | null } | null
}

const badgeEstado: Record<string, string> = {
  'En tienda': 'bg-amber-100 text-amber-700',
  'Pendiente de Prueba': 'bg-blue-100 text-blue-700',
  'Devuelto a Proveedor': 'bg-purple-100 text-purple-700',
  'Perdida Asumida': 'bg-red-100 text-red-700',
  'Reemplazado': 'bg-emerald-100 text-emerald-700',
}

export function Garantias() {
  const [filas, setFilas] = useState<CuarentenaRow[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [vistaActual, setVistaActual] = useState<'Pendientes' | 'Historial'>('Pendientes')

  const filasFiltradas = filas.filter((fila) =>
    vistaActual === 'Pendientes'
      ? fila.estado_revision !== 'Reemplazado' && fila.estado_revision !== 'Perdida Asumida'
      : fila.estado_revision === 'Reemplazado' || fila.estado_revision === 'Perdida Asumida',
  )

  const cargarDatos = async () => {
    setCargando(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('cuarentena_defectuosos')
      .select(`
        *,
        repuestos (
          id_repuesto,
          id_categoria,
          id_distribuidor,
          stock,
          atributos,
          modelos:id_modelo_principal (
            id_modelo,
            nombre,
            marcas ( id_marca, nombre )
          ),
          categorias!inner ( id_categoria, nombre ),
          distribuidores!inner ( id_distribuidor, nombre )
        ),
        ventas ( alias_tecnico )
      `)
      .order('fecha_ingreso', { ascending: false })

    if (err) {
      setError(err.message)
      setFilas([])
    } else {
      setFilas(data as unknown as CuarentenaRow[])
    }
    setCargando(false)
  }

  useEffect(() => {
    cargarDatos()
  }, [])

  const cambiarEstado = async (fila: CuarentenaRow, nuevoEstado: string) => {
    if (nuevoEstado === fila.estado_revision) return

    if (nuevoEstado === 'Reemplazado') {
      const stockActual = fila.repuestos?.stock ?? 0
      const { error: errStock } = await supabase
        .from('repuestos')
        .update({ stock: stockActual + fila.cantidad })
        .eq('id_repuesto', fila.id_repuesto)

      if (errStock) {
        toast.error('Error al reponer el stock: ' + errStock.message)
        return
      }
    }

    const { error: err } = await supabase
      .from('cuarentena_defectuosos')
      .update({ estado_revision: nuevoEstado })
      .eq('id_cuarentena', fila.id_cuarentena)

    if (err) {
      toast.error('Error al actualizar el estado: ' + err.message)
      return
    }

    setFilas((prev) =>
      prev.map((f) => (f.id_cuarentena === fila.id_cuarentena ? { ...f, estado_revision: nuevoEstado } : f)),
    )
    toast.success(
      nuevoEstado === 'Reemplazado'
        ? 'Garantía cubierta: Stock devuelto al inventario'
        : 'Estado actualizado',
    )
  }

  const textoOrigen = (fila: CuarentenaRow) => {
    if (fila.origen === 'Interno') return 'Interno'
    return fila.ventas?.alias_tecnico ?? 'Cliente'
  }

  const nombreProducto = (fila: CuarentenaRow) => {
    const modelo = fila.repuestos?.modelos?.nombre ?? '—'
    const categoria = fila.repuestos?.categorias?.nombre ?? '—'
    return `${categoria} · ${modelo}`
  }

  const detallesProducto = (fila: CuarentenaRow) => {
    if (!fila.repuestos) return ''
    const distribuidor = fila.repuestos.distribuidores?.nombre ?? ''
    return formatearDetalles(distribuidor, fila.repuestos.atributos ?? {})
  }

  return (
    <section>
      <h2 className="text-2xl font-semibold text-slate-800 mb-4">🛡️ Garantías / Cuarentena</h2>

      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <p className="text-sm text-slate-500">
          Repuestos defectuosos pendientes de revisión o reclamo al proveedor.
        </p>
        <button
          onClick={cargarDatos}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors shrink-0 cursor-pointer"
        >
          ↻ Actualizar
        </button>
      </div>

      <div className="flex gap-1 mb-4 border-b border-slate-200">
        {(['Pendientes', 'Historial'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setVistaActual(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
              vistaActual === tab
                ? 'border-amber-600 text-amber-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab}
            <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
              {vistaActual === tab
                ? filasFiltradas.length
                : tab === 'Pendientes'
                ? filas.filter((f) => f.estado_revision !== 'Reemplazado' && f.estado_revision !== 'Perdida Asumida').length
                : filas.filter((f) => f.estado_revision === 'Reemplazado' || f.estado_revision === 'Perdida Asumida').length}
            </span>
          </button>
        ))}
      </div>

      {cargando ? (
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3 text-slate-500">
            <svg className="animate-spin h-8 w-8" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-sm">Cargando garantías…</span>
          </div>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">
          Error al cargar los datos: {error}
        </div>
      ) : filasFiltradas.length === 0 ? (
        <div className="text-center py-12 text-slate-500 text-sm">
          {vistaActual === 'Pendientes'
            ? 'No hay repuestos pendientes en cuarentena.'
            : 'No hay garantías resueltas en el historial.'}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 shadow-sm">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-slate-100 text-slate-600 uppercase text-xs tracking-wider">
                <th className="text-left px-4 py-3 font-semibold">Fecha</th>
                <th className="text-left px-4 py-3 font-semibold">Producto</th>
                <th className="text-left px-4 py-3 font-semibold">Distribuidor</th>
                <th className="text-left px-4 py-3 font-semibold">Origen</th>
                <th className="text-left px-4 py-3 font-semibold">Falla</th>
                <th className="text-center px-4 py-3 font-semibold">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filasFiltradas.map((fila) => (
                <tr key={fila.id_cuarentena} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                    {formatearFechaComprobante(fila.fecha_ingreso) ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium text-slate-800">{nombreProducto(fila)}</span>
                    {detallesProducto(fila) && (
                      <p className="text-xs text-slate-500 mt-0.5">
                        [{detallesProducto(fila)}]
                      </p>
                    )}
                    <span className="inline-block rounded-full bg-slate-100 text-slate-600 px-2 py-0.5 text-xs mt-1">
                      ×{fila.cantidad}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {fila.repuestos?.distribuidores?.nombre ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      fila.origen === 'Interno'
                        ? 'bg-slate-100 text-slate-600'
                        : 'bg-orange-100 text-orange-700'
                    }`}>
                      {textoOrigen(fila)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-700 max-w-xs">
                    {fila.descripcion_falla || '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <select
                      value={fila.estado_revision}
                      onChange={(e) => cambiarEstado(fila, e.target.value)}
                      className={`rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                        badgeEstado[fila.estado_revision] ?? 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {ESTADOS_REVISION.map((estado) => (
                        <option key={estado} value={estado}>{estado}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
