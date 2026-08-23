import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

interface RepuestoAgotado {
  id_repuesto: number
  stock: number
  categorias: { nombre: string } | null
  modelos: { nombre: string; marcas: { nombre: string } } | null
  atributos: Record<string, unknown> | null
}

function detalleDe(r: RepuestoAgotado): string {
  const modelo = r.modelos?.nombre ?? ''
  const atributos = r.atributos ?? {}
  const calidad = typeof atributos.calidad === 'string' ? atributos.calidad : ''
  const color = typeof atributos.color === 'string' ? atributos.color : ''
  return [modelo, calidad, color].filter(Boolean).join(' - ') || '—'
}

const NOTAS_KEY = 'pedidos_notas'

export function Pedidos() {
  const [repuestosAgotados, setRepuestosAgotados] = useState<RepuestoAgotado[]>([])
  const [cantidadesPedido, setCantidadesPedido] = useState<Record<number, number>>({})
  const [busqueda, setBusqueda] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [filtroMarca, setFiltroMarca] = useState('')
  const [notas, setNotas] = useState<string>(() => localStorage.getItem(NOTAS_KEY) ?? '')
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchAgotados = async () => {
      setCargando(true)
      setError(null)
      const { data, error: err } = await supabase
        .from('repuestos')
        .select(`
          id_repuesto,
          stock,
          categorias!inner ( nombre ),
          modelos:id_modelo_principal ( nombre, marcas ( nombre ) ),
          atributos
        `)
        .lte('stock', 1)

      if (err) {
        setError(err.message)
        setRepuestosAgotados([])
      } else {
        const ordenados = ((data ?? []) as unknown as RepuestoAgotado[]).sort((a, b) => {
          const catA = (a.categorias?.nombre ?? '').toLowerCase()
          const catB = (b.categorias?.nombre ?? '').toLowerCase()
          if (catA !== catB) return catA.localeCompare(catB, 'es')
          return a.stock - b.stock
        })
        setRepuestosAgotados(ordenados)
      }
      setCargando(false)
    }

    fetchAgotados()
  }, [])

  useEffect(() => {
    localStorage.setItem(NOTAS_KEY, notas)
  }, [notas])

  const categoriasUnicas = useMemo(
    () =>
      Array.from(
        new Set(repuestosAgotados.map((r) => r.categorias?.nombre ?? '').filter(Boolean)),
      ).sort((a, b) => a.localeCompare(b, 'es')),
    [repuestosAgotados],
  )

  const marcasUnicas = useMemo(
    () =>
      Array.from(
        new Set(repuestosAgotados.map((r) => r.modelos?.marcas?.nombre ?? '').filter(Boolean)),
      ).sort((a, b) => a.localeCompare(b, 'es')),
    [repuestosAgotados],
  )

  const filtrados = useMemo(() => {
    const term = busqueda.trim().toLowerCase()
    return repuestosAgotados.filter((r) => {
      const categoria = r.categorias?.nombre ?? ''
      const marca = r.modelos?.marcas?.nombre ?? ''
      const modelo = r.modelos?.nombre ?? ''

      if (term && ![categoria, marca, modelo].join(' ').toLowerCase().includes(term)) return false
      if (filtroCategoria && categoria !== filtroCategoria) return false
      if (filtroMarca && marca !== filtroMarca) return false

      return true
    })
  }, [repuestosAgotados, busqueda, filtroCategoria, filtroMarca])

  const generarOrdenPDF = () => {
    const filas = repuestosAgotados
      .filter((r) => (cantidadesPedido[r.id_repuesto] ?? 0) > 0)
      .map((r) => ({
        categoria: r.categorias?.nombre ?? '—',
        marca: r.modelos?.marcas?.nombre ?? '—',
        detalle: detalleDe(r),
        cantidad: cantidadesPedido[r.id_repuesto] ?? 0,
      }))

    const doc = new jsPDF()

    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text('ORDEN DE COMPRA - STOCK', doc.internal.pageSize.width / 2, 22, { align: 'center' })

    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100)
    doc.text(
      `Generado: ${new Date().toLocaleDateString('es-PE', {
        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
      })}`,
      doc.internal.pageSize.width / 2,
      30,
      { align: 'center' },
    )
    doc.setTextColor(0)

    let startY = 40

    // Paso A: tabla con los ítems con cantidad a pedir.
    if (filas.length > 0) {
      autoTable(doc, {
        startY,
        head: [['CATEGORÍA', 'MARCA', 'DETALLE', 'CANT. A PEDIR']],
        body: filas.map((f) => [f.categoria, f.marca, f.detalle, f.cantidad.toString()]),
        theme: 'grid',
        headStyles: { fillColor: [30, 64, 175], halign: 'center' },
        styles: { valign: 'middle', fontSize: 9 },
        columnStyles: {
          0: { cellWidth: 38 },
          1: { cellWidth: 30 },
          2: { cellWidth: 'auto' },
          3: { halign: 'center', cellWidth: 30 },
        },
        margin: { left: 10, right: 10 },
      })
      startY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12
    }

    // Paso B: notas manuales.
    if (notas.trim()) {
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.text('PEDIDOS ADICIONALES (MANUALES)', 14, startY)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      const lineas = doc.splitTextToSize(notas.trim(), doc.internal.pageSize.width - 28)
      doc.text(lineas, 14, startY + 7)
    }

    doc.save('Orden_Compra_Stock.pdf')
  }

  return (
    <section>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
        <h2 className="text-2xl font-semibold text-slate-800">Punto de Reorden Automático</h2>
        <button
          onClick={generarOrdenPDF}
          className="flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 transition-colors cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Descargar Orden de Compra
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          <div className="flex flex-col md:flex-row gap-3 mb-4">
            <input
              type="text"
              placeholder="Buscar por categoría, marca o modelo…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <select
              value={filtroCategoria}
              onChange={(e) => setFiltroCategoria(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todas las categorías</option>
              {categoriasUnicas.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <select
              value={filtroMarca}
              onChange={(e) => setFiltroMarca(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todas las marcas</option>
              {marcasUnicas.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {cargando ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-3 text-slate-500">
                <svg className="animate-spin h-8 w-8" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span className="text-sm">Cargando repuestos…</span>
              </div>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">
              Error al cargar los datos: {error}
            </div>
          ) : filtrados.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-sm">
              {busqueda.trim() ? 'No se encontraron repuestos con ese criterio.' : 'No hay repuestos con stock agotado.'}
            </div>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto overflow-x-auto border rounded-lg">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 z-10 bg-slate-100">
                  <tr className="text-slate-600 uppercase text-xs tracking-wider">
                    <th className="text-left px-4 py-3 font-semibold">Categoría y Marca</th>
                    <th className="text-left px-4 py-3 font-semibold">Detalle del Producto</th>
                    <th className="text-center px-4 py-3 font-semibold">Stock Actual</th>
                    <th className="text-center px-4 py-3 font-semibold">Cantidad a Pedir</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {filtrados.map((r) => (
                    <tr key={r.id_repuesto} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-slate-700">
                        <span className="font-medium">{r.categorias?.nombre ?? '—'}</span>
                        <span className="block text-xs text-slate-500">{r.modelos?.marcas?.nombre ?? '—'}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{detalleDe(r)}</td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-block min-w-[2rem] rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            r.stock === 0 ? 'bg-red-100 text-red-800' : 'bg-orange-100 text-orange-800'
                          }`}
                        >
                          {r.stock}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <input
                          type="number"
                          min={0}
                          value={cantidadesPedido[r.id_repuesto] || ''}
                          onChange={(e) =>
                            setCantidadesPedido((prev) => ({
                              ...prev,
                              [r.id_repuesto]: Number(e.target.value),
                            }))
                          }
                          className="w-20 rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="lg:col-span-1">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <label htmlFor="notas" className="block text-sm font-semibold text-slate-700 mb-1">
              Bloc de Notas
            </label>
            <p className="text-xs text-slate-500 mb-2">Anota aquí pedidos manuales adicionales.</p>
            <textarea
              id="notas"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Ej: 5 pantallas iPhone 11, 3 baterías Samsung…"
              className="w-full min-h-[45vh] rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
            />
          </div>
        </div>
      </div>
    </section>
  )
}
