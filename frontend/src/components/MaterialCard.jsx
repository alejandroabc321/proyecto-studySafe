import { Link } from 'react-router-dom';
import { urlApi } from '../config';
import { cop } from '../utils';

export const TipoChip = ({ tipo }) => <span className={`chip chip--${tipo}`}>{tipo}</span>;
export const Precio = ({ precio }) => <span className="precio">{precio === 0 ? 'Gratis' : cop(precio)}</span>;

// `pie` permite mostrar otra cosa en la esquina inferior izquierda (autor, ventas...).
export function MaterialCard({ material: m, pie }) {
  return (
    <Link to={`/material/${m._id}`} className="material-card">
      {m.previews?.[0] && <img src={urlApi(m.previews[0])} alt="" loading="lazy" className="material-card__img" />}
      <TipoChip tipo={m.tipo} />
      <h2 className="material-card__titulo">{m.titulo}</h2>
      <p className="material-card__meta">{m.materia}{m.profesor && ` · Prof. ${m.profesor}`}</p>
      <div className="material-card__pie">
        <span>{pie}</span>
        <Precio precio={m.precio} />
      </div>
    </Link>
  );
}
export default MaterialCard;
