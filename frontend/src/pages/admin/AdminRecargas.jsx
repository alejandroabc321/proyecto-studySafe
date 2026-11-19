import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { obtenerRecargas, obtenerUsuarios, recargarUsuario } from '../../api/admin';
import AdminNav from '../../components/AdminNav';
import { Button, Card, Field, Input, Message } from '../../components/ui';
import { useDebounce } from '../../hooks/useDebounce';
import { rechargeSchema } from '../../schemas/material';
import { cop, fecha, msg } from '../../utils';

export default function AdminRecargas() {
  const [q, setQ] = useState('');
  const [encontrados, setEncontrados] = useState([]);
  const [elegido, setElegido] = useState(null);
  const [errUsuario, setErrUsuario] = useState(null);
  const [info, setInfo] = useState(null);
  const [hist, setHist] = useState(null);
  const [pagina, setPagina] = useState(1);
  const qDeb = useDebounce(q.trim(), 300);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(rechargeSchema), mode: 'onTouched', defaultValues: { monto: 10000, descripcion: '' },
  });

  // Buscador de usuario: se filtra mientras escribes (por alias o correo).
  useEffect(() => {
    if (qDeb.length < 2) { setEncontrados([]); return undefined; }
    const ctrl = new AbortController();
    obtenerUsuarios({ q: qDeb, limite: 6 }, ctrl.signal).then((r) => setEncontrados(r.data.usuarios.filter((u) => u.activo))).catch(() => {});
    return () => ctrl.abort();
  }, [qDeb]);

  const cargar = useCallback(() => obtenerRecargas({ pagina }).then((r) => setHist(r.data)).catch((e) => setInfo({ t: msg(e) })), [pagina]);
  useEffect(() => { cargar(); }, [cargar]);

  const elegir = (u) => { setElegido(u); setQ(''); setEncontrados([]); setErrUsuario(null); };

  const recargar = async ({ monto, descripcion }) => {
    if (!elegido) { setErrUsuario({ message: 'Busca y elige al usuario que recibirá el saldo' }); return; }
    try {
      const { data } = await recargarUsuario(elegido._id, monto, descripcion?.trim());
      setInfo({ t: `Recarga registrada para ${elegido.alias}. Nuevo saldo: ${cop(data.saldo)}`, ok: true });
      setElegido(null); reset({ monto: 10000, descripcion: '' });
      if (pagina === 1) cargar(); else setPagina(1);
    } catch (e) { setInfo({ t: msg(e) }); }
  };

  const paginas = hist ? Math.max(1, Math.ceil(hist.total / hist.limite)) : 1;

  return (<>
    <AdminNav />
    <div className="admin-grid">
      <Card className="tarjeta--arriba">
        <h2>Recargar saldo</h2>
        <p className="texto-suave texto-chico">Queda registrado con tu usuario como responsable.</p>
        <form onSubmit={handleSubmit(recargar)} noValidate>
          <Field label="Usuario" error={errUsuario} hint="Escribe al menos 2 letras del alias o del correo.">
            {elegido ? (
              <div className="fila">
                <strong>{elegido.alias}</strong><span className="texto-suave texto-chico">{elegido.email_institucional} · saldo {cop(elegido.billetera?.saldo)}</span>
                <button type="button" className="enlace-peligro" onClick={() => setElegido(null)}>Cambiar</button>
              </div>
            ) : (<>
              <Input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar usuario…" autoComplete="off" aria-label="Buscar usuario" />
              {encontrados.length > 0 && (
                <ul className="lista separado" role="listbox" aria-label="Usuarios encontrados">
                  {encontrados.map((u) => (
                    <li key={u._id}><button type="button" role="option" aria-selected="false" className="lista__item lista__boton" onClick={() => elegir(u)}>
                      <span><b>{u.alias}</b><small className="lista__sub">{u.email_institucional}</small></span><span className="numero">{cop(u.billetera?.saldo)}</span>
                    </button></li>
                  ))}
                </ul>
              )}
              {qDeb.length >= 2 && encontrados.length === 0 && <p className="campo__ayuda">No hay usuarios activos con esa búsqueda.</p>}
            </>)}
          </Field>
          <Field label="Monto en COP" error={errors.monto}><Input type="number" step="1000" {...register('monto')} /></Field>
          <Field label="Nota (opcional)" error={errors.descripcion}><Input placeholder="Ej. pago por Nequi" {...register('descripcion')} /></Field>
          {info && <Message ok={info.ok} message={info.t} />}
          <Button className="btn--separado" disabled={isSubmitting}>Recargar</Button>
        </form>
      </Card>

      <section>
        <h2 className="subtitulo-seccion">Historial de recargas {hist && <small className="texto-suave">({hist.total})</small>}</h2>
        {hist?.recargas.length === 0 && <p className="vacio">Aún no se han registrado recargas.</p>}
        {hist?.recargas.length > 0 && (
          <ul className="lista">
            {hist.recargas.map((t) => (
              <li key={t._id} className="lista__item">
                <span>
                  {t.usuario ? <Link to={`/admin/usuarios/${t.usuario._id}`} className="enlace-fuerte">{t.usuario.alias}</Link> : <i>Usuario eliminado</i>}
                  <small className="lista__sub">{t.descripcion} · {fecha(t.createdAt)}{t.realizadaPor && ` · por ${t.realizadaPor.alias}`}</small>
                </span>
                <strong className="monto-ok">+{cop(t.monto)}</strong>
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
      </section>
    </div>
  </>);
}
