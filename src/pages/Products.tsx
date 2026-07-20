import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { InventoryTable } from '../components/InventoryTable'
import { AddRepuestoForm } from '../components/AddRepuestoForm'

const titulos: Record<string, string> = {
  pantallas: 'Pantallas',
  otros: 'Repuestos',
}

export function Products() {
  const [searchParams] = useSearchParams()
  const seccion = searchParams.get('seccion') ?? 'otros'

  const [buscar, setBuscar] = useState('')
  const [mostrarForm, setMostrarForm] = useState(false)

  const titulo = titulos[seccion] ?? 'Productos'

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
              onClick={() => setMostrarForm(true)}
              className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 transition-colors shrink-0"
            >
              Agregar +
            </button>
          </div>

          <InventoryTable
            seccion={seccion as 'pantallas' | 'otros'}
            buscar={buscar}
          />
        </>
      )}
    </section>
  )
}
