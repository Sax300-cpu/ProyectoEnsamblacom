import { useState } from 'react'
import { supabase } from '../lib/supabase'
import type { RepuestoConRelaciones } from '../types/database'

interface Props {
  producto: RepuestoConRelaciones
  onClose: () => void
  onSuccess: () => void
}

export function ModalSumaStock({ producto, onClose, onSuccess }: Props) {
  const [cantidad, setCantidad] = useState(0)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const marcaNombre = producto.repuestos_compatibilidad[0]?.modelos.marcas.nombre ?? '—'
  const modeloNombre = producto.repuestos_compatibilidad[0]?.modelos.nombre ?? '—'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!cantidad || cantidad <= 0) {
      setError('Ingrese una cantidad válida.')
      return
    }

    setEnviando(true)
    const { error: err } = await supabase
      .from('repuestos')
      .update({ stock: producto.stock + cantidad })
      .eq('id_repuesto', producto.id_repuesto)

    setEnviando(false)
    if (err) {
      setError(err.message)
      return
    }
    onSuccess()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">Agregar Stock</h3>
            <p className="text-sm text-slate-500 mt-1">
              {marcaNombre} {modeloNombre}
            </p>
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

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Stock actual: <span className="font-mono font-bold">{producto.stock}</span>
            </label>
            <input
              type="number"
              min={0}
              value={cantidad}
              onChange={(e) => setCantidad(Number(e.target.value))}
              placeholder="Cantidad a ingresar"
              autoFocus
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <p className="text-xs text-slate-500">
            Nuevo stock: <span className="font-semibold">{producto.stock + cantidad}</span>
          </p>

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
              className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              {enviando ? 'Guardando…' : 'Confirmar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
