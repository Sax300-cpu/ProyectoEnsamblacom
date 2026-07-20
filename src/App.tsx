import { Routes, Route, Link } from 'react-router-dom';
import { Home } from './pages/Home';
import { Products } from './pages/Products';
import { Configuration } from './pages/Configuration';

function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-blue-700 p-4 text-white shadow-md">
        <div className="flex gap-6 max-w-6xl mx-auto font-semibold">
          <Link to="/" className="hover:text-blue-200 transition-colors">Inicio</Link>
          <Link to="/productos?seccion=pantallas" className="hover:text-blue-200 transition-colors">Pantallas</Link>
          <Link to="/productos?seccion=otros" className="hover:text-blue-200 transition-colors">Repuestos</Link>
          <Link to="/configuracion" className="hover:text-blue-200 transition-colors">⚙️ Configuración</Link>
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
  );
}

export default App;