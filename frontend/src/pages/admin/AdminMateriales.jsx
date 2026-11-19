import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { eliminarMaterialAdmin, obtenerMaterialesAdmin } from '../../api/admin';
import AdminNav from '../../components/AdminNav';
import { Button, Cargando, Input, Message } from '../../components/ui';
import { TipoChip } from '../../components/MaterialCard';
import { useDebounce } from '../../hooks/useDebounce';
import { cop, fecha, msg } from '../../utils';

export default function AdminMateriales() {
  const [q, setQ] = useState('');
  const [pagina, setPagina] = useState(1);
  const [d, setD] = useState(null);
  const [info, setInfo] = useState(null);
  const qDeb = useDebounce(q.trim(), 300);

  useEffect(() => { setPagina(1); }, [qDeb]);

  const cargar = useCallback((signal) => obtenerMaterialesAdmin({ q: qDeb || undefined, pagina }, signal)
    .then((r) => setD(r.data)).catch((e) => { if (e.code !== 'ERR_CANCELED') setInfo({ t: msg(e) }); }), [qDeb, pagina]);
  useEffect(() => { const c = new AbortController(); cargar(c.signal); return () => c.abort(); }, [cargar]);

  const retirar = async (m) => {
    if (!confirm(`¿Retirar "${m.titulo}"? Se borra del catálogo y sus archivos; quienes ya lo compraron perderán el acceso.`)) return;
    try { await eliminarMaterialAdmin(m._id); setInfo({ t: 'Material retirado', ok: true }); cargar(); } catch (e) { setInfo({ t: msg(e) }); }
  };

  const paginas = d ? Math.max(1, Math.ceil(d.total / d.limite)) : 1;
  return (<>
    <AdminNav />
    <div role="search"><Input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por título, materia o profesor…" aria-label="Buscar materiales" /></div>
    {info && <Message ok={info.ok} message={info.t} />}
    {!d && <Cargando />}
    {d && (<>
      <p className="contador" aria-live="polite">{d.total} {d.total === 1 ? 'material' : 'materiales'}</p>
      {d.materiales.length === 0 ? <p className="vacio">No hay materiales con ese filtro.</p> : (
        <ul className="lista">
          {d.materiales.map((m) => (
            <li key={m._id} className="lista__item">
              <span className="lista__principal">
                <Link to={`/material/${m._id}`} className="enlace-fuerte">{m.titulo}</Link> <TipoChip tipo={m.tipo} />
                <small className="lista__sub">{m.materia} · Prof. {m.profesor} · de {m.autor?.alias ?? 'usuario eliminado'} · {fecha(m.createdAt)} · {m.descargas} {m.descargas === 1 ? 'venta' : 'ventas'}{m.archivo && ' · con archivo'}</small>
              </span>
              <b className="numero">{m.precio === 0 ? 'Gratis' : cop(m.precio)}</b>
              <button type="button" className="enlace-peligro" onClick={() => retirar(m)} aria-label={`Retirar ${m.titulo}`}>Retirar</button>
            </li>
          ))}
        </ul>
      )}
      {paginas > 1 && (
        <div className="paginacion">
          <Button variant="outline" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>Anterior</Button>
          <span>Página {pagina} de {paginas}</span>
          <Button variant="outline" disabled={pagina >= paginas} onClick={() => setPagina((p) => p + 1)}>Siguiente</Button>
        </div>
      )}
    </>)}
  </>);
}
