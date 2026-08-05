import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { RepuestoConRelaciones, Categoria, Marca, Modelo, Distribuidor } from '../types/database'
import { useAuth } from '../contexts/AuthContext'
import { useCart } from '../contexts/CartContext'
import { ModalSumaStock } from '../components/ModalSumaStock'
import { ModalCuarentena } from '../components/ModalCuarentena'
import { toast } from '../components/Toaster'
import { mensajeErrorDuplicado } from '../lib/errores'

const PAGE_SIZE = 10

interface AtributoField {
  tipo: 'select' | 'checkbox' | 'text'
  nombre: string
  label: string
  opciones?: string[]
}

const definicionesAtributos: Record<string, AtributoField[]> = {
  tapas: [
    { tipo: 'text', nombre: 'color', label: 'Color' },
    { tipo: 'checkbox', nombre: 'vidrio_camara', label: 'Vidrio de Cámara' },
  ],
  'placas de carga': [
    { tipo: 'select', nombre: 'calidad', label: 'Calidad', opciones: ['Original', 'Genérica'] },
  ],
}

interface FormState {
  id_categoria: number | ''
  id_marca: number | ''
  id_modelo_principal: number | ''
  ids_compatibles: number[]
  id_distribuidor: number | ''
  stock: number | ''
  costo_distribuidor: number | ''
  precio_tecnico: number | ''
  precio_cliente: number | ''
}

interface AtributosState {
  [key: string]: string | boolean
}

const initialForm: FormState = {
  id_categoria: '',
  id_marca: '',
  id_modelo_principal: '',
  ids_compatibles: [],
  id_distribuidor: '',
  stock: '',
  costo_distribuidor: '',
  precio_tecnico: '',
  precio_cliente: '',
}

interface RepuestosProps {
  refreshSignal?: number
}

