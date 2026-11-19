import { Route, Routes } from 'react-router-dom';
import Header from './components/Header';
import { Cargando } from './components/ui';
import { useAuth } from './context/AuthContext';
import { AdminRoute, ProtectedRoute } from './routes';
import Home from './pages/Home';
import Login from './pages/Login';
import Registro from './pages/Registro';
import DetalleMaterial from './pages/DetalleMaterial';
import CrearMaterial from './pages/CrearMaterial';
import EditarMaterial from './pages/EditarMaterial';
import MisMateriales from './pages/MisMateriales';
import MisCompras from './pages/MisCompras';
import Billetera from './pages/Billetera';
import AdminSolicitudes from './pages/admin/AdminSolicitudes';
import AdminResumen from './pages/admin/AdminResumen';
import AdminRecargas from './pages/admin/AdminRecargas';
import AdminMateriales from './pages/admin/AdminMateriales';
import AdminUsuarios from './pages/admin/AdminUsuarios';
import AdminUsuarioDetalle from './pages/admin/AdminUsuarioDetalle';
import AdminProfesores from './pages/admin/AdminProfesores';

export default function App() {
  const { loading } = useAuth();
  if (loading) return <Cargando texto="Restaurando tu sesión…" />;
  return (<>
    <Header />
    <main className="contenedor">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/registro" element={<Registro />} />
        <Route path="/material/:id" element={<DetalleMaterial />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/publicar" element={<CrearMaterial />} />
          <Route path="/publicar/:id" element={<EditarMaterial />} />
          <Route path="/mis-materiales" element={<MisMateriales />} />
          <Route path="/mis-compras" element={<MisCompras />} />
          <Route path="/billetera" element={<Billetera />} />
        </Route>
        <Route element={<AdminRoute />}>
          <Route path="/admin" element={<AdminResumen />} />
          <Route path="/admin/solicitudes" element={<AdminSolicitudes />} />
          <Route path="/admin/usuarios" element={<AdminUsuarios />} />
          <Route path="/admin/recargas" element={<AdminRecargas />} />
          <Route path="/admin/materiales" element={<AdminMateriales />} />
          <Route path="/admin/usuarios/:id" element={<AdminUsuarioDetalle />} />
          <Route path="/admin/profesores" element={<AdminProfesores />} />
        </Route>
        <Route path="*" element={<h1 className="pagina-404">Página no encontrada</h1>} />
      </Routes>
    </main>
    <footer className="pie">StudySafe · material académico entre estudiantes</footer>
  </>);
}
