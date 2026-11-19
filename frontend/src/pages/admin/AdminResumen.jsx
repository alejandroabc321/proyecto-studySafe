import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { obtenerResumen } from '../../api/admin';
import AdminNav from '../../components/AdminNav';
import { ButtonLink, Cargando, Message } from '../../components/ui';
import { cop, fecha, msg } from '../../utils';

const Cifra = ({ valor, titulo, nota }) => (
  <div className="tarjeta cifra"><b className="numero">{valor}</b><span>{titulo}</span>{nota && <small className="texto-suave">{nota}</small>}</div>
);

export default function AdminResumen() {
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => { obtenerResumen().then((r) => setD(r.data)).catch((e) => setErr(msg(e))); }, []);

  const r = d?.resumen;
  return (<>
    <AdminNav />
    {err && <Message message={err} />}
    {!d && !err && <Cargando />}
    {r && (<>
      {r.solicitudesPendientes > 0 && (
        <Link to="/admin/solicitudes" className="aviso aviso--accion">
          <strong>{r.solicitudesPendientes} {r.solicitudesPendientes === 1 ? 'solicitud de recarga pendiente' : 'solicitudes de recarga pendientes'}</strong> · Revisar ahora →
        </Link>
      )}
      <div className="cifras">
        <Cifra valor={r.usuarios} titulo="usuarios" nota={`${r.activos} activos · ${r.inactivos} desactivados · ${r.admins} admin`} />
        <Cifra valor={r.materiales} titulo="materiales publicados" />
        <Cifra valor={r.compras} titulo="compras realizadas" />
        <Cifra valor={cop(r.dineroVendido)} titulo="dinero movido en ventas" />
        <Cifra valor={cop(r.saldoEnCirculacion)} titulo="saldo en circulación" nota="suma de todas las billeteras" />
        <Cifra valor={cop(r.totalRecargado)} titulo="total recargado" nota="por los administradores" />
      </div>

      <div className="fila separado">
        <ButtonLink to="/admin/recargas" variant="hl">Recargar saldo</ButtonLink>
        <ButtonLink to="/admin/usuarios" variant="outline">Supervisar usuarios</ButtonLink>
        <ButtonLink to="/admin/materiales" variant="outline">Revisar materiales</ButtonLink>
      </div>

      <section className="seccion">
        <h2>Últimas recargas</h2>
        {d.recientes.length === 0 ? <p className="vacio">Aún no se han registrado recargas.</p> : (
          <ul className="lista">
            {d.recientes.map((t) => (
              <li key={t._id} className="lista__item">
                <span>
                  {t.usuario ? <Link to={`/admin/usuarios/${t.usuario._id}`} className="enlace-fuerte">{t.usuario.alias}</Link> : <i>Usuario eliminado</i>}
                  <small className="lista__sub">{fecha(t.createdAt)}{t.realizadaPor && ` · registrada por ${t.realizadaPor.alias}`}</small>
                </span>
                <strong className="monto-ok">+{cop(t.monto)}</strong>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>)}
  </>);
}
