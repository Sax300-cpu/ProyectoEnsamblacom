import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Categoria, Marca, Modelo, Distribuidor } from '../types/database'

interface FormState {
  id_categoria: number | ''
  id_marca: number | ''
  id_modelo: number | ''
  id_distribuidor: number | ''
  stock: number | ''
  costo_distribuidor: number | ''
  precio_tecnico: number | ''
  precio_cliente: number | ''
}

const initialState: FormState = {
  id_categoria: '',
  id_marca: '',
  id_modelo: '',
  id_distribuidor: '',
  stock: '',
  costo_distribuidor: '',
  precio_tecnico: '',
  precio_cliente: '',
}

const CATEGORIA_PANTALLAS = 1

interface Props {
  seccion: 'pantallas' | 'otros'
  onSuccess?: () => void
  onCancel?: () => void
}

export function AddRepuestoForm({ seccion, onSuccess, onCancel }: Props) {
  const [form, setForm] = useState<FormState>(initialState)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [marcas, setMarcas] = useState<Marca[]>([])
  const [modelos, setModelos] = useState<Modelo[]>([])
  const [distribuidores, setDistribuidores] = useState<Distribuidor[]>([])

  const [cargandoCatalogos, setCargandoCatalogos] = useState(true)

  useEffect(() => {
    const cargarCatalogos = async () => {
      if (seccion === 'pantallas') {
        const { data, error } = await supabase
          .from('categorias')
          .select('*')
          .eq('id_categoria', CATEGORIA_PANTALLAS)
          .single()
        if (!error && data) {
          setCategorias([data as Categoria])
          setForm((prev) => ({ ...prev, id_categoria: CATEGORIA_PANTALLAS }))
        } else {
          setError('Error al cargar categoría.')
        }
      } else {
        const { data, error } = await supabase
          .from('categorias')
          .select('*')
          .neq('id_categoria', CATEGORIA_PANTALLAS)
          .order('nombre')
        if (!error && data) {
          setCategorias(data as Categoria[])
        } else {
          setError('Error al cargar categorías.')
        }
      }

      const [
        { data: mars, error: errMars },
        { data: dists, error: errDists },
      ] = await Promise.all([
        supabase.from('marcas').select('*').order('nombre'),
        supabase.from('distribuidores').select('*').order('nombre'),
      ])

      if (errMars || errDists) {
        setError('Error al cargar datos del formulario.')
      } else {
        if (mars) setMarcas(mars as Marca[])
        if (dists) setDistribuidores(dists as Distribuidor[])
      }

      setCargandoCatalogos(false)
    }

    cargarCatalogos()
  }, [seccion])

  useEffect(() => {
    if (form.id_marca === '') {
      setModelos([])
      setForm((prev) => ({ ...prev, id_modelo: '' }))
      return
    }

    let cancel = false

    const cargarModelos = async () => {
      const { data } = await supabase
        .from('modelos')
        .select('*')
        .eq('id_marca', form.id_marca)
        .order('nombre')

      if (!cancel && data) {
        setModelos(data as Modelo[])
      }
    }

    cargarModelos()

    return () => {
      cancel = true
    }
  }, [form.id_marca])

  const handleChange = (
    e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>,
  ) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value === '' ? '' : Number(value) }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setEnviando(true)

    const { error: insertError } = await supabase.from('repuestos').insert({
      id_categoria: form.id_categoria as number,
      id_modelo: form.id_modelo as number,
      id_distribuidor: form.id_distribuidor as number,
      stock: form.stock as number,
      costo_distribuidor: form.costo_distribuidor as number,
      precio_tecnico: form.precio_tecnico as number,
      precio_cliente: form.precio_cliente as number,
    })

    setEnviando(false)

    if (insertError) {
      setError(insertError.message)
      return
    }

    setForm(initialState)
    onSuccess?.()
  }

  if (cargandoCatalogos) {
    return (
      <div className="flex justify-center py-6 text-slate-500 text-sm">
        Cargando formulario…
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-6 mb-6">
      <h3 className="text-lg font-semibold text-slate-800 mb-4">
        Nuevo Repuesto
      </h3>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm p-3">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Categoría
          </label>
          <select
            name="id_categoria"
            value={form.id_categoria}
            onChange={handleChange}
            required
            disabled={seccion === 'pantallas'}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {categorias.length === 0 && <option value="">Seleccionar…</option>}
            {categorias.map((c) => (
              <option key={c.id_categoria} value={c.id_categoria}>
                {c.nombre}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Distribuidor
          </label>
          <select
            name="id_distribuidor"
            value={form.id_distribuidor}
            onChange={handleChange}
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Seleccionar…</option>
            {distribuidores.map((d) => (
              <option key={d.id_distribuidor} value={d.id_distribuidor}>
                {d.nombre}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Marca
          </label>
          <select
            name="id_marca"
            value={form.id_marca}
            onChange={handleChange}
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Seleccionar…</option>
            {marcas.map((m) => (
              <option key={m.id_marca} value={m.id_marca}>
                {m.nombre}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Modelo
          </label>
          <select
            name="id_modelo"
            value={form.id_modelo}
            onChange={handleChange}
            required
            disabled={form.id_marca === ''}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="">
              {form.id_marca === '' ? 'Primero elige una marca' : 'Seleccionar…'}
            </option>
            {modelos.map((m) => (
              <option key={m.id_modelo} value={m.id_modelo}>
                {m.nombre}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Stock
          </label>
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

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Costo Distribuidor (S/)
          </label>
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
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Precio Técnico (S/)
          </label>
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
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Precio Cliente (S/)
          </label>
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

        <div className="sm:col-span-2 flex justify-end gap-3 pt-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg border border-slate-300 px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
          )}
          <button
            type="submit"
            disabled={enviando}
            className="rounded-lg bg-blue-700 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            {enviando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </div>
  )
}
