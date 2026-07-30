import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { RepuestoConRelaciones, Marca, Modelo, Distribuidor } from '../types/database'
import { useAuth } from '../contexts/AuthContext'
import { useCart } from '../contexts/CartContext'

const CATEGORIA_PANTALLAS = 1
const PAGE_SIZE = 10

/* ───── Atributos dinámicos ───── */
interface AtributoField {
  tipo: 'select' | 'checkbox' | 'text'
  nombre: string
  label: string
  opciones?: string[]
}

const camposPantalla: AtributoField[] = [
  { tipo: 'select', nombre: 'calidad', label: 'Calidad', opciones: ['OLED', 'INCELL', 'ORIG'] },
  { tipo: 'text', nombre: 'color', label: 'Color' },
  { tipo: 'checkbox', nombre: 'con_bisel', label: 'Con Bisel' },
]

/* ───── Estado del formulario ───── */
interface FormState {
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
  id_marca: '',
  id_modelo_principal: '',
  ids_compatibles: [],
  id_distribuidor: '',
  stock: '',
  costo_distribuidor: '',
  precio_tecnico: '',
  precio_cliente: '',
}

/* ───── Componente ───── */
export function Pantallas() {
  const { isAdmin } = useAuth()

  /* ── Estados de tabla ── */
  const [repuestos, setRepuestos] = useState<RepuestoConRelaciones[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [buscar, setBuscar] = useState('')
  const [soloConBisel, setSoloConBisel] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const [refreshKey, setRefreshKey] = useState(0)

  const { addToCart, openCart } = useCart()

  /* ── Estados de modal ── */
  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState<RepuestoConRelaciones | null>(null)

  /* ── Carga de tabla ── */
  useEffect(() => {
    setCurrentPage(1)
  }, [buscar, soloConBisel])

  useEffect(() => {
    setCargando(true)
    setError(null)

    const fetchData = async () => {
      let countQuery = supabase
        .from('repuestos')
        .select('*', { count: 'exact', head: true })
        .eq('id_categoria', CATEGORIA_PANTALLAS)

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
        .eq('id_categoria', CATEGORIA_PANTALLAS)

      if (soloConBisel) {
        countQuery = countQuery.contains('atributos', { con_bisel: true })
        dataQuery = dataQuery.contains('atributos', { con_bisel: true })
      }

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
  }, [currentPage, buscar, soloConBisel, refreshKey])

  return (
    <section>
      <h2 className="text-2xl font-semibold text-slate-800 mb-4">Pantallas</h2>

      <div className="flex items-center gap-3 mb-4">
        <input
          type="text"
          placeholder="Buscar por modelo, marca o categoría…"
          value={buscar}
          onChange={(e) => setBuscar(e.target.value)}
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none shrink-0">
          <input
            type="checkbox"
            checked={soloConBisel}
            onChange={(e) => setSoloConBisel(e.target.checked)}
            className="rounded border-slate-300 text-blue-700 focus:ring-blue-500"
          />
          Solo con bisel
        </label>
        <button
          onClick={() => { setEditando(null); setModalOpen(true) }}
          className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 transition-colors shrink-0 cursor-pointer"
        >
          Agregar +
        </button>
      </div>

      {/* ───── Tabla ───── */}
      {cargando ? (
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3 text-slate-500">
            <svg className="animate-spin h-8 w-8" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-sm">Cargando pantallas…</span>
          </div>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">
          Error al cargar los datos: {error}
        </div>
      ) : repuestos.length === 0 ? (
        <div className="text-center py-12 text-slate-500 text-sm">
          No hay pantallas registradas.
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-slate-200 shadow-sm">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-slate-100 text-slate-600 uppercase text-xs tracking-wider">
                  <th className="text-left px-4 py-3 font-semibold">Marca</th>
                  <th className="text-left px-4 py-3 font-semibold">Modelo</th>
                  <th className="text-left px-4 py-3 font-semibold">Distribuidor</th>
                  <th className="text-left px-4 py-3 font-semibold">Detalles</th>
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
                          {isAdmin && (
                            <button
                              onClick={() => { setEditando(r); setModalOpen(true) }}
                              className="bg-amber-500 text-white hover:bg-amber-600 px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer"
                              title="Editar Precios"
                            >
                              Editar
                            </button>
                          )}
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
                                distribuidor: r.distribuidores.nombre,
                                detalles: r.atributos ?? {},
                              })
                              openCart()
                            }}
                            className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors cursor-pointer"
                          >
                            Vender
                          </button>
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

      {/* ───── Modal Agregar / Editar ───── */}
      {modalOpen && (
        <ModalPantalla
          isAdmin={isAdmin}
          editando={editando}
          onClose={() => { setModalOpen(false); setEditando(null) }}
          onSuccess={() => {
            setModalOpen(false)
            setEditando(null)
            setRefreshKey((k) => k + 1)
          }}
        />
      )}
    </section>
  )
}

/* ───── Modal Agregar / Editar ───── */
interface ModalProps {
  isAdmin: boolean
  editando: RepuestoConRelaciones | null
  onClose: () => void
  onSuccess: () => void
}

