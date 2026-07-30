import { useState } from 'react'
import { supabase } from '../lib/supabase'
import type { RepuestoConRelaciones } from '../types/database'

interface Props {
  repuesto: RepuestoConRelaciones
  onClose: () => void
  onSuccess: () => void
}

export function EditarPreciosModal({ repuesto, onClose, onSuccess }: Props) {
  const [costo, setCosto] = useState(repuesto.costo_distribuidor.toString())
  const [precioTecnico, setPrecioTecnico] = useState(repuesto.precio_tecnico.toString())
  const [precioCliente, setPrecioCliente] = useState(repuesto.precio_cliente.toString())
  const [enviando, setEnviando] = useState(false)

  const marca = repuesto.repuestos_compatibilidad[0]?.modelos.marcas.nombre ?? '—'
  const modelo = repuesto.repuestos_compatibilidad[0]?.modelos.nombre ?? '—'

  const handleGuardar = async () => {
    setEnviando(true)

    const numCosto = Number(costo)
    const numTecnico = Number(precioTecnico)
    const numCliente = Number(precioCliente)

    if (costo === '' || precioTecnico === '' || precioCliente === '') {
      alert('Los precios no pueden estar vacíos.')
      setEnviando(false)
      return
    }

    if (numCosto < 0 || numTecnico < 0 || numCliente < 0) {
      alert('Los precios no pueden ser negativos.')
      setEnviando(false)
      return
    }

    const { error: err } = await supabase
      .from('repuestos')
      .update({
        costo_distribuidor: numCosto,
        precio_tecnico: numTecnico,
        precio_cliente: numCliente,
      })
      .eq('id_repuesto', repuesto.id_repuesto)

    setEnviando(false)
    if (err) {
      alert('Error al actualizar: ' + err.message)
      return
    }
    onSuccess()
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center"
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">Editar Precios</h3>
            <p className="text-sm text-slate-600 mt-1">
              {marca} {modelo}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1 rounded-md transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Costo ($)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={costo}
              onChange={(e) => setCosto(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Precio Técnico ($)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={precioTecnico}
              onChange={(e) => setPrecioTecnico(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Precio Cliente ($)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={precioCliente}
              onChange={(e) => setPrecioCliente(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onClick={handleGuardar}
            disabled={enviando}
            className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50 transition-colors cursor-pointer"
          >
            {enviando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}
