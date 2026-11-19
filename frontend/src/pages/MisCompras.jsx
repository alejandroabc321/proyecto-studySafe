import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { obtenerMisCompras } from '../api/transacciones';
import { Message } from '../components/ui';
import { cop, fecha, msg } from '../utils';

export default function MisCompras() {
  const [items, setItems] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => { obtenerMisCompras().then((r) => setItems(r.data.compras)).catch((e) => setErr(msg(e))); }, []);

  return (<>
    <h1 className="titulo-pagina">Mis compras</h1>
    {err && <Message message={err} />}
    {items?.length === 0 && <p className="vacio">Aún no has comprado nada. <Link to="/" className="enlace-fuerte">Explora el material</Link>.</p>}
    {items?.length > 0 && (
      <ul className="lista">
        {items.map((c) => (
          <li key={c._id} className="lista__item">
            <span>
              {c.material ? <Link to={`/material/${c.material._id}`} className="enlace-fuerte">{c.material.titulo}</Link> : 'Material eliminado por su autor'}
              <small className="lista__sub">{c.material?.materia} · comprado el {fecha(c.createdAt)}</small>
            </span>
            <strong>{cop(c.precio)}</strong>
          </li>
        ))}
      </ul>
    )}
  </>);
}
