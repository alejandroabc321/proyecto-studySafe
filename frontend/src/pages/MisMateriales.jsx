import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { obtenerMisMateriales } from '../api/materiales';
import { Card, Message } from '../components/ui';
import { MaterialCard } from '../components/MaterialCard';
import { msg } from '../utils';

export default function MisMateriales() {
  const [items, setItems] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => { obtenerMisMateriales().then((r) => setItems(r.data.materiales)).catch((e) => setErr(msg(e))); }, []);
  const ventas = items?.reduce((s, m) => s + (m.precio > 0 ? m.descargas : 0), 0) ?? 0;

  return (<>
    <h1 className="titulo-pagina">Mis materiales</h1>
    {err && <Message message={err} />}
    {items && (
      <div className="estadisticas">
        <Card><b>{items.length}</b>publicados</Card>
        <Card><b>{ventas}</b>ventas en total</Card>
      </div>
    )}
    {items?.length === 0 && <p className="vacio">Aún no has publicado nada. <Link to="/publicar" className="enlace-fuerte">Publica tu primer material</Link>.</p>}
    <div className="rejilla">
      {items?.map((m) => <MaterialCard key={m._id} material={m} pie={m.precio === 0 ? 'Gratis' : `${m.descargas} ${m.descargas === 1 ? 'venta' : 'ventas'}`} />)}
    </div>
  </>);
}
