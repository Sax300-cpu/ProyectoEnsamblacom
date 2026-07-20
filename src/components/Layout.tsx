import { NavLink, Outlet } from 'react-router-dom'

const navItems = [
  { to: '/', label: 'Dashboard' },
  { to: '/products', label: 'Productos' },
]

export function Layout() {
  return (
    <div className="min-h-svh flex flex-col">
      <header className="bg-slate-800 text-white px-6 py-4">
        <nav className="flex items-center gap-6 max-w-6xl mx-auto">
          <h1 className="text-lg font-bold">Sistema de Inventario</h1>
          <ul className="flex gap-4 ml-auto">
            {navItems.map(({ to, label }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end
                  className={({ isActive }) =>
                    `hover:underline ${isActive ? 'text-amber-400 font-semibold' : 'text-white'}`
                  }
                >
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <main className="flex-1 p-6 max-w-6xl mx-auto w-full">
        <Outlet />
      </main>
    </div>
  )
}
