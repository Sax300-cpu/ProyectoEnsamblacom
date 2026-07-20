import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { RepuestoConRelaciones } from '../types/database'

export function InventoryTable() {
  const [repuestos, setRepuestos] = useState<RepuestoConRelaciones[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const obtenerRepuestos = async () => {
      setCargando(true)
      setError(null)

      const { data, error } = await supabase
        .from('repuestos')
        .select(`
          *,
          modelos!inner (
            id_modelo,
            nombre,
            marcas!inner (
              id_marca,
              nombre
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
        .order('id_repuesto', { ascending: true })

      if (error) {
        setError(error.message)
        setRepuestos([])
      } else {
        setRepuestos(data as unknown as RepuestoConRelaciones[])
      }

      setCargando(false)
    }

    obtenerRepuestos()
  }, [])

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
    <div className="overflow-x-auto rounded-lg border border-slate-200 shadow-sm">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="bg-slate-100 text-slate-600 uppercase text-xs tracking-wider">
            <th className="text-left px-4 py-3 font-semibold">Categoría</th>
            <th className="text-left px-4 py-3 font-semibold">Marca</th>
            <th className="text-left px-4 py-3 font-semibold">Modelo</th>
            <th className="text-left px-4 py-3 font-semibold">Distribuidor</th>
            <th className="text-right px-4 py-3 font-semibold">Stock</th>
            <th className="text-right px-4 py-3 font-semibold">Costo</th>
            <th className="text-right px-4 py-3 font-semibold">Precio Técnico</th>
            <th className="text-right px-4 py-3 font-semibold">Precio Cliente</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {repuestos.map((r) => (
            <tr key={r.id_repuesto} className="hover:bg-slate-50 transition-colors">
              <td className="px-4 py-3 text-slate-700">{r.categorias.nombre}</td>
              <td className="px-4 py-3 text-slate-700">{r.modelos.marcas.nombre}</td>
              <td className="px-4 py-3 text-slate-700 font-medium">{r.modelos.nombre}</td>
              <td className="px-4 py-3 text-slate-700">{r.distribuidores.nombre}</td>
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