function ModalPantalla({ isAdmin, editando, onClose, onSuccess }: ModalProps) {
  const [form, setForm] = useState<FormState>(() => {
    if (editando) {
      // Ensure idMarca is a string so comparisons with '' are type-safe
      const idMarca = editando.repuestos_compatibilidad[0]?.modelos.marcas.id_marca?.toString() ?? ''
      const idsCompatibles = editando.repuestos_compatibilidad
        .map((rc) => rc.id_modelo)
        .filter((id) => id !== editando.id_modelo_principal)
      return {
        id_marca: idMarca === '' ? '' : Number(idMarca),
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

  const [marcas, setMarcas] = useState<Marca[]>([])
  const [modelos, setModelos] = useState<Modelo[]>([])
  const [distribuidores, setDistribuidorList] = useState<Distribuidor[]>([])

  const [cargandoCatalogos, setCargandoCatalogos] = useState(true)

  /* ───── Carga inicial ───── */
  useEffect(() => {
    const cargar = async () => {
      const [{ data: mars }, { data: dists }] = await Promise.all([
        supabase.from('marcas').select('*').order('nombre'),
        supabase.from('distribuidores').select('*').order('nombre'),
      ])
      if (mars) setMarcas(mars as Marca[])
      if (dists) setDistribuidorList(dists as Distribuidor[])
      setCargandoCatalogos(false)
    }
    cargar()
  }, [])

  /* ───── Modelos por marca ───── */
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

  /* ─── Calculadora Inteligente ─── */
  const precioCalculado = (() => {
    const costo = Number(form.costo_distribuidor)
    if (!costo || costo <= 0) return 0
    return costo + costo * (margen / 100)
  })()

  /* ───── Handlers ───── */
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
    const { name, value, type } = e.target

    if (name.startsWith('atr_')) {
      const atrName = name.slice(4)
      if (type === 'checkbox') {
        setAtributos((prev) => ({ ...prev, [atrName]: (e.target as HTMLInputElement).checked }))
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

  /* ───── Submit ───── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setEnviando(true)

    const stock = Number(form.stock)
    const costo = Number(form.costo_distribuidor)
    const precioTecnico = Number(form.precio_tecnico)
    const precioCliente = Number(form.precio_cliente)

    if (!form.id_modelo_principal) {
      setError('Seleccione un modelo principal.')
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
        setError(updErr.message)
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
          setError(compatErr.message)
          return
        }
      }

      setEnviando(false)
      onSuccess()
      return
    }

    /* ── Insertar nuevo ── */
    const payload = {
      id_categoria: CATEGORIA_PANTALLAS,
      id_distribuidor: form.id_distribuidor === '' ? null : Number(form.id_distribuidor),
      id_modelo_principal: Number(form.id_modelo_principal),
      stock,
      costo_distribuidor: costo,
      precio_tecnico: precioTecnico,
      precio_cliente: precioCliente,
      atributos: atributos as Record<string, unknown>,
    }

    const { data: existente } = await supabase
      .from('repuestos')
      .select('id_repuesto, stock')
      .eq('id_categoria', CATEGORIA_PANTALLAS)
      .eq('id_distribuidor', payload.id_distribuidor)
      .eq('id_modelo_principal', payload.id_modelo_principal)
      .eq('atributos', payload.atributos)
      .maybeSingle()

    if (existente) {
      const { error: updErr } = await supabase
        .from('repuestos')
        .update({
          stock: existente.stock + payload.stock,
          costo_distribuidor: payload.costo_distribuidor,
          precio_tecnico: payload.precio_tecnico,
          precio_cliente: payload.precio_cliente,
          atributos: payload.atributos,
        })
        .eq('id_repuesto', existente.id_repuesto)

      setEnviando(false)
      if (updErr) {
        setError(updErr.message)
        return
      }
      onSuccess()
      return
    }

    const { data: nuevo, error: insertErr } = await supabase
      .from('repuestos')
      .insert(payload)
      .select('id_repuesto')
      .single()

    if (insertErr) {
      setEnviando(false)
      setError(insertErr.message)
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
      setError(compatErr.message)
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
              {editando ? 'Editar Pantalla' : 'Nueva Pantalla'}
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
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Detalles de la pantalla
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border border-slate-200 rounded-lg p-3">
              {camposPantalla.map((campo) => (
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

          {/* Stock (visible para todos) */}
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

          {/* ─── Admin: Calculadora Inteligente ─── */}
          {isAdmin ? (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Costo Distribuidor (S/)</label>
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
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Precio Técnico (S/)</label>
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
                <label className="block text-sm font-medium text-slate-700 mb-1">Precio Cliente (S/)</label>
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
              <div className="sm:col-span-2 -mt-2">
                {Number(form.costo_distribuidor) > 0 && (
                  <p className="text-xs text-slate-500">
                    Sugerencia: S/ {Number(form.costo_distribuidor).toFixed(2)} + ({Number(form.costo_distribuidor).toFixed(2)} × {margen}%) = S/ {precioCalculado.toFixed(2)}
                  </p>
                )}
              </div>
            </>
          ) : (
            /* ─── No Admin: solo Costo + Stock ─── */
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Costo Distribuidor (S/)</label>
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
