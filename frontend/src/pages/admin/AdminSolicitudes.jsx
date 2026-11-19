import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { aprobarSolicitud, obtenerSolicitudes, rechazarSolicitud } from '../../api/admin';
import AdminNav from '../../components/AdminNav';
import { Button, Cargando, Message } from '../../components/ui';
import { cop, fecha, msg } from '../../utils';

const FILTROS = [['pendiente', 'Pendientes'], ['aprobada', 'Aprobadas'], ['rechazada', 'Rechazadas']];
const ETIQ = { pendiente: 'Pendiente', aprobada: 'Aprobada', rechazada: 'Rechazada' };

export default function AdminSolicitudes() {
  const [estado, setEstado] = useState('pendiente');
  const [pagina, setPagina] = useState(1);
  const [d, setD] = useState(null);
  const [info, setInfo] = useState(null);
  const [ocupada, setOcupada] = useState(null);

  useEffect(() => { setPagina(1); }, [estado]);
  const cargar = useCallback(() => obtenerSolicitudes({ estado, pagina }).then((r) => setD(r.data)).catch((e) => setInfo({ t: msg(e) })), [estado, pagina]);
  useEffect(() => { cargar(); const t = setInterval(cargar, 15000); return () => clearInterval(t); }, [cargar]);

  const resolver = async (s, aprobar) => {
    const texto = aprobar
      ? `¿Aprobar ${cop(s.monto)} para ${s.usuario?.alias}? Se le sumará al saldo ya.`
      : `¿Rechazar la solicitud de ${cop(s.monto)} de ${s.usuario?.alias}?`;
    if (!confirm(texto)) return;
    setOcupada(s._id);
    try {
      const { data } = await (aprobar ? aprobarSolicitud : rechazarSolicitud)(s._id);
      setInfo({ t: data.mensaje, ok: true });
      window.dispatchEvent(new Event('solicitudes:cambio'));
    } catch (e) { setInfo({ t: msg(e) }); }
    setOcupada(null); cargar();
  };

  const paginas = d ? Math.max(1, Math.ceil(d.total / d.limite)) : 1;
  return (<>
    <AdminNav />
    <div className="filtros" role="tablist" aria-label="Estado de la solicitud">
      {FILTROS.map(([v, t]) => (
        <button key={v} type="button" role="tab" aria-selected={estado === v} className={`pestana${estado === v ? ' pestana--activa' : ''}`} onClick={() => setEstado(v)}>
          {t}{v === 'pendiente' && d && d.pendientes > 0 && <span className="insignia">{d.pendientes}</span>}
        </button>
      ))}
    </div>
    {info && <Message ok={info.ok} message={info.t} />}
    {!d && <Cargando />}
    {d && (d.solicitudes.length === 0
      ? <p className="vacio">{estado === 'pendiente' ? 'No hay solicitudes pendientes. 🎉' : 'No hay solicitudes en este estado.'}</p>
      : (
        <ul className="lista">
          {d.solicitudes.map((s) => (
            <li key={s._id} className="lista__item">
              <span className="lista__principal">
                {s.usuario ? <Link to={`/admin/usuarios/${s.usuario._id}`} className="enlace-fuerte">{s.usuario.alias}</Link> : <i>Usuario eliminado</i>}
                <small className="lista__sub">
                  {s.usuario?.email_institucional} · saldo actual {cop(s.usuario?.billetera?.saldo)} · {fecha(s.createdAt)}
                </small>
                {s.nota && <small className="lista__sub">“{s.nota}”</small>}
                {s.estado !== 'pendiente' && <small className="lista__sub">{ETIQ[s.estado]} por {s.resueltaPor?.alias ?? 'admin'} · {fecha(s.resueltaEn)}</small>}
              </span>
              <b className="numero">{cop(s.monto)}</b>
              {s.estado === 'pendiente'
                ? (<span className="acciones">
                    <Button variant="hl" disabled={ocupada === s._id} onClick={() => resolver(s, true)}>Aprobar</Button>
                    <Button variant="outline" disabled={ocupada === s._id} onClick={() => resolver(s, false)}>Rechazar</Button>
                  </span>)
                : <span className={`chip chip--${s.estado}`}>{ETIQ[s.estado]}</span>}
            </li>
          ))}
        </ul>
      ))}
    {paginas > 1 && (
      <div className="paginacion">
        <Button variant="outline" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>Anterior</Button>
        <span>Página {pagina} de {paginas}</span>
        <Button variant="outline" disabled={pagina >= paginas} onClick={() => setPagina((p) => p + 1)}>Siguiente</Button>
      </div>
    )}
  </>);
}
