import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { obtenerUsuarios } from '../../api/admin';
import AdminNav from '../../components/AdminNav';
import { Button, Cargando, Input, Message, Select } from '../../components/ui';
import { useDebounce } from '../../hooks/useDebounce';
import { cop, msg } from '../../utils';

export const EstadoChip = ({ activo }) => (
  <span className={`chip ${activo ? 'chip--activo' : 'chip--inactivo'}`}>{activo ? 'Activo' : 'Desactivado'}</span>
);

export default function AdminUsuarios() {
  const [q, setQ] = useState('');
  const [rol, setRol] = useState('');
  const [pagina, setPagina] = useState(1);
  const [datos, setDatos] = useState(null);
  const [err, setErr] = useState('');
  const qDeb = useDebounce(q, 300);

  useEffect(() => { setPagina(1); }, [qDeb, rol]);

  useEffect(() => {
    const ctrl = new AbortController();
    setErr('');
    obtenerUsuarios({ q: qDeb || undefined, rol: rol || undefined, pagina }, ctrl.signal)
      .then((r) => setDatos(r.data))
      .catch((e) => { if (e.code !== 'ERR_CANCELED') setErr(msg(e)); });
    return () => ctrl.abort();
  }, [qDeb, rol, pagina]);

  const paginas = datos ? Math.max(1, Math.ceil(datos.total / datos.limite)) : 1;

  return (<>
    <AdminNav />
    <div role="search" className="busqueda">
      <div className="busqueda__texto"><Input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por alias o correo…" aria-label="Buscar usuarios" /></div>
      <div className="busqueda__tipo"><Select value={rol} onChange={(e) => setRol(e.target.value)} aria-label="Filtrar por rol"><option value="">Todos los roles</option><option value="estudiante">Estudiantes</option><option value="admin">Administradores</option></Select></div>
    </div>
    {err && <Message message={err} />}
    {!datos && !err && <Cargando />}
    {datos && (<>
      <p className="contador" aria-live="polite">{datos.total} {datos.total === 1 ? 'usuario' : 'usuarios'}</p>
      {datos.usuarios.length === 0 ? <p className="vacio">No hay usuarios con ese filtro.</p> : (
        <ul className="lista">
          {datos.usuarios.map((u) => (
            <li key={u._id}>
              <Link to={`/admin/usuarios/${u._id}`} className="lista__item lista__item--enlace">
                <span className="lista__principal">
                  <b>{u.alias}</b> {u.rol === 'admin' && <span className="insignia-admin">ADMIN</span>}
                  <small className="lista__sub">{u.email_institucional}</small>
                </span>
                <span className="numero"><strong>{cop(u.billetera?.saldo)}</strong></span>
                <EstadoChip activo={u.activo} />
              </Link>
            </li>
          ))}
        </ul>
      )}
      {paginas > 1 && (
        <div className="paginacion">
          <Button variant="outline" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>← Anterior</Button>
          <span className="texto-suave texto-chico">Página {pagina} de {paginas}</span>
          <Button variant="outline" disabled={pagina >= paginas} onClick={() => setPagina((p) => p + 1)}>Siguiente →</Button>
        </div>
      )}
    </>)}
  </>);
}
