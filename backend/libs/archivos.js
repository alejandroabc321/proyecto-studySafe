// Manejo seguro de archivos subidos (almacenamiento local en disco, NO en la base de datos).
//  - El nombre en disco lo genera el servidor (uuid): el nombre que envía el usuario nunca toca el sistema de archivos.
//  - El tipo se decide por los primeros bytes del archivo (firma), no por la extensión ni por el Content-Type que declara el cliente.
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';

export const CARPETAS = { archivos: 'archivos', previews: 'previews' };

export const limites = () => ({
  archivoBytes: (Number(process.env.ARCHIVO_MAX_MB) || 20) * 1024 * 1024,
  previewBytes: (Number(process.env.PREVIEW_MAX_MB) || 3) * 1024 * 1024
});

export const MAX_PREVIEWS = 2;

export const raizUploads = () => path.resolve(process.env.UPLOADS_DIR || path.join(process.cwd(), 'uploads'));

const empieza = (buf, bytes, offset = 0) => bytes.every((b, i) => buf[offset + i] === b);

const OLE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]; // .doc .ppt .xls antiguos
const ZIP = [0x50, 0x4b, 0x03, 0x04];                          // .docx .pptx .xlsx .zip (son ZIP)

const DOCUMENTOS = {
  pdf: { mime: 'application/pdf', ok: (b) => empieza(b, [0x25, 0x50, 0x44, 0x46]) },
  doc: { mime: 'application/msword', ok: (b) => empieza(b, OLE) },
  ppt: { mime: 'application/vnd.ms-powerpoint', ok: (b) => empieza(b, OLE) },
  xls: { mime: 'application/vnd.ms-excel', ok: (b) => empieza(b, OLE) },
  docx: { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', ok: (b) => empieza(b, ZIP) },
  pptx: { mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', ok: (b) => empieza(b, ZIP) },
  xlsx: { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ok: (b) => empieza(b, ZIP) },
  zip: { mime: 'application/zip', ok: (b) => empieza(b, ZIP) }
};
export const EXTENSIONES_DOC = Object.keys(DOCUMENTOS);

const esWebp = (b) => empieza(b, [0x52, 0x49, 0x46, 0x46]) && empieza(b, [0x57, 0x45, 0x42, 0x50], 8);
const IMAGENES = [
  { ext: 'jpg', mime: 'image/jpeg', ok: (b) => empieza(b, [0xff, 0xd8, 0xff]) },
  { ext: 'png', mime: 'image/png', ok: (b) => empieza(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) },
  { ext: 'webp', mime: 'image/webp', ok: esWebp }
];

// Devuelve { ext, mime } o null si el contenido no coincide con lo permitido.
export const detectarDocumento = (buffer, nombreOriginal = '') => {
  const ext = path.extname(nombreOriginal).slice(1).toLowerCase();
  const def = DOCUMENTOS[ext];
  if (!def || buffer.length < 8 || !def.ok(buffer)) return null;
  return { ext, mime: def.mime };
};

export const detectarImagen = (buffer) => {
  if (buffer.length < 12) return null;
  const t = IMAGENES.find((i) => i.ok(buffer));
  return t ? { ext: t.ext, mime: t.mime } : null;
};

// Nombre original "limpio" solo para mostrarlo y para el nombre de la descarga.
export const limpiarNombre = (nombre = 'archivo') => {
  const base = path.basename(String(nombre)).replace(/[^\w.\- áéíóúñÁÉÍÓÚÑ()]/g, '_').trim();
  return (base || 'archivo').slice(0, 120);
};

export const guardar = async (carpeta, buffer, ext) => {
  const dir = path.join(raizUploads(), CARPETAS[carpeta]);
  await mkdir(dir, { recursive: true });
  const nombre = `${randomUUID()}.${ext}`;
  await writeFile(path.join(dir, nombre), buffer, { flag: 'wx' });
  return nombre;
};

// Ruta absoluta de un archivo ya guardado; nunca sale de la carpeta de uploads.
export const rutaDe = (carpeta, nombre) => path.join(raizUploads(), CARPETAS[carpeta], path.basename(String(nombre)));

export const borrar = async (carpeta, nombre) => {
  if (!nombre) return;
  try { await unlink(rutaDe(carpeta, nombre)); } catch { /* ya no existía */ }
};
