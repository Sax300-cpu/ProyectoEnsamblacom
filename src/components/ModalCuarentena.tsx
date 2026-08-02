import { useState } from 'react'
import { supabase } from '../lib/supabase'
import type { RepuestoConRelaciones } from '../types/database'
import { toast } from './Toaster'

interface ModalCuarentenaProps {
  producto: RepuestoConRelaciones
  onClose: () => void
  onSuccess: () => void
}

export function ModalCuarentena({ producto, onClose, onSuccess }: ModalCuarentenaProps) {
  const [cantidad, setCantidad] = useState<number>(1)
  const [descripcionFalla, setDescripcionFalla] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const nombreModelo = producto.repuestos_compatibilidad[0]?.modelos.nombre ?? '—'
  const marcaNombre = producto.repuestos_compatibilidad[0]?.modelos.marcas.nombre ?? '—'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!descripcionFalla.trim()) {
      setError('La descripción de la falla es obligatoria.')
      return
    }

    const cantidadFinal = Number(cantidad)
    if (!cantidadFinal || cantidadFinal < 1 || cantidadFinal > producto.stock) {
      setError(`La cantidad debe estar entre 1 y ${producto.stock}.`)
      return
    }

    setEnviando(true)

    const { error: insertErr } = await supabase
      .from('cuarentena_defectuosos')
      .insert({
        id_repuesto: producto.id_repuesto,
        cantidad: cantidadFinal,
        origen: 'Interno',
        estado_revision: 'En tienda',
        descripcion_falla: descripcionFalla.trim(),
      })

    if (insertErr) {
      setEnviando(false)
      setError(insertErr.message)
      return
    }

    const { error: updErr } = await supabase
      .from('repuestos')
      .update({ stock: producto.stock - cantidadFinal })
      .eq('id_repuesto', producto.id_repuesto)

    setEnviando(false)
    if (updErr) {
      setError('Se registró en cuarentena, pero no se pudo actualizar el stock: ' + updErr.message)
      return
    }

    toast.success('Movido a cuarentena exitosamente')
    onSuccess()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">Mover a Cuarentena</h3>
            <p className="text-sm text-slate-500 mt-0.5">
              {marcaNombre} {nombreModelo} · Stock actual: <span className="font-semibold">{producto.stock}</span>
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
            <label className="block text-sm font-medium text-slate-700 mb-1">Cantidad</label>
            <input
              type="number"
              name="cantidad"
              min={1}
              max={producto.stock}
              value={cantidad}
              onChange={(e) => setCantidad(Number(e.target.value))}
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-slate-500 mt-1">
              Máximo {producto.stock} (stock actual).
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Descripción de la falla <span className="text-red-500">*</span>
            </label>
            <textarea
              name="descripcion_falla"
              value={descripcionFalla}
              onChange={(e) => setDescripcionFalla(e.target.value)}
              required
              rows={3}
              placeholder="Detalla el problema de fábrica del producto…"
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
              className="rounded-lg bg-amber-600 px-5 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              {enviando ? 'Moviendo…' : 'Mover a Cuarentena'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
