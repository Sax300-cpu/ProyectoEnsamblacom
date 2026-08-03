import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setEnviando(true)

    const { error: err } = await supabase.auth.signInWithPassword({ email, password })

    setEnviando(false)
    if (err) {
      setError('Credenciales incorrectas')
    } else {
      navigate('/')
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-3xl bg-white border-2 border-emerald-500 shadow-xl rounded-3xl overflow-hidden grid md:grid-cols-2">
        {/* ── Panel izquierdo: formulario ── */}
        <div className="flex flex-col items-center justify-center p-8 sm:p-12">
          <div className="w-full max-w-sm space-y-6">
            <div className="text-center space-y-1.5">
              <h1 className="text-2xl font-bold text-slate-800">Portal Ensamblacom</h1>
              <p className="text-sm text-slate-500">Gestión de inventario y repuestos</p>
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm p-3 text-center">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">
                  Correo Electrónico
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="correo@ejemplo.com"
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">
                  Contraseña
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <button
                type="submit"
                disabled={enviando}
                className="w-full rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50 transition-colors cursor-pointer"
              >
                {enviando ? 'Ingresando…' : 'Ingresar'}
              </button>
            </form>
          </div>
        </div>

        {/* ── Panel derecho: robot ── */}
        <div className="hidden md:block relative min-h-[540px] bg-white overflow-hidden">
          <img
            src="/robot.png"
            alt="Robot Ensamblacom"
            className="absolute inset-0 w-full h-full object-contain object-center"
            style={{ aspectRatio: '3 / 4' }}
          />
        </div>
      </div>
    </div>
  )
}
