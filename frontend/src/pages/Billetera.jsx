import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { obtenerHistorial, obtenerMisSolicitudes, solicitarRecarga } from '../api/transacciones';
import { Button, Card, Field, Input, Message } from '../components/ui';
import { solicitudSchema } from '../schemas/material';
import { cop, fecha, msg } from '../utils';

// El usuario no se recarga solo: SOLICITA un monto y el administrador lo aprueba o rechaza.
const ESTADOS = { pendiente: 'Pendiente', aprobada: 'Aprobada', rechazada: 'Rechazada' };
const CONTACTO_ADMIN = import.meta.env.VITE_CONTACTO_ADMIN || '';

export default function Billetera() {
  const { user } = useAuth();
  const [hist, setHist] = useState([]);
  const [sols, setSols] = useState([]);
  const [info, setInfo] = useState(null);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(solicitudSchema), mode: 'onTouched', defaultValues: { monto: '', nota: '' },
  });

  const cargar = () => Promise.all([obtenerHistorial(), obtenerMisSolicitudes()])
    .then(([h, s]) => { setHist(h.data.transacciones); setSols(s.data.solicitudes); }).catch((e) => setInfo({ t: msg(e) }));
  useEffect(() => { cargar(); }, []);
  // Si el admin aprueba mientras estás aquí, el saldo y la lista se actualizan solos.
  useEffect(() => { const t = setInterval(cargar, 10000); return () => clearInterval(t); }, []);

  const solicitar = async ({ monto, nota }) => {
    try {
      const { data } = await solicitarRecarga(monto, nota?.trim() || undefined);
      setInfo({ t: data.mensaje, ok: true }); reset({ monto: '', nota: '' }); cargar();
    } catch (e) { setInfo({ t: msg(e) }); }
  };

  return (<>
    <h1 className="titulo-pagina">Tu billetera</h1>
    <Card className="tarjeta--angosta">
      <p className="texto-suave">Saldo disponible</p>
      <p className="saldo">{cop(user.billetera?.saldo)}</p>
      <p className="texto-suave texto-chico">Aquí también entra el dinero de tus ventas.</p>

      <div className="aviso">
        <p><strong>¿Necesitas más saldo?</strong></p>
        <p className="texto-chico">Indica cuánto necesitas y el administrador revisará tu solicitud.</p>
        {CONTACTO_ADMIN && <p className="texto-chico">Para pagar, contacta al administrador: <strong>{CONTACTO_ADMIN}</strong></p>}
      </div>

      <form onSubmit={handleSubmit(solicitar)} noValidate>
        <Field label="Monto que solicitas (COP)" error={errors.monto}><Input type="number" step="1000" placeholder="Ej. 20000" {...register('monto')} /></Field>
        <Field label="Nota (opcional)" error={errors.nota}><Input placeholder="Ej. pagué por Nequi" {...register('nota')} /></Field>
        {info && <Message ok={info.ok} message={info.t} />}
        <Button className="btn--separado" disabled={isSubmitting}>Solicitar recarga</Button>
      </form>
    </Card>

    {sols.length > 0 && (<>
      <h2 className="subtitulo">Mis solicitudes</h2>
      <ul className="lista">
        {sols.map((x) => (
          <li key={x._id} className="lista__item">
            <span>{cop(x.monto)}<small className="lista__sub">{fecha(x.createdAt)}{x.nota && ` · ${x.nota}`}</small></span>
            <span className={`chip chip--${x.estado}`}>{ESTADOS[x.estado]}</span>
          </li>
        ))}
      </ul>
    </>)}
    <h2 className="subtitulo">Movimientos</h2>
    {hist.length === 0 ? <p className="vacio">Aún no tienes movimientos.</p> : (
      <ul className="lista">
        {hist.map((t) => (
          <li key={t._id} className="lista__item">
            <span>{t.descripcion}<small className="lista__sub">{fecha(t.createdAt)}</small></span>
            <strong className={t.monto < 0 ? 'monto-mal' : 'monto-ok'}>{t.monto < 0 ? '−' : '+'}{cop(Math.abs(t.monto))}</strong>
          </li>
        ))}
      </ul>
    )}
  </>);
}
