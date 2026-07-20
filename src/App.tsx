import { Routes, Route, Link } from 'react-router-dom';
import { Products } from './pages/Products';
import { Configuration } from './pages/Configuration';

function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-blue-700 p-4 text-white shadow-md">
        <div className="flex gap-6 max-w-6xl mx-auto font-semibold">
          <Link to="/" className="hover:text-blue-200 transition-colors">Inicio</Link>
          <Link to="/products" className="hover:text-blue-200 transition-colors">Inventario</Link>
          <Link to="/configuracion" className="hover:text-blue-200 transition-colors">⚙️ Configuración</Link>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto mt-8 bg-white p-6 rounded-lg shadow-sm">
        <Routes>
          <Route path="/" element={<h1 className="text-3xl font-bold text-gray-700">Bienvenido al Sistema de Inventario</h1>} />
          <Route path="/products" element={<Products />} />
          <Route path="/configuracion" element={<Configuration />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;