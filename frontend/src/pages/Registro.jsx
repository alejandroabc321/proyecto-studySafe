import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button, Card, Field, Input, Message } from '../components/ui';
import { registerSchema } from '../schemas/auth';

export default function Registro() {
  // mode "onTouched": el aviso sale al salir de cada campo y se actualiza mientras corriges.
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(registerSchema), mode: 'onTouched' });
  const { signup, errors: authErrors } = useAuth();
  const navigate = useNavigate();

  const onSubmit = async ({ confirmPassword, ...datos }) => {
    if (await signup(datos)) navigate('/login', { state: { ok: 'Cuenta creada. Ya puedes iniciar sesión.' } });
  };

  return (
    <Card className="tarjeta--centrada">
      <h1>Crea tu cuenta</h1>
      {authErrors.map((e, i) => <Message key={i} message={e} />)}
      {/* noValidate: los avisos los muestra la app (zod), no el globo del navegador */}
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Field label="Alias (visible para otros)" error={errors.alias}><Input {...register('alias')} /></Field>
        <Field label="Nombre real (privado)" error={errors.nombre_real}><Input {...register('nombre_real')} /></Field>
        <Field label="Documento de identidad (privado)" error={errors.documento_identidad}><Input {...register('documento_identidad')} /></Field>
        <Field label="Correo institucional" error={errors.email_institucional} hint="Solo correos @uniautonoma.edu.co">
          <Input type="email" placeholder="nombre@uniautonoma.edu.co" autoComplete="email" {...register('email_institucional')} />
        </Field>
        <Field label="Contraseña" error={errors.password} hint="Entre 8 y 72 caracteres"><Input type="password" autoComplete="new-password" {...register('password')} /></Field>
        <Field label="Confirmar contraseña" error={errors.confirmPassword}><Input type="password" autoComplete="new-password" {...register('confirmPassword')} /></Field>
        <Button className="btn--bloque" disabled={isSubmitting}>Crear cuenta</Button>
      </form>
      <p className="texto-suave separado">¿Ya tienes cuenta? <Link to="/login" className="enlace-fuerte">Inicia sesión</Link></p>
    </Card>
  );
}
