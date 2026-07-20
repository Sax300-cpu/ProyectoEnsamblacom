import { useNavigate } from 'react-router-dom'

const secciones = [
  {
    key: 'pantallas',
    titulo: 'Pantallas',
    descripcion: 'Gestión de pantallas',
    emoji: '🖥️',
  },
  {
    key: 'otros',
    titulo: 'Repuestos',
    descripcion: 'Baterías, flex y más',
    emoji: '🔧',
  },
]

export function Home() {
  const navigate = useNavigate()

  return (
    <div className="flex flex-col items-center justify-center min-h-[70svh] gap-8">
      <h1 className="text-3xl font-bold text-slate-800 text-center">
        Sistema de Inventario
      </h1>
      <p className="text-slate-500 text-center max-w-md">
        Selecciona una sección para gestionar el inventario
      </p>
      <div className="flex flex-wrap justify-center gap-6">
        {secciones.map((s) => (
          <button
            key={s.key}
            onClick={() => navigate(`/productos?seccion=${s.key}`)}
            className="w-56 h-40 rounded-2xl border-2 border-slate-200 bg-white shadow-sm hover:shadow-md hover:border-blue-400 transition-all flex flex-col items-center justify-center gap-2 cursor-pointer"
          >
            <span className="text-4xl">{s.emoji}</span>
            <span className="text-lg font-semibold text-slate-800">
              {s.titulo}
            </span>
            <span className="text-sm text-slate-500">{s.descripcion}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
