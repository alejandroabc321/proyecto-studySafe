import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { Cargando } from './components/ui';

export function ProtectedRoute() {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <Cargando />;
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
}

// Solo para administradores. El backend vuelve a comprobar el rol en cada petición: esto solo evita mostrar pantallas inútiles.
export function AdminRoute() {
  const { user, loading } = useAuth();
  if (loading) return <Cargando />;
  if (!user) return <Navigate to="/login" replace />;
  return user.rol === 'admin' ? <Outlet /> : <Navigate to="/" replace />;
}
