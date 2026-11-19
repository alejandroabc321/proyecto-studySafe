import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button, Card, Field, Input, Message } from '../components/ui';
import { loginSchema } from '../schemas/auth';

export default function Login() {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(loginSchema), mode: 'onTouched' });
  const { signin, errors: authErrors, user } = useAuth();
  const navigate = useNavigate();
  const { state } = useLocation();

  // Un administrador entra directo a su panel; el resto, al catálogo.
  useEffect(() => { if (user) navigate(user.rol === 'admin' ? '/admin' : '/'); }, [user]);

  return (
    <Card className="tarjeta--centrada">
      <h1>Inicia sesión</h1>
      {state?.ok && <Message ok message={state.ok} />}
      {authErrors.map((e, i) => <Message key={i} message={e} />)}
      <form onSubmit={handleSubmit(signin)} noValidate>
        <Field label="Correo institucional" error={errors.email_institucional}><Input type="email" placeholder="nombre@uniautonoma.edu.co" autoComplete="email" {...register('email_institucional')} /></Field>
        <Field label="Contraseña" error={errors.password}><Input type="password" autoComplete="current-password" {...register('password')} /></Field>
        <Button className="btn--bloque" disabled={isSubmitting}>Entrar</Button>
      </form>
      <p className="texto-suave separado">¿Primera vez? <Link to="/registro" className="enlace-fuerte">Crea tu cuenta</Link></p>
    </Card>
  );
}
