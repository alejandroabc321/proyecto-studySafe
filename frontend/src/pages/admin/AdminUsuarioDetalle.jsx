import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useParams } from 'react-router-dom';
import { cambiarEstadoUsuario, obtenerUsuario, recargarUsuario } from '../../api/admin';
import AdminNav from '../../components/AdminNav';
import { Button, Card, Cargando, Field, Input, Message } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { rechargeSchema } from '../../schemas/material';
import { cop, fecha, msg } from '../../utils';
import { EstadoChip } from './AdminUsuarios';

const Seccion = ({ titulo, vacio, items, children }) => (
  <section className="seccion">
    <h2>{titulo} <small>({items.length})</small></h2>
    {items.length === 0 ? <p className="vacio">{vacio}</p> : <ul className="lista">{children}</ul>}
  </section>
);

export default function AdminUsuarioDetalle() {
  const { id } = useParams();
  const { user: yo } = useAuth();
  const [d, setD] = useState(null);
  const [info, setInfo] = useState(null);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(rechargeSchema), mode: 'onTouched', defaultValues: { monto: 10000, descripcion: '' },
  });

  const cargar = useCallback(() => obtenerUsuario(id).then((r) => setD(r.data)).catch((e) => setInfo({ t: msg(e) })), [id]);
  useEffect(() => { cargar(); }, [cargar]);

  const recargar = async ({ monto, descripcion }) => {
    try {
      const { data } = await recargarUsuario(id, monto, descripcion?.trim());
      setInfo({ t: `Recarga registrada. Nuevo saldo: ${cop(data.saldo)}`, ok: true });
      reset({ monto: 10000, descripcion: '' });
      cargar();
    } catch (e) { setInfo({ t: msg(e) }); }
  };

  const alternar = async () => {
    const activar = !d.usuario.activo;
    if (!confirm(activar ? `¿Activar la cuenta de ${d.usuario.alias}?` : `¿Desactivar la cuenta de ${d.usuario.alias}? Se cerrarán todas sus sesiones.`)) return;
    try { const { data } = await cambiarEstadoUsuario(id, activar); setInfo({ t: data.mensaje, ok: true }); cargar(); }
    catch (e) { setInfo({ t: msg(e) }); }
  };

  if (!d) return (<><AdminNav />{info ? <Message message={info.t} /> : <Cargando />}</>);
  const u = d.usuario;
  const esAdmin = u.rol === 'admin';
  const soyYo = yo?.id === u._id;

  return (<>
    <AdminNav />
    <Link to="/admin/usuarios" className="volver">← Volver a usuarios</Link>
    <Card className="tarjeta--separada">
      <div className="perfil-cabecera">
        <div>
          <h2>{u.alias} {esAdmin && <span className="insignia-admin">ADMIN</span>}</h2>
          <p className="texto-suave">{u.email_institucional}</p>
          {u.nombre_real && <p className="texto-suave texto-chico">Nombre real: {u.nombre_real}</p>}
          <p className="texto-suave texto-chico">Se registró el {fecha(u.createdAt)}</p>
        </div>
        <div className="perfil-lateral">
          <EstadoChip activo={u.activo} />
          <p className="texto-suave texto-chico">Saldo</p>
          <p className="saldo">{cop(u.billetera?.saldo)}</p>
        </div>
      </div>
      {!esAdmin && !soyYo && (
        <div className="separado"><Button variant={u.activo ? 'danger' : 'primary'} onClick={alternar}>{u.activo ? 'Desactivar cuenta' : 'Activar cuenta'}</Button></div>
      )}
    </Card>

    {info && <Message ok={info.ok} message={info.t} />}

    {u.activo ? (
      <Card className="tarjeta--formulario tarjeta--separada">
        <h2>Recargar saldo</h2>
        <p className="texto-suave texto-chico">Queda registrado con tu usuario como responsable.</p>
        <form onSubmit={handleSubmit(recargar)} noValidate>
          <div className="formulario-2col">
            <Field label="Monto en COP" error={errors.monto}><Input type="number" step="1000" {...register('monto')} /></Field>
            <Field label="Nota (opcional)" error={errors.descripcion}><Input placeholder="Ej. pago por Nequi" {...register('descripcion')} /></Field>
          </div>
          <Button className="btn--separado-chico" disabled={isSubmitting}>Recargar</Button>
        </form>
      </Card>
    ) : <p className="vacio">La cuenta está desactivada: no se puede recargar hasta que se active.</p>}

    <Seccion titulo="Compras" items={d.compras} vacio="Aún no ha comprado materiales.">
      {d.compras.map((c) => (
        <li key={c._id} className="lista__item">
          <span>{c.material ? <Link to={`/material/${c.material._id}`} className="enlace-fuerte">{c.material.titulo}</Link> : <i>Material eliminado</i>}<small className="lista__sub">{c.material?.materia} · {fecha(c.createdAt)}</small></span>
          <b className="numero">{cop(c.precio)}</b>
        </li>
      ))}
    </Seccion>

    <Seccion titulo="Publicaciones" items={d.publicaciones} vacio="Aún no ha publicado materiales.">
      {d.publicaciones.map((m) => (
        <li key={m._id} className="lista__item">
          <span><Link to={`/material/${m._id}`} className="enlace-fuerte">{m.titulo}</Link><small className="lista__sub">{m.materia} · {m.tipo} · {fecha(m.createdAt)} · {m.descargas} {m.descargas === 1 ? 'venta' : 'ventas'}</small></span>
          <b className="numero">{m.precio === 0 ? 'Gratis' : cop(m.precio)}</b>
        </li>
      ))}
    </Seccion>

    <Seccion titulo="Movimientos" items={d.movimientos} vacio="Sin movimientos.">
      {d.movimientos.map((t) => (
        <li key={t._id} className="lista__item">
          <span>{t.descripcion}<small className="lista__sub">{fecha(t.createdAt)}{t.realizadaPor && ` · registrada por ${t.realizadaPor.alias}`}</small></span>
          <strong className={t.monto < 0 ? 'monto-mal' : 'monto-ok'}>{t.monto < 0 ? '−' : '+'}{cop(Math.abs(t.monto))}</strong>
        </li>
      ))}
    </Seccion>
  </>);
}
