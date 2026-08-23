import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatearDetalles } from '../lib/format'

export interface RepuestoRow {
  id_repuesto: number
  stock: number
  categorias: { nombre: string }
  distribuidores: { nombre: string }
  atributos: Record<string, unknown>
  modelos: { nombre: string; marcas: { nombre: string } } | null
}

interface Props {
  open: boolean
  onClose: () => void
  repuestos: RepuestoRow[]
}

export function ReponerStockModal({ open, onClose, repuestos }: Props) {
  const [lista, setLista] = useState<RepuestoRow[]>(repuestos)
  const [busqueda, setBusqueda] = useState('')
  const [cantidades, setCantidades] = useState<Record<number, number | ''>>({})

  useEffect(() => {
    if (!open) {
      setBusqueda('')
      setCantidades({})
      return
    }
    setLista(repuestos)
  }, [open, repuestos])

  const filtrados = useMemo(() => {
    if (!busqueda.trim()) return lista
    const term = busqueda.toLowerCase()
    return lista.filter((r) => {
      const texto = [
        r.categorias?.nombre,
        r.distribuidores?.nombre,
        r.modelos?.nombre,
        r.modelos?.marcas?.nombre,
        ...Object.values(r.atributos ?? {}).map(String),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return texto.includes(term)
    })
  }, [lista, busqueda])

  const handleSumar = async (id_repuesto: number, stockActual: number) => {
    const cantidad = cantidades[id_repuesto]
    if (!cantidad || Number(cantidad) < 1) return

    const { error: err } = await supabase
      .from('repuestos')
      .update({ stock: stockActual + Number(cantidad) })
      .eq('id_repuesto', id_repuesto)

    if (err) {
      alert('Error al reponer stock: ' + err.message)
      return
    }

    setLista((prev) =>
      prev.map((r) =>
        r.id_repuesto === id_repuesto
          ? { ...r, stock: stockActual + Number(cantidad) }
          : r,
      ),
    )
    setCantidades((prev) => ({ ...prev, [id_repuesto]: '' }))
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center pt-12"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-800 mb-3">Ingreso de Stock</h3>
          <input
            type="text"
            placeholder="Filtrar por modelo, marca, categoría o detalles…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
          />
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {filtrados.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">
              {busqueda ? 'No se encontraron productos.' : 'No hay repuestos registrados.'}
            </p>
          ) : (
            filtrados.map((r) => {
              const marca = r.modelos?.marcas?.nombre ?? '—'
              const modelo = r.modelos?.nombre ?? '—'
              const extras = formatearDetalles(r.distribuidores.nombre, r.atributos)
              return (
                <div
                  key={r.id_repuesto}
                  className="rounded-lg border border-slate-200 p-4 flex items-center justify-between gap-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-800">
                      {marca} {modelo}
                    </p>
                    <p className="text-xs text-slate-500">{r.categorias.nombre}</p>
                    {extras && <p className="text-xs text-gray-500">{extras}</p>}
                    <p className="text-xs text-slate-500 mt-1">
                      Stock actual: <span className="font-semibold text-slate-700">{r.stock}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <input
                      type="number"
                      min="0"
                      value={cantidades[r.id_repuesto] ?? ''}
                      onChange={(e) =>
                        setCantidades((prev) => ({
                          ...prev,
                          [r.id_repuesto]: e.target.value === '' ? '' : Number(e.target.value),
                        }))
                      }
                      placeholder="Cant."
                      className="w-20 rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={() => handleSumar(r.id_repuesto, r.stock)}
                      disabled={!cantidades[r.id_repuesto] || Number(cantidades[r.id_repuesto]) < 1}
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors cursor-pointer"
                    >
                      Sumar
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>

        <div className="px-5 py-4 border-t border-slate-200 flex justify-between items-center">
          <span className="text-xs text-slate-400">
            {filtrados.length} de {lista.length} productos
          </span>
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
