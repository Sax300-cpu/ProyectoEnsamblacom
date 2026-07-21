import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Categoria, Marca, Modelo, Distribuidor } from '../types/database'

/* ───── Tipos para atributos dinámicos ───── */
interface AtributoField {
  tipo: 'select' | 'checkbox' | 'text'
  nombre: string
  label: string
  opciones?: string[]
}

const definicionesAtributos: Record<string, AtributoField[]> = {
  pantallas: [
    { tipo: 'select', nombre: 'calidad', label: 'Calidad', opciones: ['OLED', 'INCELL', 'ORIG'] },
    { tipo: 'text', nombre: 'color', label: 'Color' },
    { tipo: 'checkbox', nombre: 'con_bisel', label: 'Con Bisel' },
  ],
  tapas: [
    { tipo: 'text', nombre: 'color', label: 'Color' },
    { tipo: 'checkbox', nombre: 'vidrio_camara', label: 'Vidrio de Cámara' },
  ],
  'placas de carga': [
    { tipo: 'select', nombre: 'calidad', label: 'Calidad', opciones: ['Original', 'Genérica'] },
  ],
}

/* ───── Estado del formulario ───── */
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

const initialState: FormState = {
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

const CATEGORIA_PANTALLAS = 1

interface Props {
  seccion: 'pantallas' | 'otros'
  onSuccess?: () => void
  onCancel?: () => void
}

export function AddRepuestoForm({ seccion, onSuccess, onCancel }: Props) {
  const [form, setForm] = useState<FormState>(initialState)
  const [nuevoCompatible, setNuevoCompatible] = useState<number | ''>('')
  const [atributos, setAtributos] = useState<AtributosState>({})
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [marcas, setMarcas] = useState<Marca[]>([])
  const [modelos, setModelos] = useState<Modelo[]>([])
  const [distribuidores, setDistribuidorList] = useState<Distribuidor[]>([])

  const [cargandoCatalogos, setCargandoCatalogos] = useState(true)

  /* ───── Cargar catálogos ───── */
  useEffect(() => {
    const cargar = async () => {
      if (seccion === 'pantallas') {
        const { data, error: err } = await supabase
          .from('categorias')
          .select('*')
          .eq('id_categoria', CATEGORIA_PANTALLAS)
          .single()
        if (!err && data) {
          setCategorias([data as Categoria])
          setForm((prev) => ({ ...prev, id_categoria: CATEGORIA_PANTALLAS }))
        } else {
          setError('Error al cargar categoría.')
        }
      } else {
        const { data, error: err } = await supabase
          .from('categorias')
          .select('*')
          .neq('id_categoria', CATEGORIA_PANTALLAS)
          .order('nombre')
        if (!err && data) {
          setCategorias(data as Categoria[])
        } else {
          setError('Error al cargar categorías.')
        }
      }

      const [{ data: mars }, { data: dists }] = await Promise.all([
        supabase.from('marcas').select('*').order('nombre'),
        supabase.from('distribuidores').select('*').order('nombre'),
      ])

      if (mars) setMarcas(mars as Marca[])
      if (dists) setDistribuidorList(dists as Distribuidor[])
      setCargandoCatalogos(false)
    }

    cargar()
  }, [seccion])

  /* ───── Cargar modelos según marca ───── */
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

    return () => {
      cancel = true
    }
  }, [form.id_marca])

  /* ───── Campos dinámicos de atributos ───── */
  const categoriaSeleccionada = categorias.find(
    (c) => c.id_categoria === form.id_categoria,
  )
  const nombreCategoria = categoriaSeleccionada?.nombre?.toLowerCase() ?? ''
  const camposAtributos = definicionesAtributos[nombreCategoria] ?? []

  /* ───── Handlers ───── */
  const handleChange = (
    e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>,
  ) => {
    const { name, value, type } = e.target

    if (name.startsWith('atr_')) {
      const atrName = name.slice(4)
      if (type === 'checkbox') {
        const checked = (e.target as HTMLInputElement).checked
        setAtributos((prev) => ({ ...prev, [atrName]: checked }))
      } else {
        setAtributos((prev) => ({ ...prev, [atrName]: value }))
      }
      return
    }

    setForm((prev) => ({ ...prev, [name]: value === '' ? '' : Number(value) }))

    // Al cambiar marca o modelo principal, limpiar compatibles si el principal ya no coincide
    if (name === 'id_modelo_principal') {
      setNuevoCompatible('')
      setForm((prev) => ({ ...prev, ids_compatibles: [] }))
    }
  }

  const agregarCompatible = () => {
    if (nuevoCompatible === '') return
    if (nuevoCompatible === form.id_modelo_principal) return
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

    if (form.id_modelo_principal === '') {
      setError('Selecciona el modelo principal.')
      return
    }

    setEnviando(true)

    const payload = {
      id_categoria: form.id_categoria as number,
      id_distribuidor: form.id_distribuidor as number,
      id_modelo_principal: form.id_modelo_principal as number,
      stock: form.stock as number,
      costo_distribuidor: form.costo_distribuidor as number,
      precio_tecnico: form.precio_tecnico as number,
      precio_cliente: form.precio_cliente as number,
      atributos: atributos as Record<string, unknown>,
    }

    // 1. Buscar si ya existe (misma categoria + distribuidor + atributos)
    const { data: existente } = await supabase
      .from('repuestos')
      .select('id_repuesto, stock')
      .eq('id_categoria', payload.id_categoria)
      .eq('id_distribuidor', payload.id_distribuidor)
      .eq('id_modelo_principal', payload.id_modelo_principal)
      .eq('atributos', payload.atributos)
      .maybeSingle()

    if (existente) {
      // 2a. Ya existe → sumar stock y sobrescribir precios
      const { error: updErr } = await supabase
        .from('repuestos')
        .update({
          stock: existente.stock + payload.stock,
          costo_distribuidor: payload.costo_distribuidor,
          precio_tecnico: payload.precio_tecnico,
          precio_cliente: payload.precio_cliente,
        })
        .eq('id_repuesto', existente.id_repuesto)

      setEnviando(false)

      if (updErr) {
        setError(updErr.message)
        return
      }

      setForm(initialState)
      setAtributos({})
      onSuccess?.()
      return
    }

    // 2b. No existe → insertar nuevo repuesto
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

    // 3. Insertar en tabla puente (principal + compatibles)
    const todosModelos = [
      form.id_modelo_principal as number,
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

    setForm(initialState)
    setAtributos({})
    onSuccess?.()
  }

  /* ───── Render ───── */
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
        {/* Categoría */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Categoría</label>
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

        {/* Modelos Compatibles (opcional) */}
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

        {/* Costo */}
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

        {/* Precio Técnico */}
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

        {/* Precio Cliente */}
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

        {/* Botones */}
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
