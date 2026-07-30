import { useState } from 'react'
import { Routes, Route, Link } from 'react-router-dom';
import { Home } from './pages/Home';
import { Products } from './pages/Products';
import { Pantallas } from './pages/Pantallas';
import { Repuestos } from './pages/Repuestos';
import { Clientes } from './pages/Clientes';
import { Pedidos } from './pages/Pedidos';
import { Configuration } from './pages/Configuration';
import { CuentasPorCobrar } from './pages/CuentasPorCobrar';
import { Reportes } from './pages/Reportes';
import { Login } from './pages/Login';
import { CartProvider } from './contexts/CartContext';
import { CartDrawer } from './components/CartDrawer';
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

function AppContent() {
  const { session, isAdmin, logout } = useAuth()
  const [ventaExitosaCount, setVentaExitosaCount] = useState(0)

  if (!session) return <Login />

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-blue-700 p-4 text-white shadow-md">
        <div className="flex gap-6 max-w-6xl mx-auto font-semibold items-center">
          <Link to="/" className="hover:text-blue-200 transition-colors">Inicio</Link>
          <Link to="/pantallas" className="hover:text-blue-200 transition-colors">Pantallas</Link>
          <Link to="/repuestos" className="hover:text-blue-200 transition-colors">Repuestos</Link>
          <Link to="/clientes" className="hover:text-blue-200 transition-colors">Clientes</Link>
          <Link to="/pedidos" className="hover:text-blue-200 transition-colors">Pedidos</Link>
          <Link to="/por-cobrar" className="hover:text-blue-200 transition-colors">Por Cobrar</Link>
          <Link to="/reportes" className="hover:text-blue-200 transition-colors">Reportes</Link>
          {isAdmin && <Link to="/configuracion" className="hover:text-blue-200 transition-colors">⚙️ Configuración</Link>}
          <NavCartButton />
          <button
            onClick={logout}
            className="bg-red-600 text-white border border-red-700 hover:bg-red-700 px-4 py-2 rounded-md font-medium transition-colors shadow-sm ml-4 cursor-pointer"
          >
            Cerrar Sesión
          </button>
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
          <Route path="/reportes" element={<Reportes />} />
          {isAdmin && <Route path="/configuracion" element={<Configuration />} />}
          <Route path="*" element={<Home />} />
        </Routes>
      </main>

      <CartDrawer onVentaExitosa={() => setVentaExitosaCount((c) => c + 1)} />
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
