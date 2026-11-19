import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { crearProfesor, eliminarProfesor } from '../../api/admin';
import { obtenerProfesores } from '../../api/materiales';
import AdminNav from '../../components/AdminNav';
import { Button, Card, Field, Input, Message } from '../../components/ui';
import { profesorSchema } from '../../schemas/material';
import { msg } from '../../utils';

export default function AdminProfesores() {
  const [lista, setLista] = useState(null);
  const [info, setInfo] = useState(null);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(profesorSchema), mode: 'onTouched', defaultValues: { nombre: '', facultad: '', materia: '' },
  });

  const cargar = () => obtenerProfesores().then((r) => setLista(r.data.profesores)).catch((e) => setInfo({ t: msg(e) }));
  useEffect(() => { cargar(); }, []);

  const agregar = async (datos) => {
    try { await crearProfesor(datos); setInfo({ t: 'Profesor agregado', ok: true }); reset(); cargar(); }
    catch (e) { setInfo({ t: msg(e) }); }
  };

  const quitar = async (p) => {
    if (!confirm(`¿Eliminar a ${p.nombre}? Los materiales ya publicados conservan su nombre.`)) return;
    try { await eliminarProfesor(p._id); setInfo({ t: 'Profesor eliminado', ok: true }); cargar(); } catch (e) { setInfo({ t: msg(e) }); }
  };

  return (<>
    <AdminNav />
    <div className="admin-grid">
      <Card className="tarjeta--arriba">
        <h2>Agregar profesor</h2>
        <p className="texto-suave texto-chico">Los estudiantes también los registran al publicar; aquí puedes completar la facultad o quitar los duplicados.</p>
        <form onSubmit={handleSubmit(agregar)} noValidate>
          <Field label="Nombre completo" error={errors.nombre}><Input {...register('nombre')} /></Field>
          <Field label="Facultad" error={errors.facultad}><Input {...register('facultad')} /></Field>
          <Field label="Materia" error={errors.materia}><Input {...register('materia')} /></Field>
          {info && <Message ok={info.ok} message={info.t} />}
          <Button className="btn--separado-chico" disabled={isSubmitting}>Agregar</Button>
        </form>
      </Card>
      <section>
        <h2 className="subtitulo-seccion">Profesores registrados {lista && <small className="texto-suave">({lista.length})</small>}</h2>
        {lista?.length === 0 && <p className="vacio">Aún no hay profesores.</p>}
        {lista?.length > 0 && (
          <ul className="lista">
            {lista.map((p) => <li key={p._id} className="lista__item">
              <span><b>{p.nombre}</b><small className="lista__sub">{p.facultad} · {p.materia}</small></span>
              <button type="button" onClick={() => quitar(p)} aria-label={`Eliminar a ${p.nombre}`} className="enlace-peligro">Eliminar</button>
            </li>)}
          </ul>
        )}
      </section>
    </div>
  </>);
}
