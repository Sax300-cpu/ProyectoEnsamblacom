import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Categoria, Marca, Modelo, Distribuidor } from '../types/database'

type Tab = 'categorias' | 'marcas' | 'modelos' | 'distribuidores'

const tabs: { key: Tab; label: string }[] = [
  { key: 'categorias', label: 'Categorías' },
  { key: 'marcas', label: 'Marcas' },
  { key: 'modelos', label: 'Modelos' },
  { key: 'distribuidores', label: 'Distribuidores' },
]

/* ───── hook reutilizable para formulario de inserción/edición + tabla ───── */
function useCatalog<T extends object>(
  table: string,
  fetchQuery: () => Promise<T[]>,
  insertPayload: (form: Partial<T>) => Record<string, unknown>,
  updatePayload: (form: Partial<T>) => Record<string, unknown>,
) {
  const [items, setItems] = useState<T[]>([])
  const [editando, setEditando] = useState<T | null>(null)
  const [cargando, setCargando] = useState(false)
  const [form, setForm] = useState<Partial<T>>({})

  const cargar = async () => {
    const data = await fetchQuery()
    setItems(data)
  }

  useEffect(() => { cargar() }, [])

  const resetForm = () => {
    setForm({})
    setEditando(null)
  }

  const toRecord = (obj: T): Record<string, unknown> => obj as unknown as Record<string, unknown>

  const getIdKey = (obj: T): string =>
    Object.keys(obj).find(k => k.startsWith('id_')) as string

  const handleSubmit = async () => {
    setCargando(true)
    let error
    if (editando) {
      const rec = toRecord(editando)
      const idKey = getIdKey(editando)
      ;({ error } = await supabase.from(table).update(updatePayload(form)).eq(idKey, rec[idKey]))
    } else {
      ;({ error } = await supabase.from(table).insert(insertPayload(form)))
    }
    setCargando(false)
    if (!error) {
      resetForm()
      cargar()
    }
  }

  const handleEdit = (item: T) => {
    setForm({ ...item })
    setEditando(item)
  }

  const handleDelete = async (item: T) => {
    const rec = toRecord(item)
    const idKey = getIdKey(item)
    const idVal = rec[idKey]
    const name = (rec.nombre as string) ?? ''
    if (!window.confirm(`¿Eliminar "${name}"?`)) return
    const { error } = await supabase.from(table).delete().eq(idKey, idVal)
    if (!error) {
      const editRec = editando ? toRecord(editando) : null
      if (editRec && editRec[idKey] === idVal) resetForm()
      cargar()
    }
  }

  return { items, form, setForm, editando, cargando, handleSubmit, handleEdit, handleDelete, resetForm }
}

