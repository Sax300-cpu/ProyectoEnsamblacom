import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { toast } from '../components/Toaster'
import { ConfirmDialog } from '../components/ConfirmDialog'

interface Cliente {
  id_cliente: number
  nombre: string
  telefono: string
  direccion: string
  fecha_creacion: string
}

const initialForm: Omit<Cliente, 'id_cliente' | 'fecha_creacion'> = {
  nombre: '',
  telefono: '',
  direccion: '',
}

const MENSAJE_CLIENTE_DUPLICADO =
  '⚠️ Ya existe un cliente registrado con este nombre o contacto. Búscalo en la lista.'

const esErrorDuplicado = (err: { message?: string; code?: string } | null): boolean =>
  err?.code === '23505' || (err?.message ?? '').toLowerCase().includes('duplicate key')

export function Clientes() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState<Cliente | null>(null)
  const [borrar, setBorrar] = useState<Cliente | null>(null)

  const cargarClientes = async () => {
    setCargando(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('clientes')
      .select('*')
      .order('id_cliente', { ascending: false })

    if (err) {
      setError(err.message)
      setClientes([])
    } else {
      setClientes(data as Cliente[])
    }
    setCargando(false)
  }

  useEffect(() => {
    cargarClientes()
  }, [])

  const handleEliminar = (c: Cliente) => setBorrar(c)

  const confirmarEliminar = async () => {
    if (!borrar) return
    const { error: err } = await supabase
      .from('clientes')
      .delete()
      .eq('id_cliente', borrar.id_cliente)

    setBorrar(null)
    if (err) {
      toast.error('❌ Error al eliminar: ' + err.message)
      return
    }
    cargarClientes()
  }

  return (
    <section>
      <h2 className="text-2xl font-semibold text-slate-800 mb-4">Clientes</h2>

      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1" />
        <button
          onClick={() => { setEditando(null); setModalOpen(true) }}
          className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 transition-colors shrink-0 cursor-pointer"
        >
          Agregar Cliente +
        </button>
      </div>

      {cargando ? (
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3 text-slate-500">
            <svg className="animate-spin h-8 w-8" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-sm">Cargando clientes…</span>
          </div>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">
          Error al cargar los datos: {error}
        </div>
      ) : clientes.length === 0 ? (
        <div className="text-center py-12 text-slate-500 text-sm">
          No hay clientes registrados.
        </div>
      ) : (
        <div className="max-h-[60vh] overflow-y-auto overflow-x-auto relative shadow-sm rounded-lg border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-100 text-slate-600 uppercase text-xs tracking-wider">
                <th className="text-left px-4 py-3 font-semibold">Nombre</th>
                <th className="text-left px-4 py-3 font-semibold">Teléfono</th>
                <th className="text-left px-4 py-3 font-semibold">Dirección</th>
                <th className="text-center px-4 py-3 font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {clientes.map((c) => (
                <tr key={c.id_cliente} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-slate-700 font-medium">{c.nombre}</td>
                  <td className="px-4 py-3 text-slate-700">{c.telefono || '—'}</td>
                  <td className="px-4 py-3 text-slate-700">{c.direccion || '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => { setEditando(c); setModalOpen(true) }}
                        className="bg-amber-500 text-white hover:bg-amber-600 px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleEliminar(c)}
                        className="bg-red-500 text-white hover:bg-red-600 px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer"
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ───── Modal ───── */}
      {modalOpen && (
        <ModalCliente
          cliente={editando}
          onClose={() => { setModalOpen(false); setEditando(null) }}
          onSuccess={() => {
            setModalOpen(false)
            setEditando(null)
            cargarClientes()
          }}
        />
      )}

      <ConfirmDialog
        abierto={!!borrar}
        titulo="Eliminar cliente"
        mensaje={`¿Eliminar "${borrar?.nombre ?? ''}"?`}
        confirmarTexto="Eliminar"
        onCancel={() => setBorrar(null)}
        onConfirm={confirmarEliminar}
      />
    </section>
  )
}

/* ───── Modal Agregar / Editar ───── */
interface ModalProps {
  cliente: Cliente | null
  onClose: () => void
  onSuccess: () => void
}

function ModalCliente({ cliente, onClose, onSuccess }: ModalProps) {
  const [form, setForm] = useState<Omit<Cliente, 'id_cliente' | 'fecha_creacion'>>(() => {
    if (cliente) {
      return {
        nombre: cliente.nombre,
        telefono: cliente.telefono,
        direccion: cliente.direccion,
      }
    }
    return { ...initialForm }
  })

  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!form.nombre.trim()) {
      setError('El nombre es obligatorio.')
      return
    }

    setEnviando(true)

    const nombreNormalizado = form.nombre.trim().replace(/\s+/g, ' ')
    const telefonoNormalizado = form.telefono.trim()

    if (cliente) {
      const { error: err } = await supabase
        .from('clientes')
        .update({
          nombre: nombreNormalizado,
          telefono: telefonoNormalizado,
          direccion: form.direccion.trim(),
        })
        .eq('id_cliente', cliente.id_cliente)

      setEnviando(false)
      if (err) {
        setError(esErrorDuplicado(err) ? MENSAJE_CLIENTE_DUPLICADO : err.message)
        return
      }
      onSuccess()
      return
    }

    const orParts = [`nombre.ilike.${nombreNormalizado}`]
    if (telefonoNormalizado) orParts.push(`telefono.eq.${telefonoNormalizado}`)

    const { data: existente } = await supabase
      .from('clientes')
      .select('id_cliente')
      .or(orParts.join(','))

    if (existente && existente.length > 0) {
      setEnviando(false)
      toast.error(MENSAJE_CLIENTE_DUPLICADO)
      return
    }

    const { error: err } = await supabase
      .from('clientes')
      .insert({
        nombre: nombreNormalizado,
        telefono: telefonoNormalizado,
        direccion: form.direccion.trim(),
      })

    setEnviando(false)
    if (err) {
      setError(esErrorDuplicado(err) ? MENSAJE_CLIENTE_DUPLICADO : err.message)
      return
    }
    onSuccess()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-lg font-semibold text-slate-800">
            {cliente ? 'Editar Cliente' : 'Nuevo Cliente'}
          </h3>
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

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Nombre <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="nombre"
              value={form.nombre}
              onChange={handleChange}
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Teléfono</label>
            <input
              type="text"
              name="telefono"
              value={form.telefono}
              onChange={handleChange}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Dirección</label>
            <input
              type="text"
              name="direccion"
              value={form.direccion}
              onChange={handleChange}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
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
              {enviando ? 'Guardando…' : cliente ? 'Actualizar' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
