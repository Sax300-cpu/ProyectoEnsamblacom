import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Categoria, Marca, Modelo, Distribuidor } from '../types/database'

type Tab = 'categorias' | 'marcas' | 'modelos' | 'distribuidores'

const tabs: { key: Tab; label: string }[] = [
  { key: 'categorias', label: 'Categorías' },
  { key: 'marcas', label: 'Marcas' },
  { key: 'modelos', label: 'Modelos' },
  { key: 'distribuidores', label: 'Distribuidores' },
]

function TabCategorias() {
  const [items, setItems] = useState<Categoria[]>([])
  const [nombre, setNombre] = useState('')
  const [cargando, setCargando] = useState(false)

  const cargar = async () => {
    const { data } = await supabase.from('categorias').select('*').order('nombre')
    if (data) setItems(data as Categoria[])
  }

  useEffect(() => { cargar() }, [])

  const agregar = async () => {
    const v = nombre.trim()
    if (!v) return
    setCargando(true)
    const { error } = await supabase.from('categorias').insert({ nombre: v })
    setCargando(false)
    if (!error) {
      setNombre('')
      cargar()
    }
  }

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          placeholder="Nombre de la categoría"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={agregar}
          disabled={cargando || !nombre.trim()}
          className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50 transition-colors cursor-pointer shrink-0"
        >
          {cargando ? '…' : 'Agregar'}
        </button>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-100 text-slate-600 uppercase text-xs tracking-wider">
            <th className="text-left px-3 py-2 font-semibold">ID</th>
            <th className="text-left px-3 py-2 font-semibold">Nombre</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {items.map((i) => (
            <tr key={i.id_categoria} className="hover:bg-slate-50">
              <td className="px-3 py-2 text-slate-500">{i.id_categoria}</td>
              <td className="px-3 py-2 text-slate-700">{i.nombre}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function TabMarcas() {
  const [items, setItems] = useState<Marca[]>([])
  const [nombre, setNombre] = useState('')
  const [cargando, setCargando] = useState(false)

  const cargar = async () => {
    const { data } = await supabase.from('marcas').select('*').order('nombre')
    if (data) setItems(data as Marca[])
  }

  useEffect(() => { cargar() }, [])

  const agregar = async () => {
    const v = nombre.trim()
    if (!v) return
    setCargando(true)
    const { error } = await supabase.from('marcas').insert({ nombre: v })
    setCargando(false)
    if (!error) {
      setNombre('')
      cargar()
    }
  }

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          placeholder="Nombre de la marca"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={agregar}
          disabled={cargando || !nombre.trim()}
          className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50 transition-colors cursor-pointer shrink-0"
        >
          {cargando ? '…' : 'Agregar'}
        </button>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-100 text-slate-600 uppercase text-xs tracking-wider">
            <th className="text-left px-3 py-2 font-semibold">ID</th>
            <th className="text-left px-3 py-2 font-semibold">Nombre</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {items.map((i) => (
            <tr key={i.id_marca} className="hover:bg-slate-50">
              <td className="px-3 py-2 text-slate-500">{i.id_marca}</td>
              <td className="px-3 py-2 text-slate-700">{i.nombre}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function TabModelos() {
  const [items, setItems] = useState<Modelo[]>([])
  const [marcas, setMarcas] = useState<Marca[]>([])
  const [idMarca, setIdMarca] = useState<number | ''>('')
  const [nombre, setNombre] = useState('')
  const [cargando, setCargando] = useState(false)

  const cargar = async () => {
    const [resM, resMo] = await Promise.all([
      supabase.from('marcas').select('*').order('nombre'),
      supabase.from('modelos').select('*, marcas(*)').order('nombre'),
    ])
    if (resM.data) setMarcas(resM.data as Marca[])
    if (resMo.data) setItems(resMo.data as Modelo[])
  }

  useEffect(() => { cargar() }, [])

  const agregar = async () => {
    if (idMarca === '' || !nombre.trim()) return
    setCargando(true)
    const { error } = await supabase.from('modelos').insert({
      id_marca: idMarca,
      nombre: nombre.trim(),
    })
    setCargando(false)
    if (!error) {
      setIdMarca('')
      setNombre('')
      cargar()
    }
  }

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <select
          value={idMarca}
          onChange={(e) => setIdMarca(e.target.value === '' ? '' : Number(e.target.value))}
          className="w-48 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Marca…</option>
          {marcas.map((m) => (
            <option key={m.id_marca} value={m.id_marca}>{m.nombre}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Nombre del modelo"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={agregar}
          disabled={cargando || idMarca === '' || !nombre.trim()}
          className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50 transition-colors cursor-pointer shrink-0"
        >
          {cargando ? '…' : 'Agregar'}
        </button>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-100 text-slate-600 uppercase text-xs tracking-wider">
            <th className="text-left px-3 py-2 font-semibold">ID</th>
            <th className="text-left px-3 py-2 font-semibold">Modelo</th>
            <th className="text-left px-3 py-2 font-semibold">Marca</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {items.map((i) => (
            <tr key={i.id_modelo} className="hover:bg-slate-50">
              <td className="px-3 py-2 text-slate-500">{i.id_modelo}</td>
              <td className="px-3 py-2 text-slate-700">{i.nombre}</td>
              <td className="px-3 py-2 text-slate-700">{i.marcas?.nombre}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function TabDistribuidores() {
  const [items, setItems] = useState<Distribuidor[]>([])
  const [nombre, setNombre] = useState('')
  const [contacto, setContacto] = useState('')
  const [cargando, setCargando] = useState(false)

  const cargar = async () => {
    const { data } = await supabase.from('distribuidores').select('*').order('nombre')
    if (data) setItems(data as Distribuidor[])
  }

  useEffect(() => { cargar() }, [])

  const agregar = async () => {
    if (!nombre.trim()) return
    setCargando(true)
    const { error } = await supabase.from('distribuidores').insert({
      nombre: nombre.trim(),
      contacto: contacto.trim() || null,
    })
    setCargando(false)
    if (!error) {
      setNombre('')
      setContacto('')
      cargar()
    }
  }

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          placeholder="Nombre del distribuidor"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          type="text"
          placeholder="Contacto (opcional)"
          value={contacto}
          onChange={(e) => setContacto(e.target.value)}
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={agregar}
          disabled={cargando || !nombre.trim()}
          className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50 transition-colors cursor-pointer shrink-0"
        >
          {cargando ? '…' : 'Agregar'}
        </button>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-100 text-slate-600 uppercase text-xs tracking-wider">
            <th className="text-left px-3 py-2 font-semibold">ID</th>
            <th className="text-left px-3 py-2 font-semibold">Nombre</th>
            <th className="text-left px-3 py-2 font-semibold">Contacto</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {items.map((i) => (
            <tr key={i.id_distribuidor} className="hover:bg-slate-50">
              <td className="px-3 py-2 text-slate-500">{i.id_distribuidor}</td>
              <td className="px-3 py-2 text-slate-700">{i.nombre}</td>
              <td className="px-3 py-2 text-slate-700">{i.contacto ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function Configuration() {
  const [tab, setTab] = useState<Tab>('categorias')

  return (
    <section>
      <h2 className="text-2xl font-semibold text-slate-800 mb-4">Configuración</h2>

      <div className="flex gap-1 mb-6 border-b border-slate-200">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
              tab === t.key
                ? 'border-blue-700 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'categorias' && <TabCategorias />}
      {tab === 'marcas' && <TabMarcas />}
      {tab === 'modelos' && <TabModelos />}
      {tab === 'distribuidores' && <TabDistribuidores />}
    </section>
  )
}