export function Repuestos({ refreshSignal }: RepuestosProps) {
  const { isAdmin, session, loading } = useAuth()

  const [repuestos, setRepuestos] = useState<RepuestoConRelaciones[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [buscar, setBuscar] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('Todas')
  const [categoriasFiltro, setCategoriasFiltro] = useState<Categoria[]>([])
  const [filtroStock, setFiltroStock] = useState<'todos' | 'con_stock' | 'agotados'>('todos')

  const categoriasSinDetalles = ['Altavoz', 'Bandejas', 'Bisel', 'Flex Encendido', 'Flex Main', 'Vidrios de Camara']
  const categoriaActual = categoriasFiltro.find((c) => String(c.id_categoria) === filtroCategoria)?.nombre ?? ''
  const mostrarDetalles = !categoriasSinDetalles.some((c) => c.toLowerCase() === categoriaActual.toLowerCase())
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const [refreshKey, setRefreshKey] = useState(0)
  const [categoriaPantallasId, setCategoriaPantallasId] = useState<number | null>(null)

  useEffect(() => {
    supabase
      .from('categorias')
      .select('id_categoria')
      .ilike('nombre', 'Pantallas')
      .maybeSingle()
      .then(({ data }) => setCategoriaPantallasId(data?.id_categoria ?? null))
  }, [])

  const { addToCart, openCart } = useCart()

  const handleVender = (r: RepuestoConRelaciones) => {
    if (r.stock <= 0) {
      toast.error('❌ No hay stock disponible para este artículo.')
      return
    }
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
      marca_nombre: marcaNombre,
      modelo_nombre: modeloNombre,
      stock_disponible: r.stock,
      distribuidor: r.distribuidores.nombre,
      detalles: r.atributos ?? {},
    })
    openCart()
  }

  const [modalEliminarOpen, setModalEliminarOpen] = useState(false)
  const [itemAEliminar, setItemAEliminar] = useState<number | null>(null)

  const eliminarRepuesto = async () => {
    if (itemAEliminar === null) return
    const { error: err } = await supabase
      .from('repuestos')
      .delete()
      .eq('id_repuesto', itemAEliminar)

    if (err) {
      toast.error('Error al eliminar: ' + err.message)
      setModalEliminarOpen(false)
      setItemAEliminar(null)
      return
    }
    setRepuestos((prev) => prev.filter((p) => p.id_repuesto !== itemAEliminar))
    setModalEliminarOpen(false)
    setItemAEliminar(null)
    toast.success('Repuesto eliminado del inventario')
  }

  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState<RepuestoConRelaciones | null>(null)
  const [stockModalOpen, setStockModalOpen] = useState(false)
  const [stockProducto, setStockProducto] = useState<RepuestoConRelaciones | null>(null)
  const [itemGarantia, setItemGarantia] = useState<RepuestoConRelaciones | null>(null)

  useEffect(() => {
    setCurrentPage(1)
  }, [buscar, filtroCategoria, filtroStock])

  useEffect(() => {
    supabase
      .from('categorias')
      .select('id_categoria, nombre')
      .neq('id_categoria', categoriaPantallasId ?? -1)
      .order('nombre')
      .then(({ data }) => setCategoriasFiltro((data ?? []) as Categoria[]))
  }, [categoriaPantallasId])

  useEffect(() => {
    if (loading || !session) return

    setCargando(true)
    setError(null)

    const fetchData = async () => {
      if (categoriaPantallasId === null) {
        setRepuestos([])
        setTotalCount(0)
        setCargando(false)
        return
      }

      let countQuery = supabase
        .from('repuestos')
        .select('*', { count: 'exact', head: true })
        .neq('id_categoria', categoriaPantallasId)

      let dataQuery = supabase
        .from('repuestos')
        .select(`
          *,
          repuestos_compatibilidad (
            id_modelo,
            modelos (
              id_modelo,
              nombre,
              marcas ( id_marca, nombre )
            )
          ),
          categorias!inner ( id_categoria, nombre ),
          distribuidores!inner ( id_distribuidor, nombre )
        `)
        .neq('id_categoria', categoriaPantallasId)

      if (buscar) {
        const palabras = buscar.toLowerCase().split(' ').filter(Boolean)

        const resolverPalabra = async (palabra: string): Promise<number[]> => {
          const term = `%${palabra}%`
          const [catRes, modRes, marcaRes] = await Promise.all([
            supabase.from('categorias').select('id_categoria').ilike('nombre', term),
            supabase.from('modelos').select('id_modelo').ilike('nombre', term),
            supabase.from('marcas').select('id_marca').ilike('nombre', term),
          ])
          const catIds = catRes.data?.map((c) => c.id_categoria) ?? []
          const modIds = modRes.data?.map((m) => m.id_modelo) ?? []

          let marcaModIds: number[] = []
          const marcaIds = marcaRes.data?.map((m) => m.id_marca) ?? []
          if (marcaIds.length) {
            const modsMarca = await supabase
              .from('modelos')
              .select('id_modelo')
              .in('id_marca', marcaIds)
            marcaModIds = modsMarca.data?.map((m) => m.id_modelo) ?? []
          }

          const todosModeloIds = [...new Set([...modIds, ...marcaModIds])]

          const ids = new Set<number>()

          if (catIds.length) {
            const r = await supabase
              .from('repuestos')
              .select('id_repuesto')
              .in('id_categoria', catIds)
            r.data?.forEach((x) => ids.add(x.id_repuesto))
          }

          if (todosModeloIds.length) {
            const r = await supabase
              .from('repuestos')
              .select('id_repuesto')
              .in('id_modelo_principal', todosModeloIds)
            r.data?.forEach((x) => ids.add(x.id_repuesto))

            const compat = await supabase
              .from('repuestos_compatibilidad')
              .select('id_repuesto')
              .in('id_modelo', todosModeloIds)
            compat.data?.forEach((x) => ids.add(x.id_repuesto))
          }

          return [...ids]
        }

        const porPalabra = await Promise.all(palabras.map(resolverPalabra))

        let idsIntersectados = porPalabra[0] ?? []
        for (const ids of porPalabra.slice(1)) {
          const set = new Set(ids)
          idsIntersectados = idsIntersectados.filter((id) => set.has(id))
        }
        idsIntersectados = [...new Set(idsIntersectados)]

        if (idsIntersectados.length === 0) {
          setTotalCount(0)
          setRepuestos([])
          setCargando(false)
          return
        }

        countQuery = countQuery.in('id_repuesto', idsIntersectados)
        dataQuery = dataQuery.in('id_repuesto', idsIntersectados)
      }

      if (filtroStock === 'con_stock') {
        countQuery = countQuery.gt('stock', 0)
        dataQuery = dataQuery.gt('stock', 0)
      } else if (filtroStock === 'agotados') {
        countQuery = countQuery.eq('stock', 0)
        dataQuery = dataQuery.eq('stock', 0)
      }

      if (filtroCategoria !== 'Todas') {
        countQuery = countQuery.eq('id_categoria', Number(filtroCategoria))
        dataQuery = dataQuery.eq('id_categoria', Number(filtroCategoria))
      }

      const { count } = await countQuery
      setTotalCount(count ?? 0)

      const from = (currentPage - 1) * PAGE_SIZE
      const to = from + PAGE_SIZE - 1

      const { data, error: err } = await dataQuery
        .order('id_repuesto', { ascending: true })
        .range(from, to)

      if (err) {
        setError(err.message)
        setRepuestos([])
      } else {
        setRepuestos(data as unknown as RepuestoConRelaciones[])
      }
      setCargando(false)
    }

    fetchData()
  }, [loading, session, currentPage, buscar, filtroCategoria, filtroStock, refreshKey, refreshSignal, categoriaPantallasId])

  return (
    <section>
      <h2 className="text-2xl font-semibold text-slate-800 mb-4">Repuestos</h2>

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <input
          type="text"
          placeholder="Buscar por modelo, marca o categoría…"
          value={buscar}
          onChange={(e) => setBuscar(e.target.value)}
          className="flex-1 min-w-[200px] rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={filtroCategoria}
          onChange={(e) => setFiltroCategoria(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shrink-0"
        >
          <option value="Todas">Todas las categorías</option>
          {categoriasFiltro.map((c) => (
            <option key={c.id_categoria} value={c.id_categoria}>{c.nombre}</option>
          ))}
        </select>
        <select
          value={filtroStock}
          onChange={(e) => setFiltroStock(e.target.value as 'todos' | 'con_stock' | 'agotados')}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shrink-0"
        >
          <option value="todos">Todos</option>
          <option value="con_stock">Con Stock</option>
          <option value="agotados">Agotados</option>
        </select>
        <button
          onClick={() => setRefreshKey((k) => k + 1)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors shrink-0 cursor-pointer"
          title="Actualizar datos"
        >
          ↻
        </button>
        <button
          onClick={() => { setEditando(null); setModalOpen(true) }}
          className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 transition-colors shrink-0 cursor-pointer"
        >
          Agregar +
        </button>
      </div>

      {cargando ? (
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3 text-slate-500">
            <svg className="animate-spin h-8 w-8" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-sm">Cargando repuestos…</span>
          </div>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">
          Error al cargar los datos: {error}
        </div>
      ) : repuestos.length === 0 ? (
        <div className="text-center py-12 text-slate-500 text-sm">
          No hay repuestos registrados.
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-slate-200 shadow-sm">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-slate-100 text-slate-600 uppercase text-xs tracking-wider">
                  <th className="text-left px-4 py-3 font-semibold">Categoría</th>
                  <th className="text-left px-4 py-3 font-semibold">Marca</th>
                  <th className="text-left px-4 py-3 font-semibold">Modelo</th>
                  <th className="text-left px-4 py-3 font-semibold">Distribuidor</th>
                  {mostrarDetalles && <th className="text-left px-4 py-3 font-semibold">Detalles</th>}
                  <th className="text-right px-4 py-3 font-semibold">Stock</th>
                  {isAdmin && <th className="text-right px-4 py-3 font-semibold">Costo</th>}
                  <th className="text-right px-4 py-3 font-semibold">Pre. Técnico</th>
                  <th className="text-right px-4 py-3 font-semibold">Pre. Cliente</th>
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
                      {mostrarDetalles && (
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(r.atributos ?? {}).flatMap(([key, val]) => {
                              if (typeof val === 'boolean') {
                                if (!val) return []
                                const label =
                                  key === 'con_bisel' ? 'Con Bisel'
                                  : key === 'vidrio_camara' ? 'Con Vidrio'
                                  : key
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
                      )}
                      <td className="px-4 py-3 text-right">
                        <span
                          className={`inline-block min-w-[2rem] rounded-full px-2 py-0.5 text-xs font-semibold ${
                            r.stock <= 1
                              ? 'bg-red-100 text-red-700'
                              : 'bg-green-100 text-green-700'
                          }`}
                        >
                          {r.stock}
                        </span>
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-3 text-right text-slate-700 font-mono">
                          {r.costo_distribuidor.toFixed(2)}
                        </td>
                      )}
                      <td className="px-4 py-3 text-right text-slate-700 font-mono">
                        {r.precio_tecnico.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700 font-mono">
                        {r.precio_cliente.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {isAdmin ? (
                            <button
                              onClick={() => { setEditando(r); setModalOpen(true) }}
                              className="bg-amber-500 text-white hover:bg-amber-600 px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer"
                              title="Editar Precios"
                            >
                              Editar
                            </button>
                          ) : (
                            <button
                              onClick={() => { setStockProducto(r); setStockModalOpen(true) }}
                              className="bg-emerald-600 text-white hover:bg-emerald-700 px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer"
                              title="Agregar Stock"
                            >
                              Stock
                            </button>
                          )}
                          <button
                            onClick={() => handleVender(r)}
                            className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors cursor-pointer"
                          >
                            Vender
                          </button>
                          <button
                            onClick={() => setItemGarantia(r)}
                            title="Mover a Garantía"
                            className="rounded-md bg-amber-500 px-2.5 py-1 text-xs font-semibold text-white hover:bg-amber-600 transition-colors cursor-pointer"
                          >
                            ⚠️
                          </button>
                          {isAdmin && (
                            <button
                              onClick={() => { setItemAEliminar(r.id_repuesto); setModalEliminarOpen(true) }}
                              title="Eliminar repuesto"
                              className="rounded-md bg-red-500 px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-600 transition-colors cursor-pointer"
                            >
                              🗑️
                            </button>
                          )}
                        </div>
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
        </>
      )}

      {modalOpen && (
        <ModalRepuesto
          isAdmin={isAdmin}
          editando={editando}
          categoriaPantallasId={categoriaPantallasId}
          onClose={() => { setModalOpen(false); setEditando(null) }}
          onSuccess={() => {
            setModalOpen(false)
            setEditando(null)
            setRefreshKey((k) => k + 1)
          }}
        />
      )}

      {stockModalOpen && stockProducto && (
        <ModalSumaStock
          producto={stockProducto}
          onClose={() => { setStockModalOpen(false); setStockProducto(null) }}
          onSuccess={() => {
            setStockModalOpen(false)
            setStockProducto(null)
            setRefreshKey((k) => k + 1)
          }}
        />
      )}

      {itemGarantia && (
        <ModalCuarentena
          producto={itemGarantia}
          onClose={() => setItemGarantia(null)}
          onSuccess={() => {
            setItemGarantia(null)
            setRefreshKey((k) => k + 1)
          }}
        />
      )}

      {modalEliminarOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              ⚠️ ¿Eliminar artículo?
            </h3>
            <p className="mt-2 text-sm text-slate-500">
              Esta acción no se puede deshacer y el repuesto se borrará permanentemente de este inventario.
            </p>
            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                onClick={() => { setModalEliminarOpen(false); setItemAEliminar(null) }}
                className="rounded-md bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-300 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={eliminarRepuesto}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 transition-colors cursor-pointer"
              >
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

interface ModalProps {
  isAdmin: boolean
  editando: RepuestoConRelaciones | null
  categoriaPantallasId: number | null
  onClose: () => void
  onSuccess: () => void
}

function ModalRepuesto({ isAdmin, editando, categoriaPantallasId, onClose, onSuccess }: ModalProps) {
  const [form, setForm] = useState<FormState>(() => {
    if (editando) {
      const idMarca = editando.repuestos_compatibilidad[0]?.modelos.marcas.id_marca ?? ''
      const idsCompatibles = editando.repuestos_compatibilidad
        .map((rc) => rc.id_modelo)
        .filter((id) => id !== editando.id_modelo_principal)
      return {
        id_categoria: editando.id_categoria,
        id_marca: String(idMarca) === '' ? '' : Number(idMarca),
        id_modelo_principal: editando.id_modelo_principal,
        ids_compatibles: idsCompatibles,
        id_distribuidor: editando.id_distribuidor ?? '',
        stock: editando.stock,
        costo_distribuidor: editando.costo_distribuidor,
        precio_tecnico: editando.precio_tecnico,
        precio_cliente: editando.precio_cliente,
      }
    }
    return { ...initialForm }
  })

  const [margen, setMargen] = useState(25)
  const [nuevoCompatible, setNuevoCompatible] = useState<number | ''>('')
  const [atributos, setAtributos] = useState<AtributosState>(() => {
    if (editando) {
      return (editando.atributos ?? {}) as AtributosState
    }
    return {}
  })
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [marcas, setMarcas] = useState<Marca[]>([])
  const [modelos, setModelos] = useState<Modelo[]>([])
  const [distribuidores, setDistribuidorList] = useState<Distribuidor[]>([])

  const [cargandoCatalogos, setCargandoCatalogos] = useState(true)

  useEffect(() => {
    const cargar = async () => {
      const [{ data: cats }, { data: mars }, { data: dists }] = await Promise.all([
        supabase.from('categorias').select('*').neq('id_categoria', categoriaPantallasId ?? -1).order('nombre'),
        supabase.from('marcas').select('*').order('nombre'),
        supabase.from('distribuidores').select('*').order('nombre'),
      ])
      if (cats) setCategorias(cats as Categoria[])
      if (mars) setMarcas(mars as Marca[])
      if (dists) setDistribuidorList(dists as Distribuidor[])
      setCargandoCatalogos(false)
    }
    cargar()
  }, [categoriaPantallasId])

  useEffect(() => {
    if (form.id_marca === '') {
      setModelos([])
      return
    }
    let cancel = false
    supabase
      .from('modelos')
      .select('*')
      .eq('id_marca', form.id_marca)
      .order('nombre')
      .then(({ data }) => {
        if (!cancel && data) setModelos(data as Modelo[])
      })
    return () => { cancel = true }
  }, [form.id_marca])

  const precioCalculado = (() => {
    const costo = Number(form.costo_distribuidor)
    if (!costo || costo <= 0) return 0
    return costo + costo * (margen / 100)
  })()

  const categoriaSeleccionada = categorias.find(
    (c) => c.id_categoria === form.id_categoria,
  )
  const nombreCategoria = categoriaSeleccionada?.nombre?.toLowerCase() ?? ''
  const esBaterias = nombreCategoria === 'baterías'
  const camposAtributos = definicionesAtributos[nombreCategoria] ?? []

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
    const { name, value, type } = e.target

    if (name.startsWith('atr_')) {
      const atrName = name.slice(4)
      if (type === 'checkbox') {
        setAtributos((prev) => ({ ...prev, [atrName]: (e.target as HTMLInputElement).checked }))
      } else if (value === '') {
        setAtributos((prev) => {
          const { [atrName]: _omit, ...rest } = prev
          return rest
        })
      } else {
        setAtributos((prev) => ({ ...prev, [atrName]: value }))
      }
      return
    }

    setForm((prev) => ({ ...prev, [name]: value === '' ? '' : Number(value) }))

    if (name === 'id_modelo_principal') {
      setNuevoCompatible('')
      setForm((prev) => ({ ...prev, ids_compatibles: [] }))
    }
  }

  const agregarCompatible = () => {
    if (nuevoCompatible === '' || nuevoCompatible === form.id_modelo_principal) return
    if (form.ids_compatibles.includes(nuevoCompatible)) return
    setForm((prev) => ({
      ...prev,
      ids_compatibles: [...prev.ids_compatibles, nuevoCompatible as number],
    }))
    setNuevoCompatible('')
  }

  const removerCompatible = (id: number) => {
    setForm((prev) => ({
      ...prev,
      ids_compatibles: prev.ids_compatibles.filter((v) => v !== id),
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setEnviando(true)

    const stock = Number(form.stock)
    const costo = Number(form.costo_distribuidor)
    const precioTecnico = Number(form.precio_tecnico)
    const precioCliente = Number(form.precio_cliente)

    if (!form.id_categoria || !form.id_modelo_principal) {
      setError('Seleccione una categoría y un modelo principal.')
      setEnviando(false)
      return
    }

    if (editando) {
      const updatePayload: Record<string, unknown> = {
        id_distribuidor: form.id_distribuidor === '' ? null : Number(form.id_distribuidor),
        stock,
        costo_distribuidor: costo,
        precio_tecnico: precioTecnico,
        precio_cliente: precioCliente,
        atributos: atributos as Record<string, unknown>,
      }

      const { error: updErr } = await supabase
        .from('repuestos')
        .update(updatePayload)
        .eq('id_repuesto', editando.id_repuesto)

      if (updErr) {
        setEnviando(false)
        setError(mensajeErrorDuplicado(updErr))
        return
      }

      const todosModelos = [
        editando.id_modelo_principal,
        ...form.ids_compatibles,
      ]

      const { error: delErr } = await supabase
        .from('repuestos_compatibilidad')
        .delete()
        .eq('id_repuesto', editando.id_repuesto)

      if (!delErr && todosModelos.length > 0) {
        const compatRecords = todosModelos.map((id_modelo) => ({
          id_repuesto: editando.id_repuesto,
          id_modelo,
        }))
        const { error: compatErr } = await supabase
          .from('repuestos_compatibilidad')
          .insert(compatRecords)

        if (compatErr) {
          setEnviando(false)
          setError(mensajeErrorDuplicado(compatErr))
          return
        }
      }

      setEnviando(false)
      onSuccess()
      return
    }

    const payload = {
      id_categoria: Number(form.id_categoria),
      id_distribuidor: form.id_distribuidor === '' ? null : Number(form.id_distribuidor),
      id_modelo_principal: Number(form.id_modelo_principal),
      stock,
      costo_distribuidor: costo,
      precio_tecnico: precioTecnico,
      precio_cliente: precioCliente,
      atributos: atributos as Record<string, unknown>,
    }

    const normalizarAtributos = (atrib: Record<string, unknown> | null | undefined): Record<string, unknown> => {
      if (!atrib) return {}
      return Object.fromEntries(
        Object.entries(atrib)
          .filter(([_, v]) => v !== false && v !== null && v !== undefined && v !== '')
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, v]) => {
            const valorNormalizado = typeof v === 'string' ? v.trim().toLowerCase().replace(/\s+/g, ' ') : v
            return [k, valorNormalizado]
          }),
      )
    }

    const atributosNormalizados = normalizarAtributos(payload.atributos)

    const { data: candidatos, error: candErr } = await supabase
      .from('repuestos')
      .select('id_repuesto, atributos')
      .eq('id_categoria', payload.id_categoria)
      .eq('id_distribuidor', payload.id_distribuidor)
      .eq('id_modelo_principal', payload.id_modelo_principal)

    if (candErr) {
      setEnviando(false)
      setError(mensajeErrorDuplicado(candErr))
      return
    }

    const duplicado = (candidatos ?? []).some((c) =>
      JSON.stringify(normalizarAtributos((c.atributos ?? {}) as Record<string, unknown>)) ===
      JSON.stringify(atributosNormalizados),
    )

    if (duplicado) {
      setEnviando(false)
      toast.error('⚠️ Este producto con el mismo distribuidor y detalles ya existe. Búscalo en la lista para sumarle stock.')
      return
    }

    const { data: nuevo, error: insertErr } = await supabase
      .from('repuestos')
      .insert(payload)
      .select('id_repuesto')
      .single()

    if (insertErr) {
      setEnviando(false)
      setError(mensajeErrorDuplicado(insertErr))
      return
    }

    const todosModelos = [
      payload.id_modelo_principal as number,
      ...form.ids_compatibles,
    ]
    const compatRecords = todosModelos.map((id_modelo) => ({
      id_repuesto: nuevo.id_repuesto,
      id_modelo,
    }))

    const { error: compatErr } = await supabase
      .from('repuestos_compatibilidad')
      .insert(compatRecords)

    setEnviando(false)

    if (compatErr) {
      setError(mensajeErrorDuplicado(compatErr))
      return
    }

    onSuccess()
  }

  if (cargandoCatalogos) {
    return (
      <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-xl p-6">
          <p className="text-sm text-slate-500">Cargando formulario…</p>
        </div>
      </div>
    )
  }

  const marcaNombre = editando
    ? editando.repuestos_compatibilidad[0]?.modelos.marcas.nombre ?? '—'
    : null
  const modeloNombre = editando
    ? editando.repuestos_compatibilidad[0]?.modelos.nombre ?? '—'
    : null

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center pt-12 overflow-y-auto">
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6 mb-12"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">
              {editando ? 'Editar Repuesto' : 'Nuevo Repuesto'}
            </h3>
            {editando && (
              <p className="text-sm text-slate-600 mt-1">
                {marcaNombre} {modeloNombre}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1 rounded-md transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm p-3">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          {/* Categoría */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Categoría</label>
            <select
              name="id_categoria"
              value={form.id_categoria}
              onChange={handleChange}
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Seleccionar…</option>
              {categorias.map((c) => (
                <option key={c.id_categoria} value={c.id_categoria}>{c.nombre}</option>
              ))}
            </select>
          </div>

          {/* Distribuidor */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Distribuidor</label>
            <select
              name="id_distribuidor"
              value={form.id_distribuidor}
              onChange={handleChange}
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Seleccionar…</option>
              {distribuidores.map((d) => (
                <option key={d.id_distribuidor} value={d.id_distribuidor}>{d.nombre}</option>
              ))}
            </select>
          </div>

          {/* Marca */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Marca</label>
            <select
              name="id_marca"
              value={form.id_marca}
              onChange={handleChange}
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Seleccionar…</option>
              {marcas.map((m) => (
                <option key={m.id_marca} value={m.id_marca}>{m.nombre}</option>
              ))}
            </select>
          </div>

          <div />

          {/* Modelo Principal */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Modelo Principal <span className="text-red-500">*</span>
            </label>
            {form.id_marca === '' ? (
              <p className="text-xs text-slate-400 italic">Primero elige una marca.</p>
            ) : (
              <select
                name="id_modelo_principal"
                value={form.id_modelo_principal}
                onChange={handleChange}
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Seleccionar…</option>
                {modelos.map((m) => (
                  <option key={m.id_modelo} value={m.id_modelo}>{m.nombre}</option>
                ))}
              </select>
            )}
          </div>

          <div />

          {/* Modelos Compatibles */}
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Modelos Compatibles <span className="text-xs text-slate-400 font-normal">(opcional)</span>
            </label>
            {form.id_modelo_principal === '' ? (
              <p className="text-xs text-slate-400 italic">Primero elige el modelo principal.</p>
            ) : (
              <div className="flex gap-2 mb-2">
                <select
                  value={nuevoCompatible}
                  onChange={(e) =>
                    setNuevoCompatible(e.target.value === '' ? '' : Number(e.target.value))
                  }
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Seleccionar…</option>
                  {modelos
                    .filter((m) => m.id_modelo !== form.id_modelo_principal)
                    .filter((m) => !form.ids_compatibles.includes(m.id_modelo))
                    .map((m) => (
                      <option key={m.id_modelo} value={m.id_modelo}>{m.nombre}</option>
                    ))}
                </select>
                <button
                  type="button"
                  onClick={agregarCompatible}
                  disabled={nuevoCompatible === ''}
                  className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50 transition-colors cursor-pointer shrink-0"
                >
                  Añadir
                </button>
              </div>
            )}
            {form.ids_compatibles.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {form.ids_compatibles.map((id) => {
                  const m = modelos.find((mo) => mo.id_modelo === id)
                  return (
                    <span
                      key={id}
                      className="inline-flex items-center gap-1.5 rounded-full bg-indigo-100 text-indigo-700 px-3 py-1 text-xs font-medium"
                    >
                      {m?.nombre ?? id}
                      <button
                        type="button"
                        onClick={() => removerCompatible(id)}
                        className="text-indigo-500 hover:text-indigo-800 cursor-pointer leading-none text-sm"
                      >
                        &times;
                      </button>
                    </span>
                  )
                })}
              </div>
            )}
          </div>

          {/* Atributos dinámicos */}
          {camposAtributos.length > 0 && (
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Detalles del repuesto
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border border-slate-200 rounded-lg p-3">
                {camposAtributos.map((campo) => (
                  <div key={campo.nombre}>
                    {campo.tipo === 'select' && (
                      <div>
                        <label className="block text-xs text-slate-500 mb-0.5">{campo.label}</label>
                        <select
                          name={`atr_${campo.nombre}`}
                          value={(atributos[campo.nombre] as string) ?? ''}
                          onChange={handleChange}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Seleccionar…</option>
                          {campo.opciones?.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    {campo.tipo === 'text' && (
                      <div>
                        <label className="block text-xs text-slate-500 mb-0.5">{campo.label}</label>
                        <input
                          type="text"
                          name={`atr_${campo.nombre}`}
                          value={(atributos[campo.nombre] as string) ?? ''}
                          onChange={handleChange}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    )}
                    {campo.tipo === 'checkbox' && (
                      <div className="flex items-center min-h-[2.5rem]">
                        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                          <input
                            type="checkbox"
                            name={`atr_${campo.nombre}`}
                            checked={(atributos[campo.nombre] as boolean) ?? false}
                            onChange={handleChange}
                            className="rounded border-slate-300 text-blue-700 focus:ring-blue-500"
                          />
                          {campo.label}
                        </label>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Calidad específica para Baterías */}
          {esBaterias && (
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Detalles del repuesto
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border border-slate-200 rounded-lg p-3">
                <div>
                  <label className="block text-xs text-slate-500 mb-0.5">Calidad</label>
                  <select
                    name="atr_calidad"
                    value={(atributos.calidad as string) ?? ''}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Seleccionar calidad...</option>
                    <option value="Deji">Deji</option>
                    <option value="ORIG">ORIG</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Stock */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Stock</label>
            <input
              type="number"
              name="stock"
              min={0}
              value={form.stock}
              onChange={handleChange}
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Costo Distribuidor */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Costo Distribuidor ($)</label>
            <input
              type="number"
              name="costo_distribuidor"
              min={0}
              step="0.01"
              value={form.costo_distribuidor}
              onChange={handleChange}
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* ─── Admin: Calculadora Inteligente ─── */}
          {isAdmin && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">% Margen</label>
              <input
                type="number"
                min={0}
                step="0.5"
                value={margen}
                onChange={(e) => setMargen(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Precio Técnico ($)</label>
            <input
              type="number"
              name="precio_tecnico"
              min={0}
              step="0.01"
              value={form.precio_tecnico}
              onChange={handleChange}
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Precio Cliente ($)</label>
            <input
              type="number"
              name="precio_cliente"
              min={0}
              step="0.01"
              value={form.precio_cliente}
              onChange={handleChange}
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {isAdmin && (
            <div className="sm:col-span-2 -mt-2">
              {Number(form.costo_distribuidor) > 0 && (
                <p className="text-xs text-slate-500">
                  Sugerencia: $ {Number(form.costo_distribuidor).toFixed(2)} + ({Number(form.costo_distribuidor).toFixed(2)} × {margen}%) = $ {precioCalculado.toFixed(2)}
                </p>
              )}
            </div>
          )}

          {/* Botones */}
          <div className="sm:col-span-2 flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={enviando}
              className="rounded-lg bg-blue-700 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              {enviando ? 'Guardando…' : editando ? 'Actualizar' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
