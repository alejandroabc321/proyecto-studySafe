import { forwardRef } from 'react';
import { Link } from 'react-router-dom';
import '../../styles/forms.css';

const unir = (...c) => c.filter(Boolean).join(' ');
const VARIANTES = { primary: 'btn--primario', hl: 'btn--resalte', outline: 'btn--borde', danger: 'btn--peligro' };

export const Button = ({ variant = 'primary', className = '', ...p }) => <button className={unir('btn', VARIANTES[variant], className)} {...p} />;
export const ButtonLink = ({ variant = 'primary', className = '', ...p }) => <Link className={unir('btn', VARIANTES[variant], className)} {...p} />;

export const Card = ({ className = '', ...p }) => <div className={unir('tarjeta', className)} {...p} />;

export const Input = forwardRef((p, ref) => <input ref={ref} className="input" {...p} />);
export const Textarea = forwardRef((p, ref) => <textarea ref={ref} rows="3" className="input" {...p} />);
export const Select = forwardRef((p, ref) => <select ref={ref} className="input" {...p} />);

// `hint` es una ayuda opcional; `error` muestra la alerta del campo en rojo.
export const Field = ({ label, error, hint, children }) => (
  <div className={unir('campo', error && 'campo--error')}>
    <label className="campo__etiqueta">{label}</label>
    <div>{children}</div>
    {hint && !error && <p className="campo__ayuda">{hint}</p>}
    {error && <p role="alert" className="campo__error">⚠ {error.message}</p>}
  </div>
);

export const Message = ({ message, ok }) => (
  <p role="alert" className={unir('mensaje', ok ? 'mensaje--ok' : 'mensaje--error')}>{message}</p>
);

export const Cargando = ({ texto = 'Cargando…' }) => <p className="cargando" role="status">{texto}</p>;
