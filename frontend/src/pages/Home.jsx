import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { obtenerMateriales } from '../api/materiales';
import { Button, ButtonLink, Input, Message, Select } from '../components/ui';
import { MaterialCard } from '../components/MaterialCard';
import { useDebounce } from '../hooks/useDebounce';
import { TIPOS } from '../schemas/material';
import { msg } from '../utils';

const ORDENES = [
  ['recientes', 'Más recientes'],
  ['precio_asc', 'Precio: menor a mayor'],
  ['precio_desc', 'Precio: mayor a menor'],
];

export default function Home() {
  const { user } = useAuth();
  const [texto, setTexto] = useState('');
  const [tipo, setTipo] = useState('');
  const [orden, setOrden] = useState('recientes');
  const [d, setD] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [err, setErr] = useState('');

  // La búsqueda se lanza 300 ms después de la última tecla, no en cada pulsación.
  const q = useDebounce(texto.trim(), 300);

  // La página solo vale para los filtros con los que se eligió; si cambian, vuelve a la 1.
  const filtros = `${q}|${tipo}|${orden}`;
  const [pag, setPag] = useState({ filtros, n: 1 });
  const pagina = pag.filtros === filtros ? pag.n : 1;
  const irAPagina = (n) => setPag({ filtros, n });

  useEffect(() => {
    const ctrl = new AbortController();
    setCargando(true);
    const params = { pagina, limite: 9, orden, ...(q && { q }), ...(tipo && { tipo }) };
    obtenerMateriales(params, ctrl.signal)
      .then((r) => { setD(r.data); setErr(''); setCargando(false); })
      .catch((e) => {
        if (e.code === 'ERR_CANCELED') return;   // llegó una búsqueda más nueva
        setErr(msg(e)); setCargando(false);
      });
    return () => ctrl.abort();
  }, [q, tipo, orden, pagina]);

  const paginas = d ? Math.max(Math.ceil(d.total / d.limite), 1) : 1;
  const hayFiltros = texto !== '' || tipo !== '' || orden !== 'recientes';
  const limpiar = () => { setTexto(''); setTipo(''); setOrden('recientes'); };

  return (<>
    {!user && (
      <section className="hero">
        <h1>Los talleres y parciales que ya resolvieron tus compañeros.</h1>
        <p>Compra material de estudiantes de Uniautónoma, o publica el tuyo y recibe el pago en tu billetera.</p>
        <div className="fila"><ButtonLink to="/registro" variant="hl">Crear cuenta</ButtonLink><a href="#material" className="btn btn--blanco-borde">Ver material</a></div>
      </section>
    )}
    <h1 id="material" className="titulo-pagina">Material disponible</h1>

    <div role="search" className="busqueda">
      <div className="busqueda__texto">
        <Input type="search" placeholder="Buscar por título, materia o profesor" aria-label="Buscar material" autoComplete="off"
          value={texto} onChange={(e) => setTexto(e.target.value)} />
      </div>
      <div className="busqueda__tipo"><Select aria-label="Tipo" value={tipo} onChange={(e) => setTipo(e.target.value)}><option value="">Todos los tipos</option>{TIPOS.map((t) => <option key={t}>{t}</option>)}</Select></div>
      <div className="busqueda__orden"><Select aria-label="Ordenar por" value={orden} onChange={(e) => setOrden(e.target.value)}>{ORDENES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</Select></div>
      {hayFiltros && <Button variant="outline" onClick={limpiar}>Limpiar</Button>}
    </div>

    <p className="contador" aria-live="polite">
      {cargando && d ? 'Buscando…' : d && `${d.total} ${d.total === 1 ? 'resultado' : 'resultados'}${q ? ` para “${q}”` : ''}`}
    </p>

    {err && <Message message={err} />}
    {d?.materiales.length === 0 && !cargando && (
      <p className="vacio">No encontramos material con esa búsqueda. Prueba con otra palabra, quita algún filtro o publica el tuyo.</p>
    )}

    {/* Los resultados anteriores se quedan visibles (atenuados) mientras llegan los nuevos. */}
    <div className={`rejilla${cargando && d ? ' rejilla--buscando' : ''}`}>
      {!d && !err && Array.from({ length: 6 }).map((_, i) => <div key={i} className="esqueleto" />)}
      {d?.materiales.map((m) => <MaterialCard key={m._id} material={m} pie={<>de <strong>{m.autor?.alias}</strong></>} />)}
    </div>

    {d && paginas > 1 && (
      <div className="paginacion">
        <Button variant="outline" disabled={pagina <= 1} onClick={() => irAPagina(pagina - 1)}>Anterior</Button>
        <span>Página {pagina} de {paginas}</span>
        <Button variant="outline" disabled={pagina >= paginas} onClick={() => irAPagina(pagina + 1)}>Siguiente</Button>
      </div>
    )}
  </>);
}
