import { useCallback, useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { obtenerSolicitudes } from '../api/admin';

const clase = ({ isActive }) => `pestana${isActive ? ' pestana--activa' : ''}`;

export default function AdminNav() {
  const [pendientes, setPendientes] = useState(0);
  // El número de solicitudes pendientes se ve en todas las pestañas del panel.
  const cargar = useCallback(() => obtenerSolicitudes({ estado: 'pendiente', limite: 1 }).then((r) => setPendientes(r.data.pendientes)).catch(() => {}), []);
  useEffect(() => {
    cargar();
    const t = setInterval(cargar, 15000);
    window.addEventListener('solicitudes:cambio', cargar);
    return () => { clearInterval(t); window.removeEventListener('solicitudes:cambio', cargar); };
  }, [cargar]);

  return (
    <nav aria-label="Administración" className="admin-nav">
      <h1>Administración</h1>
      <NavLink to="/admin" end className={clase}>Resumen</NavLink>
      <NavLink to="/admin/solicitudes" className={clase}>
        Solicitudes{pendientes > 0 && <span className="insignia" aria-label={`${pendientes} pendientes`}>{pendientes}</span>}
      </NavLink>
      <NavLink to="/admin/usuarios" className={clase}>Usuarios</NavLink>
      <NavLink to="/admin/recargas" className={clase}>Recargas</NavLink>
      <NavLink to="/admin/materiales" className={clase}>Materiales</NavLink>
      <NavLink to="/admin/profesores" className={clase}>Profesores</NavLink>
    </nav>
  );
}
