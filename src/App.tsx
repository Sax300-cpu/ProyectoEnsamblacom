import { useState } from 'react'
import { Routes, Route, NavLink } from 'react-router-dom';
import { Home } from './pages/Home';
import { Products } from './pages/Products';
import { Pantallas } from './pages/Pantallas';
import { Repuestos } from './pages/Repuestos';
import { Clientes } from './pages/Clientes';
import { Pedidos } from './pages/Pedidos';
import { Configuration } from './pages/Configuration';
import { CuentasPorCobrar } from './pages/CuentasPorCobrar';
import { Garantias } from './pages/Garantias';
import { Reportes } from './pages/Reportes';
import { Login } from './pages/Login';
import { CartProvider } from './contexts/CartContext';
import { CartDrawer } from './components/CartDrawer';
import { Toaster } from './components/Toaster';
import { useCart } from './contexts/CartContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';

function NavCartButton() {
  const { itemCount, openCart } = useCart()

  return (
    <button
      onClick={openCart}
      className="relative ml-auto text-white hover:text-blue-200 transition-colors cursor-pointer"
      title="Carrito de venta"
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
      </svg>
      {itemCount > 0 && (
        <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold leading-none w-4 h-4 flex items-center justify-center rounded-full">
          {itemCount > 9 ? '9+' : itemCount}
        </span>
      )}
    </button>
  )
}

function UserBadge() {
  const { user, logout } = useAuth()

  return (
    <div className="flex items-center gap-1 bg-blue-800/60 rounded-full pl-1 py-1 shrink-0 max-w-[200px]">
      <span className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center shrink-0">
        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      </span>
      <span className="max-w-[150px] truncate block text-sm text-blue-100 hidden sm:block" title={user?.email}>
        {user?.email}
      </span>
      <button
        onClick={logout}
        title="Salir"
        className="w-8 h-8 rounded-full hover:bg-red-600 flex items-center justify-center transition-colors cursor-pointer shrink-0"
      >
        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
      </button>
    </div>
  )
}

function navLinkClass({ isActive }: { isActive: boolean }) {
  return `px-2.5 py-1.5 text-sm font-medium whitespace-nowrap flex-shrink-0 rounded-lg transition-all duration-200 ease-in-out ${
    isActive
      ? 'bg-white/20 text-white font-semibold shadow-sm'
      : 'text-white/80 hover:text-white hover:bg-white/10'
  }`
}

function AppContent() {
  const { session } = useAuth()
  const [ventaExitosaCount, setVentaExitosaCount] = useState(0)

  if (!session) return <Login />

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-blue-700 p-4 text-white shadow-md">
        <div className="flex items-center justify-between w-full gap-2 px-4 max-w-6xl mx-auto font-semibold">
          <div className="flex items-center gap-1 sm:gap-2 flex-nowrap overflow-x-auto no-scrollbar">
            <NavLink to="/" className={navLinkClass} end>Inicio</NavLink>
            <NavLink to="/pantallas" className={navLinkClass}>Pantallas</NavLink>
            <NavLink to="/repuestos" className={navLinkClass}>Repuestos</NavLink>
            <NavLink to="/clientes" className={navLinkClass}>Clientes</NavLink>
            <NavLink to="/pedidos" className={navLinkClass}>Pedidos</NavLink>
            <NavLink to="/por-cobrar" className={navLinkClass}>Por Cobrar</NavLink>
            <NavLink to="/garantias" className={navLinkClass}>Garantías</NavLink>
            <NavLink to="/reportes" className={navLinkClass}>Reportes</NavLink>
            <NavLink to="/configuracion" className={navLinkClass}>Configuración</NavLink>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <NavCartButton />
            <UserBadge />
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto mt-8 bg-white p-6 rounded-lg shadow-sm">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/productos" element={<Products />} />
          <Route path="/pantallas" element={<Pantallas refreshSignal={ventaExitosaCount} />} />
          <Route path="/repuestos" element={<Repuestos refreshSignal={ventaExitosaCount} />} />
          <Route path="/clientes" element={<Clientes />} />
          <Route path="/pedidos" element={<Pedidos />} />
          <Route path="/por-cobrar" element={<CuentasPorCobrar />} />
          <Route path="/garantias" element={<Garantias />} />
          <Route path="/reportes" element={<Reportes />} />
          <Route path="/configuracion" element={<Configuration />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </main>

      <CartDrawer onVentaExitosa={() => setVentaExitosaCount((c) => c + 1)} />
      <Toaster />
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <AppContent />
      </CartProvider>
    </AuthProvider>
  );
}

export default App;
