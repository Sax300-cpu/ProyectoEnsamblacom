import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { InventoryTable } from '../components/InventoryTable'
import { AddRepuestoForm } from '../components/AddRepuestoForm'
import { ReponerStockModal, type RepuestoRow } from '../components/ReponerStockModal'

const titulos: Record<string, string> = {
  pantallas: 'Pantallas',
  otros: 'Repuestos',
}

const CATEGORIA_PANTALLAS = 1

export function Products() {
  const [searchParams] = useSearchParams()
  const seccion = searchParams.get('seccion') ?? 'otros'

  const [buscar, setBuscar] = useState('')
  const [mostrarForm, setMostrarForm] = useState(false)
  const [stockModalOpen, setStockModalOpen] = useState(false)
  const [stockRefreshKey, setStockRefreshKey] = useState(0)
  const [repuestosStock, setRepuestosStock] = useState<RepuestoRow[]>([])

  const titulo = titulos[seccion] ?? 'Productos'

  useEffect(() => {
    if (!stockModalOpen) return
    const idFilter = seccion === 'pantallas' ? 'eq' : 'neq'
    supabase
      .from('repuestos')
      .select(`
        id_repuesto,
        stock,
        categorias!inner ( nombre ),
        distribuidores!inner ( nombre ),
        atributos,
        modelos:id_modelo_principal ( nombre, marcas ( nombre ) )
      `)
      .filter('id_categoria', idFilter, CATEGORIA_PANTALLAS)
      .order('id_repuesto', { ascending: false })
      .limit(200)
      .then(({ data }) => {
        setRepuestosStock((data ?? []) as unknown as RepuestoRow[])
      })
  }, [stockModalOpen, seccion])

  return (
    <section>
      <h2 className="text-2xl font-semibold text-slate-800 mb-4">{titulo}</h2>

      {mostrarForm ? (
        <AddRepuestoForm
          seccion={seccion as 'pantallas' | 'otros'}
          onCancel={() => setMostrarForm(false)}
          onSuccess={() => setMostrarForm(false)}
        />
      ) : (
        <>
          <div className="flex items-center gap-3 mb-4">
            <input
              type="text"
              placeholder="Buscar por modelo, marca o categoría…"
              value={buscar}
              onChange={(e) => setBuscar(e.target.value)}
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={() => setStockModalOpen(true)}
              className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 transition-colors shrink-0 cursor-pointer"
            >
              Ingreso Stock
            </button>
            <button
              onClick={() => setMostrarForm(true)}
              className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 transition-colors shrink-0 cursor-pointer"
            >
              Agregar +
            </button>
          </div>

          <InventoryTable
            seccion={seccion as 'pantallas' | 'otros'}
            buscar={buscar}
            refreshKey={stockRefreshKey}
          />
        </>
      )}

      <ReponerStockModal
        open={stockModalOpen}
        repuestos={repuestosStock}
        onClose={() => {
          setStockModalOpen(false)
          setStockRefreshKey((k) => k + 1)
        }}
      />
    </section>
  )
}