/* ───── Categorías ───── */
function TabCategorias() {
  const { items, form, setForm, editando, cargando, handleSubmit, handleEdit, handleDelete, resetForm } = useCatalog<Categoria>(
    'categorias',
    async () => {
      const { data } = await supabase.from('categorias').select('*').order('nombre')
      return (data ?? []) as Categoria[]
    },
    (f) => ({ nombre: (f.nombre ?? '').trim() }),
    (f) => ({ nombre: (f.nombre ?? '').trim() }),
  )

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          placeholder="Nombre de la categoría"
          value={(form.nombre as string) ?? ''}
          onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))}
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={handleSubmit}
          disabled={cargando || !(form.nombre as string)?.trim()}
          className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50 transition-colors cursor-pointer shrink-0"
        >
          {cargando ? '…' : editando ? 'Actualizar' : 'Agregar'}
        </button>
        {editando && (
          <button
            onClick={resetForm}
            className="rounded-lg bg-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-400 transition-colors cursor-pointer shrink-0"
          >
            Cancelar
          </button>
        )}
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-100 text-slate-600 uppercase text-xs tracking-wider">
            <th className="text-left px-3 py-2 font-semibold">ID</th>
            <th className="text-left px-3 py-2 font-semibold">Nombre</th>
            <th className="text-center px-3 py-2 font-semibold">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {items.map((i) => (
            <tr key={i.id_categoria} className="hover:bg-slate-50">
              <td className="px-3 py-2 text-slate-500">{i.id_categoria}</td>
              <td className="px-3 py-2 text-slate-700">{i.nombre}</td>
              <td className="px-3 py-2 text-center">
                <div className="flex items-center justify-center gap-1">
                  <button onClick={() => handleEdit(i)} className="cursor-pointer text-xs p-1 rounded hover:bg-slate-200 transition-colors" title="Editar">✏️</button>
                  <button onClick={() => handleDelete(i)} className="cursor-pointer text-xs p-1 rounded hover:bg-red-100 transition-colors" title="Eliminar">🗑️</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ───── Marcas ───── */
function TabMarcas() {
  const { items, form, setForm, editando, cargando, handleSubmit, handleEdit, handleDelete, resetForm } = useCatalog<Marca>(
    'marcas',
    async () => {
      const { data } = await supabase.from('marcas').select('*').order('nombre')
      return (data ?? []) as Marca[]
    },
    (f) => ({ nombre: (f.nombre ?? '').trim() }),
    (f) => ({ nombre: (f.nombre ?? '').trim() }),
  )

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          placeholder="Nombre de la marca"
          value={(form.nombre as string) ?? ''}
          onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))}
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={handleSubmit}
          disabled={cargando || !(form.nombre as string)?.trim()}
          className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50 transition-colors cursor-pointer shrink-0"
        >
          {cargando ? '…' : editando ? 'Actualizar' : 'Agregar'}
        </button>
        {editando && (
          <button
            onClick={resetForm}
            className="rounded-lg bg-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-400 transition-colors cursor-pointer shrink-0"
          >
            Cancelar
          </button>
        )}
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-100 text-slate-600 uppercase text-xs tracking-wider">
            <th className="text-left px-3 py-2 font-semibold">ID</th>
            <th className="text-left px-3 py-2 font-semibold">Nombre</th>
            <th className="text-center px-3 py-2 font-semibold">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {items.map((i) => (
            <tr key={i.id_marca} className="hover:bg-slate-50">
              <td className="px-3 py-2 text-slate-500">{i.id_marca}</td>
              <td className="px-3 py-2 text-slate-700">{i.nombre}</td>
              <td className="px-3 py-2 text-center">
                <div className="flex items-center justify-center gap-1">
                  <button onClick={() => handleEdit(i)} className="cursor-pointer text-xs p-1 rounded hover:bg-slate-200 transition-colors" title="Editar">✏️</button>
                  <button onClick={() => handleDelete(i)} className="cursor-pointer text-xs p-1 rounded hover:bg-red-100 transition-colors" title="Eliminar">🗑️</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ───── Modelos (con paginación desde servidor) ───── */
const MODEL_PAGE_SIZE = 10

function TabModelos() {
  const [marcas, setMarcas] = useState<Marca[]>([])
  const [items, setItems] = useState<Modelo[]>([])
  const [editando, setEditando] = useState<Modelo | null>(null)
  const [cargando, setCargando] = useState(false)
  const [form, setForm] = useState<Partial<Modelo>>({ id_marca: '' as unknown as number })
  const [modelCurrentPage, setModelCurrentPage] = useState(1)
  const [modelTotalItems, setModelTotalItems] = useState(0)

  const modelTotalPages = Math.max(1, Math.ceil(modelTotalItems / MODEL_PAGE_SIZE))

  const cargarModelos = async (page: number) => {
    setCargando(true)
    const from = (page - 1) * MODEL_PAGE_SIZE
    const to = from + MODEL_PAGE_SIZE - 1

    const { count, data } = await supabase
      .from('modelos')
      .select('*, marcas(*)', { count: 'exact' })
      .order('nombre')
      .range(from, to)

    if (data) setItems(data as Modelo[])
    setModelTotalItems(count ?? 0)
    setCargando(false)
  }

  const cargarMarcas = async () => {
    const { data } = await supabase.from('marcas').select('*').order('nombre')
    if (data) setMarcas(data as Marca[])
  }

  useEffect(() => {
    cargarMarcas()
    cargarModelos(1)
  }, [])

  useEffect(() => {
    cargarModelos(modelCurrentPage)
  }, [modelCurrentPage])

  const resetForm = () => {
    setForm({ id_marca: '' as unknown as number })
    setEditando(null)
  }

  const handleSubmit = async () => {
    const idMarca = form.id_marca as number | undefined
    const nombre = (form.nombre as string)?.trim()
    if (!idMarca || !nombre) return
    setCargando(true)
    let error
    if (editando) {
      ;({ error } = await supabase.from('modelos').update({ id_marca: idMarca, nombre }).eq('id_modelo', editando.id_modelo))
    } else {
      ;({ error } = await supabase.from('modelos').insert({ id_marca: idMarca, nombre }))
    }
    setCargando(false)
    if (!error) {
      resetForm()
      if (editando) {
        cargarModelos(modelCurrentPage)
      } else {
        setModelCurrentPage(1)
      }
    }
  }

  const handleEdit = (item: Modelo) => {
    setForm({ id_marca: item.id_marca, nombre: item.nombre })
    setEditando(item)
  }

  const handleDelete = async (item: Modelo) => {
    if (!window.confirm(`¿Eliminar "${item.nombre}"?`)) return
    const { error } = await supabase.from('modelos').delete().eq('id_modelo', item.id_modelo)
    if (!error) {
      if (editando?.id_modelo === item.id_modelo) resetForm()
      const stillHasItems = modelCurrentPage > 1 && items.length <= 1
      cargarModelos(stillHasItems ? modelCurrentPage - 1 : modelCurrentPage)
    }
  }

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <select
          value={(form.id_marca as number | undefined) ?? ''}
          onChange={(e) => setForm((p) => ({ ...p, id_marca: e.target.value === '' ? ('' as unknown as undefined) : Number(e.target.value) }))}
          className="w-48 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Marca…</option>
          {marcas.map((m) => (
            <option key={m.id_marca} value={m.id_marca}>{m.nombre}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Nombre del modelo"
          value={(form.nombre as string) ?? ''}
          onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))}
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={handleSubmit}
          disabled={cargando || (form.id_marca as number | '') === '' || !(form.nombre as string)?.trim()}
          className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50 transition-colors cursor-pointer shrink-0"
        >
          {cargando ? '…' : editando ? 'Actualizar' : 'Agregar'}
        </button>
        {editando && (
          <button
            onClick={resetForm}
            className="rounded-lg bg-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-400 transition-colors cursor-pointer shrink-0"
          >
            Cancelar
          </button>
        )}
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-100 text-slate-600 uppercase text-xs tracking-wider">
            <th className="text-left px-3 py-2 font-semibold">ID</th>
            <th className="text-left px-3 py-2 font-semibold">Modelo</th>
            <th className="text-left px-3 py-2 font-semibold">Marca</th>
            <th className="text-center px-3 py-2 font-semibold">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {items.map((i) => (
            <tr key={i.id_modelo} className="hover:bg-slate-50">
              <td className="px-3 py-2 text-slate-500">{i.id_modelo}</td>
              <td className="px-3 py-2 text-slate-700">{i.nombre}</td>
              <td className="px-3 py-2 text-slate-700">{i.marcas?.nombre}</td>
              <td className="px-3 py-2 text-center">
                <div className="flex items-center justify-center gap-1">
                  <button onClick={() => handleEdit(i)} className="cursor-pointer text-xs p-1 rounded hover:bg-slate-200 transition-colors" title="Editar">✏️</button>
                  <button onClick={() => handleDelete(i)} className="cursor-pointer text-xs p-1 rounded hover:bg-red-100 transition-colors" title="Eliminar">🗑️</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {modelTotalPages > 1 && (
        <div className="flex items-center justify-center gap-4 mt-4">
          <button
            onClick={() => setModelCurrentPage((p) => Math.max(1, p - 1))}
            disabled={modelCurrentPage <= 1}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            &lt; Anterior
          </button>
          <span className="text-sm text-slate-600">
            Página {modelCurrentPage} de {modelTotalPages}
          </span>
          <button
            onClick={() => setModelCurrentPage((p) => Math.min(modelTotalPages, p + 1))}
            disabled={modelCurrentPage >= modelTotalPages}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            Siguiente &gt;
          </button>
        </div>
      )}
    </div>
  )
}

/* ───── Distribuidores ───── */
function TabDistribuidores() {
  const { items, form, setForm, editando, cargando, handleSubmit, handleEdit, handleDelete, resetForm } = useCatalog<Distribuidor>(
    'distribuidores',
    async () => {
      const { data } = await supabase.from('distribuidores').select('*').order('nombre')
      return (data ?? []) as Distribuidor[]
    },
    (f) => ({ nombre: (f.nombre as string ?? '').trim(), contacto: (f.contacto as string ?? '').trim() || null }),
    (f) => ({ nombre: (f.nombre as string ?? '').trim(), contacto: (f.contacto as string ?? '').trim() || null }),
  )

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          placeholder="Nombre del distribuidor"
          value={(form.nombre as string) ?? ''}
          onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))}
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          type="text"
          placeholder="Contacto (opcional)"
          value={(form.contacto as string) ?? ''}
          onChange={(e) => setForm((p) => ({ ...p, contacto: e.target.value }))}
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={handleSubmit}
          disabled={cargando || !(form.nombre as string)?.trim()}
          className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50 transition-colors cursor-pointer shrink-0"
        >
          {cargando ? '…' : editando ? 'Actualizar' : 'Agregar'}
        </button>
        {editando && (
          <button
            onClick={resetForm}
            className="rounded-lg bg-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-400 transition-colors cursor-pointer shrink-0"
          >
            Cancelar
          </button>
        )}
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-100 text-slate-600 uppercase text-xs tracking-wider">
            <th className="text-left px-3 py-2 font-semibold">ID</th>
            <th className="text-left px-3 py-2 font-semibold">Nombre</th>
            <th className="text-left px-3 py-2 font-semibold">Contacto</th>
            <th className="text-center px-3 py-2 font-semibold">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {items.map((i) => (
            <tr key={i.id_distribuidor} className="hover:bg-slate-50">
              <td className="px-3 py-2 text-slate-500">{i.id_distribuidor}</td>
              <td className="px-3 py-2 text-slate-700">{i.nombre}</td>
              <td className="px-3 py-2 text-slate-700">{i.contacto ?? '—'}</td>
              <td className="px-3 py-2 text-center">
                <div className="flex items-center justify-center gap-1">
                  <button onClick={() => handleEdit(i)} className="cursor-pointer text-xs p-1 rounded hover:bg-slate-200 transition-colors" title="Editar">✏️</button>
                  <button onClick={() => handleDelete(i)} className="cursor-pointer text-xs p-1 rounded hover:bg-red-100 transition-colors" title="Eliminar">🗑️</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function Configuration() {
  const [tab, setTab] = useState<Tab>('categorias')

  return (
    <section>
      <h2 className="text-2xl font-semibold text-slate-800 mb-4">Configuración</h2>

      <div className="flex gap-1 mb-6 border-b border-slate-200">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
              tab === t.key
                ? 'border-blue-700 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'categorias' && <TabCategorias />}
      {tab === 'marcas' && <TabMarcas />}
      {tab === 'modelos' && <TabModelos />}
      {tab === 'distribuidores' && <TabDistribuidores />}
    </section>
  )
}
