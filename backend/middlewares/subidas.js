import multer from 'multer';
import { MAX_PREVIEWS, detectarDocumento, detectarImagen, limites, limpiarNombre } from '../libs/archivos.js';

// Los archivos se reciben en memoria, se VALIDAN y solo entonces se escriben en disco
// (así un archivo inválido nunca deja basura en el servidor).
const subir = () => {
  const { archivoBytes, previewBytes } = limites();
  return multer({
    storage: multer.memoryStorage(),
    defParamCharset: 'utf8', // los navegadores envían los nombres en UTF-8 (sin esto, "guía.pdf" llegaría como "guÃ­a.pdf")
    limits: { fileSize: Math.max(archivoBytes, previewBytes), files: 1 + MAX_PREVIEWS, fields: 20, fieldSize: 10 * 1024 }
  }).fields([{ name: 'archivo', maxCount: 1 }, { name: 'previews', maxCount: MAX_PREVIEWS }]);
};

const ERRORES_MULTER = {
  LIMIT_FILE_SIZE: [413, 'Un archivo supera el tamaño permitido'],
  LIMIT_FILE_COUNT: [400, `Máximo 1 documento y ${MAX_PREVIEWS} imágenes de previsualización`],
  LIMIT_UNEXPECTED_FILE: [400, `Máximo 1 documento y ${MAX_PREVIEWS} imágenes de previsualización`],
  LIMIT_FIELD_VALUE: [400, 'Uno de los campos es demasiado largo'],
  LIMIT_FIELD_COUNT: [400, 'Demasiados campos en el formulario']
};

const rechazar = (res, status, mensaje) => res.status(status).json({ exito: false, mensaje });

// Procesa multipart/form-data (si la petición es JSON simplemente la deja pasar).
// Deja en req.archivosSubidos = { documento?: {buffer, ext, mime, nombre, tamano}, previews: [{buffer, ext}] }
export const recibirMaterial = (req, res, next) => {
  if (!req.is('multipart/form-data')) {
    req.archivosSubidos = { previews: [] };
    return next();
  }

  subir()(req, res, (err) => {
    if (err) {
      const [status, mensaje] = ERRORES_MULTER[err.code] || [400, 'No se pudo procesar el formulario'];
      return rechazar(res, status, mensaje);
    }

    const { archivoBytes, previewBytes } = limites();
    const subidos = { previews: [] };

    const doc = req.files?.archivo?.[0];
    if (doc) {
      if (doc.size > archivoBytes) return rechazar(res, 413, `El documento supera ${archivoBytes / 1024 / 1024} MB`);
      const tipo = detectarDocumento(doc.buffer, doc.originalname);
      if (!tipo) return rechazar(res, 400, 'Documento no permitido. Usa PDF, Word, PowerPoint, Excel o ZIP');
      subidos.documento = { buffer: doc.buffer, ...tipo, nombre: limpiarNombre(doc.originalname), tamano: doc.size };
    }

    for (const img of req.files?.previews || []) {
      if (img.size > previewBytes) return rechazar(res, 413, `Cada imagen debe pesar menos de ${previewBytes / 1024 / 1024} MB`);
      const tipo = detectarImagen(img.buffer);
      if (!tipo) return rechazar(res, 400, 'Las previsualizaciones deben ser imágenes JPG, PNG o WEBP');
      subidos.previews.push({ buffer: img.buffer, ...tipo });
    }

    // En multipart todo llega como texto: el precio se convierte a número y el enlace vacío se ignora.
    const b = { ...req.body };
    if (typeof b.precio === 'string' && b.precio.trim() !== '') b.precio = Number(b.precio);
    if (b.archivo_url === '') delete b.archivo_url;
    delete b.archivo; delete b.previews;
    req.body = b;

    req.archivosSubidos = subidos;
    next();
  });
};
