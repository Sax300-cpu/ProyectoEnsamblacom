import { Routes, Route, Link } from 'react-router-dom';
import { Home } from './pages/Home';
import { Products } from './pages/Products';
import { Configuration } from './pages/Configuration';
import { CartProvider } from './contexts/CartContext';
import { CartDrawer } from './components/CartDrawer';
import { useCart } from './contexts/CartContext';

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

function App() {
  return (
    <CartProvider>
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-blue-700 p-4 text-white shadow-md">
          <div className="flex gap-6 max-w-6xl mx-auto font-semibold items-center">
            <Link to="/" className="hover:text-blue-200 transition-colors">Inicio</Link>
            <Link to="/productos?seccion=pantallas" className="hover:text-blue-200 transition-colors">Pantallas</Link>
            <Link to="/productos?seccion=otros" className="hover:text-blue-200 transition-colors">Repuestos</Link>
            <Link to="/configuracion" className="hover:text-blue-200 transition-colors">⚙️ Configuración</Link>
            <NavCartButton />
          </div>
        </nav>

        <main className="max-w-6xl mx-auto mt-8 bg-white p-6 rounded-lg shadow-sm">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/productos" element={<Products />} />
            <Route path="/configuracion" element={<Configuration />} />
          </Routes>
        </main>
      </div>

      <CartDrawer />
    </CartProvider>
  );
}

export default App;
