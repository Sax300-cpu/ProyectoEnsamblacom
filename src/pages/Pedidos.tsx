import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

interface Pedido {
  id_pedido: string
  repuesto_texto: string
  estado: string
  fecha_registro: string
}

const ESTADOS = ['Pendiente', 'Comprado', 'En camino']

export function Pedidos() {
  const { isAdmin } = useAuth()
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [nuevoTexto, setNuevoTexto] = useState('')
  const [agregando, setAgregando] = useState(false)
  const [pedidoAEliminar, setPedidoAEliminar] = useState<Pedido | null>(null)
  const [eliminando, setEliminando] = useState(false)
  const [confirmandoLimpiar, setConfirmandoLimpiar] = useState(false)
  const [limpiando, setLimpiando] = useState(false)

  const cargarPedidos = async () => {
    setCargando(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('pedidos_pendientes')
      .select('*')
      .order('fecha_registro', { ascending: false })

    if (err) {
      setError(err.message)
      setPedidos([])
    } else {
      setPedidos(data as Pedido[])
    }
    setCargando(false)
  }

  useEffect(() => {
    cargarPedidos()
  }, [])

  const handleAgregar = async () => {
    const texto = nuevoTexto.trim()
    if (!texto) return
    setAgregando(true)
    const { error: err } = await supabase
      .from('pedidos_pendientes')
      .insert({ repuesto_texto: texto, estado: 'Pendiente' })

    setAgregando(false)
    if (err) {
      alert('Error al agregar: ' + err.message)
      return
    }
    setNuevoTexto('')
    cargarPedidos()
  }

  const handleCambiarEstado = async (id_pedido: string, estado: string) => {
    const { error: err } = await supabase
      .from('pedidos_pendientes')
      .update({ estado })
      .eq('id_pedido', id_pedido)

    if (err) {
      alert('Error al actualizar estado: ' + err.message)
      return
    }
    setPedidos((prev) =>
      prev.map((p) => (p.id_pedido === id_pedido ? { ...p, estado } : p)),
    )
  }

  const handleLimpiarCompletados = async () => {
    setLimpiando(true)
    const { error: err } = await supabase
      .from('pedidos_pendientes')
      .delete()
      .eq('estado', 'Comprado')

    setLimpiando(false)
    setConfirmandoLimpiar(false)
    if (err) {
      alert('Error al limpiar: ' + err.message)
      return
    }
    setPedidos((prev) => prev.filter((p) => p.estado !== 'Comprado'))
  }

  const handleEliminar = async () => {
    if (!pedidoAEliminar) return
    setEliminando(true)
    const { error: err } = await supabase
      .from('pedidos_pendientes')
      .delete()
      .eq('id_pedido', pedidoAEliminar.id_pedido)

    setEliminando(false)
    setPedidoAEliminar(null)
    if (err) {
      alert('Error al eliminar: ' + err.message)
      return
    }
    setPedidos((prev) => prev.filter((p) => p.id_pedido !== pedidoAEliminar.id_pedido))
  }

  return (
    <section>
      <h2 className="text-2xl font-semibold text-slate-800 mb-4">Pedidos Pendientes</h2>

      <div className="flex items-center gap-3 mb-6">
        <input
          type="text"
          placeholder="Nombre del repuesto *"
          value={nuevoTexto}
          onChange={(e) => setNuevoTexto(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAgregar() }}
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={handleAgregar}
          disabled={agregando || !nuevoTexto.trim()}
          className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50 transition-colors shrink-0 cursor-pointer"
        >
          {agregando ? 'Agregando…' : 'Agregar'}
        </button>
        {isAdmin && (
          <button
            onClick={() => setConfirmandoLimpiar(true)}
            className="rounded-lg bg-red-100 text-red-700 border border-red-300 px-4 py-2 text-sm font-semibold hover:bg-red-200 transition-colors shrink-0 cursor-pointer"
          >
            Limpiar Completados
          </button>
        )}
      </div>

      {cargando ? (
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3 text-slate-500">
            <svg className="animate-spin h-8 w-8" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-sm">Cargando pedidos…</span>
          </div>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">
          Error al cargar los datos: {error}
        </div>
      ) : pedidos.length === 0 ? (
        <div className="text-center py-12 text-slate-500 text-sm">
          No hay pedidos pendientes.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 shadow-sm">
          <table className="min-w-full text-sm">
            <colgroup>
              <col />
              <col className="w-[140px]" />
              <col className="w-[180px]" />
              {isAdmin && <col className="w-[100px]" />}
            </colgroup>
            <thead>
              <tr className="bg-slate-100 text-slate-600 uppercase text-xs tracking-wider">
                <th className="text-left px-4 py-3 font-semibold">Repuesto</th>
                <th className="text-left px-4 py-3 font-semibold">Estado</th>
                <th className="text-left px-4 py-3 font-semibold">Fecha</th>
                {isAdmin && <th className="text-center px-4 py-3 font-semibold">Acción</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {pedidos.map((p) => (
                <tr key={p.id_pedido} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-slate-700 font-medium">{p.repuesto_texto}</td>
                  <td className="px-4 py-3">
                    {isAdmin ? (
                      <select
                        value={p.estado}
                        onChange={(e) => handleCambiarEstado(p.id_pedido, e.target.value)}
                        className="rounded-lg border border-slate-300 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
                      >
                        {ESTADOS.map((est) => (
                          <option key={est} value={est}>{est}</option>
                        ))}
                      </select>
                    ) : (
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          p.estado === 'Pendiente'
                            ? 'bg-yellow-100 text-yellow-800'
                            : p.estado === 'Comprado'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {p.estado}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">
                    {new Date(p.fecha_registro).toLocaleDateString('es-PE', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => setPedidoAEliminar(p)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer"
                        title="Eliminar"
                      >
                        🗑 Eliminar
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pedidoAEliminar && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold text-slate-800">¿Eliminar pedido?</h3>
            <p className="text-sm text-slate-500 mt-2">
              Esta acción no se puede deshacer. El pedido "{pedidoAEliminar.repuesto_texto}" será eliminado permanentemente.
            </p>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setPedidoAEliminar(null)}
                disabled={eliminando}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleEliminar}
                disabled={eliminando}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition-colors cursor-pointer"
              >
                {eliminando ? 'Eliminando…' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
      {confirmandoLimpiar && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold text-slate-800">¿Limpiar completados?</h3>
            <p className="text-sm text-slate-500 mt-2">
              Esta acción no se puede deshacer. Se eliminarán todos los pedidos con estado "Comprado".
            </p>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setConfirmandoLimpiar(false)}
                disabled={limpiando}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleLimpiarCompletados}
                disabled={limpiando}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition-colors cursor-pointer"
              >
                {limpiando ? 'Limpiando…' : 'Limpiar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
