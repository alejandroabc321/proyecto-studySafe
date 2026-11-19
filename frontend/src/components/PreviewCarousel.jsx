import { useState } from 'react';
import { urlApi } from '../config';

// Carrusel de previsualización: solo muestra las imágenes (nunca el enlace ni el archivo).
// Teclado: ← → cuando tiene el foco. Con 1 imagen no muestra controles; sin imágenes, un marcador.
export default function PreviewCarousel({ previews = [], titulo = 'material' }) {
  const [i, setI] = useState(0);
  const n = previews.length;
  const ir = (d) => setI((x) => (x + d + n) % n);
  const onKey = (e) => {
    if (n < 2) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); ir(1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); ir(-1); }
  };

  if (n === 0) {
    return (
      <div className="carrusel carrusel--vacio">
        <p><span aria-hidden="true">📄</span>Este material no tiene imágenes de previsualización</p>
      </div>
    );
  }

  return (
    <div
      role="region" aria-roledescription="carrusel" aria-label={`Previsualización de ${titulo}`}
      tabIndex={0} onKeyDown={onKey} className="carrusel"
    >
      <img
        key={previews[i]} src={urlApi(previews[i])} alt={`Vista previa ${i + 1} de ${n} de ${titulo}`}
        className="carrusel__img" draggable={false}
      />
      {n > 1 && (<>
        <button type="button" onClick={() => ir(-1)} aria-label="Imagen anterior" className="carrusel__btn carrusel__btn--anterior">‹</button>
        <button type="button" onClick={() => ir(1)} aria-label="Imagen siguiente" className="carrusel__btn carrusel__btn--siguiente">›</button>
        <div className="carrusel__puntos">
          {previews.map((p, k) => (
            <button key={p} type="button" onClick={() => setI(k)} aria-label={`Ir a la imagen ${k + 1}`} aria-current={k === i} className="carrusel__punto" />
          ))}
        </div>
        <span className="carrusel__contador" aria-hidden="true">{i + 1} / {n}</span>
      </>)}
    </div>
  );
}
