import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const EMAIL_KEY = 'ensamblacom_email'
const PASSWORD_KEY = 'ensamblacom_password'

export function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mostrarPassword, setMostrarPassword] = useState(false)
  const [recordarme, setRecordarme] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    const guardado = localStorage.getItem(EMAIL_KEY)
    const claveGuardada = localStorage.getItem(PASSWORD_KEY)
    if (guardado && claveGuardada) {
      setEmail(guardado)
      setPassword(claveGuardada)
      setRecordarme(true)
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setEnviando(true)

    const { error: err } = await supabase.auth.signInWithPassword({ email, password })

    setEnviando(false)
    if (err) {
      setError('Credenciales incorrectas')
      return
    }

    if (recordarme) {
      localStorage.setItem(EMAIL_KEY, email)
      localStorage.setItem(PASSWORD_KEY, password)
    } else {
      localStorage.removeItem(EMAIL_KEY)
      localStorage.removeItem(PASSWORD_KEY)
    }

    navigate('/')
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-3xl bg-white border-2 border-blue-600 shadow-xl rounded-3xl overflow-hidden grid md:grid-cols-2">
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
                <div className="relative">
                  <input
                    type={mostrarPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarPassword((v) => !v)}
                    aria-label={mostrarPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                  >
                    {mostrarPassword ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="recordarme"
                  checked={recordarme}
                  onChange={(e) => setRecordarme(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="recordarme" className="ml-2 text-sm text-gray-600">
                  Recordarme
                </label>
              </div>

              <button
                type="submit"
                disabled={enviando}
                className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors cursor-pointer"
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
