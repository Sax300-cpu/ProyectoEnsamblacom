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
    <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-xl shadow-lg w-full max-w-sm p-8 space-y-5"
      >
        <h1 className="text-xl font-semibold text-slate-800 text-center">Acceso al Sistema</h1>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm p-3 text-center">
            {error}
          </div>
        )}

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
          className="w-full rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50 transition-colors cursor-pointer"
        >
          {enviando ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>
    </div>
  )
}
