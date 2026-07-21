import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { RepuestoConRelaciones } from '../types/database'
import { useCart } from '../contexts/CartContext'

interface Props {
  seccion: 'pantallas' | 'otros'
  buscar: string
}

const CATEGORIA_PANTALLAS = 1
const PAGE_SIZE = 10

export function InventoryTable({ seccion, buscar }: Props) {
  const [repuestos, setRepuestos] = useState<RepuestoConRelaciones[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const { addToCart, openCart, refreshKey } = useCart()

  useEffect(() => {
    setCurrentPage(1)
  }, [seccion, buscar])

  useEffect(() => {
    setCargando(true)
    setError(null)

    const idFilter = seccion === 'pantallas' ? 'eq' : 'neq'

    const obtenerRepuestos = async () => {
      let countQuery = supabase
        .from('repuestos')
        .select('*', { count: 'exact', head: true })
        .filter('id_categoria', idFilter, CATEGORIA_PANTALLAS)

      let dataQuery = supabase
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
        .filter('id_categoria', idFilter, CATEGORIA_PANTALLAS)

      if (buscar) {
        const term = `%${buscar.toLowerCase()}%`

        const [catRes, modRes] = await Promise.all([
          supabase.from('categorias').select('id_categoria').ilike('nombre', term),
          supabase.from('modelos').select('id_modelo').ilike('nombre', term),
        ])

        const catIds = catRes.data?.map((c) => c.id_categoria) ?? []
        const modIds = modRes.data?.map((m) => m.id_modelo) ?? []

        const orParts: string[] = []
        if (catIds.length) orParts.push(`id_categoria.in.(${catIds.join(',')})`)
        if (modIds.length) orParts.push(`id_modelo_principal.in.(${modIds.join(',')})`)

        if (orParts.length === 0) {
          setTotalCount(0)
          setRepuestos([])
          setCargando(false)
          return
        }

        const orString = orParts.join(',')
        countQuery = countQuery.or(orString)
        dataQuery = dataQuery.or(orString)
      }

      const { count } = await countQuery
      setTotalCount(count ?? 0)

      const from = (currentPage - 1) * PAGE_SIZE
      const to = from + PAGE_SIZE - 1

      const { data, error } = await dataQuery
        .order('id_repuesto', { ascending: true })
        .range(from, to)

      if (error) {
        setError(error.message)
        setRepuestos([])
      } else {
        setRepuestos(data as unknown as RepuestoConRelaciones[])
      }

      setCargando(false)
    }

    obtenerRepuestos()
  }, [seccion, currentPage, buscar, refreshKey])

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

  if (repuestos.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500 text-sm">
        No hay repuestos registrados.
      </div>
    )
  }

  return (
    <div>
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
            {repuestos.map((r) => {
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
                      onClick={() => {
                        const modeloNombre = r.repuestos_compatibilidad[0]?.modelos.nombre ?? '—'
                        const marcaNombre = r.repuestos_compatibilidad[0]?.modelos.marcas.nombre ?? '—'
                        addToCart({
                          id_repuesto: r.id_repuesto,
                          cantidad: 1,
                          precio: r.precio_tecnico,
                          precio_tecnico: r.precio_tecnico,
                          precio_cliente: r.precio_cliente,
                          tipo_precio: 'tecnico',
                          descripcion: `${marcaNombre} ${modeloNombre}`,
                          categoria: r.categorias.nombre,
                          modelo_nombre: modeloNombre,
                          stock_disponible: r.stock,
                        })
                        openCart()
                      }}
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

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 mt-4">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            &lt; Anterior
          </button>
          <span className="text-sm text-slate-600">
            Página {currentPage} de {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            Siguiente &gt;
          </button>
        </div>
      )}
    </div>
  )
}
