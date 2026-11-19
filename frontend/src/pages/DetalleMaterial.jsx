import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { descargarArchivo, eliminarMaterial, obtenerArchivo, obtenerMaterial } from '../api/materiales';
import { comprarMaterial } from '../api/transacciones';
import { Button, ButtonLink, Cargando, Message } from '../components/ui';
import { Precio, TipoChip } from '../components/MaterialCard';
import PreviewCarousel from '../components/PreviewCarousel';
import { cop, guardarBlob, msg, tamano } from '../utils';

// Si la descarga falla, el error llega como Blob: se lee su JSON para mostrar el mensaje del servidor.
const msgDescarga = async (e) => {
  try { return JSON.parse(await e.response.data.text()).mensaje; } catch { return msg(e); }
};

export default function DetalleMaterial() {
  const { id } = useParams();
  const { user, setSaldo } = useAuth();
  const navigate = useNavigate();
  const [m, setM] = useState(null);
  const [acceso, setAcceso] = useState(null); // { archivo_url?, archivo? } solo cuando el servidor lo autoriza
  const [info, setInfo] = useState(null);     // { t, ok }
  const [bajando, setBajando] = useState(false);

  useEffect(() => { obtenerMaterial(id).then((r) => setM(r.data.material)).catch((e) => setInfo({ t: msg(e) })); }, [id]);

  const pedirAcceso = async () => {
    try { setAcceso((await obtenerArchivo(id)).data); setInfo(null); } catch (e) { setInfo({ t: msg(e) }); }
  };
  const comprar = async () => {
    try {
      const { data } = await comprarMaterial(id);
      setSaldo(data.saldo);
      setAcceso({ archivo_url: data.archivo_url, archivo: data.tiene_archivo ? m.archivo : undefined });
      setInfo({ t: 'Compra realizada. Ya puedes obtener tu material.', ok: true });
    } catch (e) { setInfo({ t: msg(e) }); }
  };
  const descargar = async () => {
    setBajando(true);
    try { const r = await descargarArchivo(id); guardarBlob(r.data, acceso.archivo.nombre); setInfo(null); }
    catch (e) { setInfo({ t: await msgDescarga(e) }); }
    finally { setBajando(false); }
  };
  const borrar = async () => {
    if (!confirm('¿Eliminar este material? Quienes ya lo compraron perderán el acceso.')) return;
    try { await eliminarMaterial(id); navigate('/mis-materiales'); } catch (e) { setInfo({ t: msg(e) }); }
  };

  if (!m) return info ? <Message message={info.t} /> : <Cargando />;
  const esMio = user && m.autor?._id === user.id;

  return (
    <article className="detalle">
      <PreviewCarousel previews={m.previews} titulo={m.titulo} />

      <div>
        <TipoChip tipo={m.tipo} />
        <h1 className="detalle__titulo">{m.titulo}</h1>
        <p className="texto-suave">{m.materia} · Prof. {m.profesor} · de {m.autor?.alias} · {m.descargas} {m.descargas === 1 ? 'venta' : 'ventas'}</p>
        <p className="detalle__descripcion">{m.descripcion}</p>
        <p className="detalle__precio"><Precio precio={m.precio} /></p>

        {!user && <p><Link to="/login" className="enlace-fuerte">Inicia sesión</Link> para obtener este material.</p>}
        {user && !acceso && (
          <div className="fila">
            {esMio ? (<>
              <Button onClick={pedirAcceso}>Ver mi archivo</Button>
              <ButtonLink to={`/publicar/${id}`} variant="outline">Editar</ButtonLink>
              <Button variant="danger" onClick={borrar}>Eliminar</Button>
            </>) : m.precio === 0 ? (
              <Button onClick={pedirAcceso}>Obtener material gratis</Button>
            ) : (<>
              <Button variant="hl" onClick={comprar}>Comprar por {cop(m.precio)}</Button>
              <Button variant="outline" onClick={pedirAcceso}>Ya lo compré: obtener</Button>
            </>)}
          </div>
        )}
        {info && <Message ok={info.ok} message={info.t} />}

        {acceso && (
          <div className="aviso aviso--acceso">
            {acceso.archivo && (
              <Button onClick={descargar} disabled={bajando}>
                {bajando ? 'Descargando…' : `⬇ Descargar ${acceso.archivo.nombre}`} {!bajando && <small>({tamano(acceso.archivo.tamano)})</small>}
              </Button>
            )}
            {acceso.archivo_url && <a href={acceso.archivo_url} target="_blank" rel="noreferrer noopener" className="btn btn--borde">Abrir enlace</a>}
            {esMio && <ButtonLink to={`/publicar/${id}`} variant="outline">Editar</ButtonLink>}
          </div>
        )}
      </div>
    </article>
  );
}
