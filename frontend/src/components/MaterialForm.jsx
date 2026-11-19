import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { obtenerProfesores } from '../api/materiales';
import { Button, Field, Input, Message, Select, Textarea } from './ui';
import { materialSchema, TIPOS } from '../schemas/material';
import { MAX_DOC_MB, MAX_IMG_MB, MAX_PREVIEWS } from '../config';
import { tamano } from '../utils';
import '../styles/forms.css';

const VACIO = { titulo: '', descripcion: '', materia: '', profesor: '', tipo: 'Taller', precio: 0, archivo_url: '' };
const DOCS = ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'zip'];
const IMGS = ['image/jpeg', 'image/png', 'image/webp'];
const ext = (n) => n.split('.').pop().toLowerCase();

// Formulario reutilizable (como indica la guía): lo usan CrearMaterial y EditarMaterial.
// `valoresIniciales` rellena el formulario al editar; `actual` describe lo ya publicado ({ archivo, previews });
// `onSubmit(datos, { archivo, previews })` recibe los datos ya validados.
export default function MaterialForm({ editando = false, valoresIniciales, actual, onSubmit, error }) {
  const schema = useMemo(() => materialSchema(), []);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema), mode: 'onTouched', defaultValues: VACIO,
  });
  const [profs, setProfs] = useState([]);
  const [archivo, setArchivo] = useState(null);
  const [previews, setPreviews] = useState([]);
  const [errArchivo, setErrArchivo] = useState(null);
  const [errPreviews, setErrPreviews] = useState(null);
  const [errEntrega, setErrEntrega] = useState(null);

  useEffect(() => { obtenerProfesores().then((r) => setProfs(r.data.profesores)).catch(() => {}); }, []);
  useEffect(() => { if (valoresIniciales) reset({ ...VACIO, ...valoresIniciales }); }, [valoresIniciales, reset]);

  // Miniaturas locales de las imágenes elegidas (se liberan al cambiarlas).
  const miniaturas = useMemo(() => previews.map((f) => URL.createObjectURL(f)), [previews]);
  useEffect(() => () => miniaturas.forEach(URL.revokeObjectURL), [miniaturas]);

  const elegirArchivo = (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (!DOCS.includes(ext(f.name))) return setErrArchivo({ message: 'Formato no permitido. Usa PDF, Word, PowerPoint, Excel o ZIP' });
    if (f.size > MAX_DOC_MB * 1048576) return setErrArchivo({ message: `El archivo pesa ${tamano(f.size)}; el máximo es ${MAX_DOC_MB} MB` });
    setErrArchivo(null); setErrEntrega(null); setArchivo(f);
  };

  const elegirImagenes = (e) => {
    const nuevas = [...(e.target.files || [])];
    e.target.value = '';
    if (!nuevas.length) return;
    if (previews.length + nuevas.length > MAX_PREVIEWS) return setErrPreviews({ message: `Máximo ${MAX_PREVIEWS} imágenes de previsualización` });
    const mala = nuevas.find((f) => !IMGS.includes(f.type));
    if (mala) return setErrPreviews({ message: `"${mala.name}" no es una imagen JPG, PNG o WEBP` });
    const grande = nuevas.find((f) => f.size > MAX_IMG_MB * 1048576);
    if (grande) return setErrPreviews({ message: `"${grande.name}" pesa ${tamano(grande.size)}; el máximo es ${MAX_IMG_MB} MB por imagen` });
    setErrPreviews(null); setPreviews((p) => [...p, ...nuevas]);
  };

  const enviar = (datos) => {
    // Al publicar hace falta al menos un archivo o un enlace; al editar ya existe uno.
    if (!editando && !archivo && !datos.archivo_url) {
      setErrEntrega({ message: 'Sube un archivo o pega un enlace del material' });
      return undefined;
    }
    return onSubmit(datos, { archivo, previews });
  };

  const boton = 'archivo-boton';

  return (
    <form onSubmit={handleSubmit(enviar)} noValidate>
      <Field label="Título" error={errors.titulo}><Input {...register('titulo')} autoFocus /></Field>
      <Field label="Descripción" error={errors.descripcion}><Textarea {...register('descripcion')} /></Field>
      <div className="formulario-2col">
        <Field label="Materia" error={errors.materia}><Input {...register('materia')} /></Field>
        <Field label="Profesor" error={errors.profesor} hint="Elige uno de la lista o escribe uno nuevo: se registrará solo.">
          <Input list="profesores" {...register('profesor')} />
          <datalist id="profesores">{profs.map((p) => <option key={p._id} value={p.nombre} />)}</datalist>
        </Field>
        <Field label="Tipo" error={errors.tipo}><Select {...register('tipo')}>{TIPOS.map((t) => <option key={t}>{t}</option>)}</Select></Field>
        <Field label="Precio en COP (0 = gratis)" error={errors.precio}><Input type="number" step="1" {...register('precio')} /></Field>
      </div>

      <fieldset className="grupo">
        <legend>¿Cómo entregas el material?</legend>
        <p className="grupo__texto">
          Sube el archivo (se guarda en el servidor) y/o pega un enlace. Quien compre lo recibe; <b>ni el enlace ni el archivo se muestran antes de comprar</b>.
        </p>

        <Field label="Archivo del material" error={errArchivo || errEntrega} hint={`PDF, Word, PowerPoint, Excel o ZIP · máximo ${MAX_DOC_MB} MB`}>
          <div className="fila">
            <label className={boton}>
              {archivo ? 'Cambiar archivo' : editando ? 'Reemplazar archivo' : 'Elegir archivo'}
              <input type="file" accept={DOCS.map((d) => `.${d}`).join(',')} onChange={elegirArchivo} className="sr-only" />
            </label>
            {archivo && (
              <span className="archivo-nombre">
                📎 <b>{archivo.name}</b> <span className="texto-suave">({tamano(archivo.size)})</span>
                <button type="button" onClick={() => setArchivo(null)} className="enlace-peligro">Quitar</button>
              </span>
            )}
            {!archivo && actual?.archivo && <span className="texto-suave texto-chico">Actual: <b>{actual.archivo.nombre}</b> ({tamano(actual.archivo.tamano)}). Si no eliges otro, se conserva.</span>}
          </div>
        </Field>

        <Field label={editando ? 'Enlace (https), opcional' : 'Enlace (https, ej. Drive), opcional si subes un archivo'} error={errors.archivo_url} hint={editando ? 'Déjalo vacío para conservar el enlace actual.' : undefined}>
          <Input type="url" placeholder="https://" {...register('archivo_url', { onChange: () => setErrEntrega(null) })} />
        </Field>
      </fieldset>

      <fieldset className="grupo">
        <legend>Imágenes de previsualización</legend>
        <p className="grupo__texto">Es lo único que verá el comprador antes de pagar: elige 1 o 2 imágenes JPG, PNG o WEBP (máximo {MAX_IMG_MB} MB cada una).</p>
        <Field label="Imágenes" error={errPreviews}>
          <div className="miniaturas">
            {previews.length < MAX_PREVIEWS && (
              <label className={boton}>
                Agregar imagen
                <input type="file" accept={IMGS.join(',')} multiple onChange={elegirImagenes} className="sr-only" />
              </label>
            )}
            {miniaturas.map((u, k) => (
              <figure key={u} className="miniatura">
                <img src={u} alt={`Previsualización ${k + 1}`} />
                <button type="button" onClick={() => setPreviews((p) => p.filter((_, j) => j !== k))} aria-label={`Quitar la imagen ${k + 1}`} className="miniatura__quitar">×</button>
              </figure>
            ))}
          </div>
          {editando && actual?.previews?.length > 0 && previews.length === 0 && (
            <p className="campo__ayuda">Ya tiene {actual.previews.length} {actual.previews.length === 1 ? 'imagen' : 'imágenes'}. Si agregas nuevas, reemplazan a las actuales.</p>
          )}
        </Field>
      </fieldset>

      {error && <Message message={error} />}
      <Button className="btn--separado" disabled={isSubmitting}>{isSubmitting ? 'Subiendo…' : editando ? 'Guardar cambios' : 'Publicar'}</Button>
    </form>
  );
}
