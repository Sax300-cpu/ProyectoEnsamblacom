import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { RepuestoConRelaciones } from '../types/database'

interface Props {
  seccion: 'pantallas' | 'otros'
  buscar: string
}

const CATEGORIA_PANTALLAS = 1

export function InventoryTable({ seccion, buscar }: Props) {
  const [repuestos, setRepuestos] = useState<RepuestoConRelaciones[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const obtenerRepuestos = async () => {
      setCargando(true)
      setError(null)

      const { data, error } = await supabase
        .from('repuestos')
        .select(`
          *,
          repuestos_compatibilidad (
            id_modelo,
            modelos (
              id_modelo,
              nombre,
              marcas (
                id_marca,
                nombre
              )
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
        `)
        .filter('id_categoria', seccion === 'pantallas' ? 'eq' : 'neq', CATEGORIA_PANTALLAS)
        .order('id_repuesto', { ascending: true })

      if (error) {
        setError(error.message)
        setRepuestos([])
      } else {
        setRepuestos(data as unknown as RepuestoConRelaciones[])
      }

      setCargando(false)
    }

    obtenerRepuestos()
  }, [seccion])

  const filtrados = repuestos.filter((r) => {
    if (!buscar) return true
    const q = buscar.toLowerCase()
    return (
      r.repuestos_compatibilidad.some((rc) =>
        rc.modelos.nombre.toLowerCase().includes(q),
      ) ||
      r.repuestos_compatibilidad.some((rc) =>
        rc.modelos.marcas.nombre.toLowerCase().includes(q),
      ) ||
      r.categorias.nombre.toLowerCase().includes(q)
    )
  })

  if (cargando) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <svg className="animate-spin h-8 w-8" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm">Cargando repuestos…</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">
        Error al cargar los datos: {error}
      </div>
    )
  }

  if (filtrados.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500 text-sm">
        No hay repuestos registrados.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 shadow-sm">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="bg-slate-100 text-slate-600 uppercase text-xs tracking-wider">
            <th className="text-left px-4 py-3 font-semibold">Categoría</th>
            <th className="text-left px-4 py-3 font-semibold">Marca</th>
            <th className="text-left px-4 py-3 font-semibold">Modelo</th>
            <th className="text-left px-4 py-3 font-semibold">Distribuidor</th>
            <th className="text-left px-4 py-3 font-semibold">Detalles</th>
            <th className="text-right px-4 py-3 font-semibold">Stock</th>
            <th className="text-right px-4 py-3 font-semibold">Costo</th>
            <th className="text-right px-4 py-3 font-semibold">Precio Técnico</th>
            <th className="text-right px-4 py-3 font-semibold">Precio Cliente</th>
            <th className="text-center px-4 py-3 font-semibold">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {filtrados.map((r) => {
            const marcaNombre =
              r.repuestos_compatibilidad[0]?.modelos.marcas.nombre ?? '—'

            return (
              <tr key={r.id_repuesto} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 text-slate-700">{r.categorias.nombre}</td>
                <td className="px-4 py-3 text-slate-700">{marcaNombre}</td>
                <td className="px-4 py-3 text-slate-700">
                  <div className="flex flex-wrap gap-1">
                    {r.repuestos_compatibilidad.map((rc) => (
                      <span
                        key={rc.id_modelo}
                        className="inline-block rounded-md bg-indigo-100 text-indigo-700 px-2 py-0.5 text-xs font-medium"
                      >
                        {rc.modelos.nombre}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-700">{r.distribuidores.nombre}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(r.atributos ?? {}).flatMap(([key, val]) => {
                      if (typeof val === 'boolean') {
                        if (!val) return []
                        const label =
                          key === 'con_bisel' ? 'Con Bisel' :
                          key === 'vidrio_camara' ? 'Con Vidrio' :
                          key
                        return [(
                          <span key={key} className="inline-block rounded-md bg-slate-100 text-slate-600 px-2 py-0.5 text-xs">
                            {label}
                          </span>
                        )]
                      }
                      if (key === 'calidad' || key === 'color') {
                        return [(
                          <span key={key} className="inline-block rounded-md bg-slate-100 text-slate-600 px-2 py-0.5 text-xs uppercase">
                            {String(val)}
                          </span>
                        )]
                      }
                      return [(
                        <span key={key} className="inline-block rounded-md bg-slate-100 text-slate-600 px-2 py-0.5 text-xs">
                          {key}: {String(val)}
                        </span>
                      )]
                    })}
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <span
                    className={`inline-block min-w-[2rem] rounded-full px-2 py-0.5 text-xs font-semibold ${
                      r.stock <= 5
                        ? 'bg-red-100 text-red-700'
                        : r.stock <= 15
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-green-100 text-green-700'
                    }`}
                  >
                    {r.stock}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-slate-700 font-mono">
                  {r.costo_distribuidor.toFixed(2)}
                </td>
                <td className="px-4 py-3 text-right text-slate-700 font-mono">
                  {r.precio_tecnico.toFixed(2)}
                </td>
                <td className="px-4 py-3 text-right text-slate-700 font-mono">
                  {r.precio_cliente.toFixed(2)}
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => console.log('Vender repuesto id:', r.id_repuesto)}
                    className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors cursor-pointer"
                  >
                    Vender
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
