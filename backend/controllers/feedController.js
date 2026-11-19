import Material from '../models/Material.js';
import Compra from '../models/Compra.js';
import { asyncHandler, httpError } from '../middlewares/errorHandler.js';
import { TIPOS_MATERIAL } from '../validators/index.js';
import { borrar, guardar, rutaDe } from '../libs/archivos.js';
import { registrarProfesorSiNoExiste } from './profesorController.js';

const escaparRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Búsqueda sin distinguir tildes: "calculo" encuentra "Cálculo" y "calculó".
const CLASES = { a: 'aáàäâ', e: 'eéèëê', i: 'iíìïî', o: 'oóòöô', u: 'uúùüû', n: 'nñ' };
const regexSinTildes = (texto) => {
  const base = texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const patron = escaparRegex(base).replace(/[aeioun]/g, (c) => {
    const v = CLASES[c];
    return `[${v}${v.toUpperCase()}]`;
  });
  return new RegExp(patron, 'i');
};

const ORDENES = {
  recientes: { createdAt: -1 },
  precio_asc: { precio: 1, createdAt: -1 },
  precio_desc: { precio: -1, createdAt: -1 }
};

// Guarda en disco lo que llegó validado (documento + previsualizaciones) y devuelve los datos para el modelo.
const guardarSubidas = async ({ documento, previews = [] } = {}) => {
  const creados = { archivo: [], previews: [] };
  try {
    const datos = {};
    if (documento) {
      const nombre = await guardar('archivos', documento.buffer, documento.ext);
      creados.archivo.push(nombre);
      datos.archivo = { nombre_original: documento.nombre, nombre_guardado: nombre, mime: documento.mime, tamano: documento.tamano };
    }
    if (previews.length) {
      datos.previews = [];
      for (const p of previews) {
        const nombre = await guardar('previews', p.buffer, p.ext);
        creados.previews.push(nombre);
        datos.previews.push(nombre);
      }
    }
    return { datos, creados };
  } catch (err) {
    await Promise.all([...creados.archivo.map((n) => borrar('archivos', n)), ...creados.previews.map((n) => borrar('previews', n))]);
    throw err;
  }
};
const descartar = (c) => Promise.all([...c.archivo.map((n) => borrar('archivos', n)), ...c.previews.map((n) => borrar('previews', n))]);

// Crear una nueva publicación de material académico (JSON con enlace, o multipart con archivo + previsualizaciones)
export const publicarMaterial = asyncHandler(async (req, res) => {
  const subidas = req.archivosSubidos || { previews: [] };
  if (!req.body.archivo_url && !subidas.documento) {
    throw httpError(400, 'Sube un archivo o pega un enlace del material');
  }

  const { datos, creados } = await guardarSubidas(subidas);
  let nuevoMaterial;
  try {
    nuevoMaterial = await Material.create({ ...req.body, ...datos, autor: req.usuario.id });
  } catch (err) {
    await descartar(creados);
    throw err;
  }
  // El estudiante puede escribir un profesor nuevo: queda registrado para los demás.
  await registrarProfesorSiNoExiste(nuevoMaterial.profesor, nuevoMaterial.materia, req.usuario.id);

  res.status(201).json({
    exito: true,
    mensaje: 'Material publicado con éxito en el feed',
    material: nuevoMaterial
  });
});

// Lista pública del feed. NO incluye archivo_url (solo se entrega a quien tiene acceso).
export const obtenerFeed = asyncHandler(async (req, res) => {
  const { materia, tipo, q, orden } = req.query;
  const filtro = {};

  // q: cada palabra debe aparecer en el título, la materia o el profesor.
  if (q !== undefined) {
    if (typeof q !== 'string') throw httpError(400, 'El parámetro "q" no es válido');
    const palabras = q.trim().split(/\s+/).filter(Boolean).slice(0, 5);
    if (palabras.length) {
      filtro.$and = palabras.map((p) => {
        const re = regexSinTildes(p.slice(0, 40));
        return { $or: [{ titulo: re }, { materia: re }, { profesor: re }] };
      });
    }
  }
  if (orden !== undefined && (typeof orden !== 'string' || !ORDENES[orden])) {
    throw httpError(400, 'El parámetro "orden" no es válido');
  }

  if (materia !== undefined) {
    if (typeof materia !== 'string') throw httpError(400, 'El filtro "materia" no es válido');
    filtro.materia = new RegExp(escaparRegex(materia.slice(0, 80)), 'i');
  }
  if (tipo !== undefined) {
    if (typeof tipo !== 'string' || !TIPOS_MATERIAL.includes(tipo)) {
      throw httpError(400, 'El filtro "tipo" no es válido');
    }
    filtro.tipo = tipo;
  }

  const pagina = Math.max(parseInt(req.query.pagina, 10) || 1, 1);
  const limite = Math.min(Math.max(parseInt(req.query.limite, 10) || 20, 1), 50);

  const [materiales, total] = await Promise.all([
    Material.find(filtro)
      .select('-archivo_url')
      .populate('autor', 'alias avatar nivel_reputacion')
      .sort(ORDENES[orden] || ORDENES.recientes)
      .skip((pagina - 1) * limite)
      .limit(limite),
    Material.countDocuments(filtro)
  ]);

  res.status(200).json({ exito: true, total, pagina, limite, materiales });
});

export const obtenerMaterial = asyncHandler(async (req, res) => {
  const material = await Material.findById(req.params.id)
    .select('-archivo_url')
    .populate('autor', 'alias avatar nivel_reputacion');
  if (!material) throw httpError(404, 'Material no encontrado');

  res.status(200).json({ exito: true, material });
});

// Solo el autor puede editar su material.
export const actualizarMaterial = asyncHandler(async (req, res) => {
  const material = await Material.findById(req.params.id);
  if (!material) throw httpError(404, 'Material no encontrado');
  if (String(material.autor) !== req.usuario.id) {
    throw httpError(403, 'No puedes modificar material de otro usuario');
  }

  // Si llegan archivos nuevos, reemplazan a los anteriores (que se borran del disco solo si todo salió bien).
  const subidas = req.archivosSubidos || { previews: [] };
  const { datos, creados } = await guardarSubidas(subidas);
  const viejoArchivo = datos.archivo ? material.archivo?.nombre_guardado : null;
  const viejosPreviews = datos.previews ? [...material.previews] : [];

  try {
    material.set({ ...req.body, ...datos });
    await material.save();
  } catch (err) {
    await descartar(creados);
    throw err;
  }
  if (req.body.profesor) await registrarProfesorSiNoExiste(material.profesor, material.materia, req.usuario.id);
  await borrar('archivos', viejoArchivo);
  await Promise.all(viejosPreviews.map((n) => borrar('previews', n)));

  res.status(200).json({ exito: true, mensaje: 'Material actualizado', material });
});

// Solo el autor puede eliminar su material.
export const eliminarMaterial = asyncHandler(async (req, res) => {
  const material = await Material.findById(req.params.id);
  if (!material) throw httpError(404, 'Material no encontrado');
  if (String(material.autor) !== req.usuario.id) {
    throw httpError(403, 'No puedes eliminar material de otro usuario');
  }

  await material.deleteOne();
  await borrar('archivos', material.archivo?.nombre_guardado);
  await Promise.all(material.previews.map((n) => borrar('previews', n)));
  res.status(200).json({ exito: true, mensaje: 'Material eliminado' });
});

const tieneAcceso = async (material, usuarioId) =>
  material.precio === 0 ||
  String(material.autor) === usuarioId ||
  Boolean(await Compra.exists({ usuario: usuarioId, material: material._id }));

// Informa CÓMO obtener el material, solo si es gratis, es del autor, o ya fue comprado:
// el enlace (si lo hay) y/o los datos del archivo subido (se baja por /:id/descargar).
export const obtenerArchivo = asyncHandler(async (req, res) => {
  const material = await Material.findById(req.params.id);
  if (!material) throw httpError(404, 'Material no encontrado');
  if (!(await tieneAcceso(material, req.usuario.id))) {
    throw httpError(403, 'Debes comprar este material para acceder al archivo');
  }

  const respuesta = { exito: true };
  if (material.archivo_url) respuesta.archivo_url = material.archivo_url;
  if (material.archivo?.nombre_guardado) {
    respuesta.archivo = { nombre: material.archivo.nombre_original, mime: material.archivo.mime, tamano: material.archivo.tamano };
  }
  res.status(200).json(respuesta);
});

// Descarga del archivo subido (misma regla de acceso). Nunca se sirve como carpeta estática.
export const descargarArchivo = asyncHandler(async (req, res) => {
  const material = await Material.findById(req.params.id);
  if (!material) throw httpError(404, 'Material no encontrado');
  if (!(await tieneAcceso(material, req.usuario.id))) {
    throw httpError(403, 'Debes comprar este material para descargar el archivo');
  }
  if (!material.archivo?.nombre_guardado) throw httpError(404, 'Este material no tiene un archivo subido');

  res.download(rutaDe('archivos', material.archivo.nombre_guardado), material.archivo.nombre_original, (err) => {
    if (err && !res.headersSent) res.status(404).json({ exito: false, mensaje: 'El archivo ya no está disponible' });
  });
});

// Imagen de previsualización (pública a propósito: es lo único que se ve antes de comprar).
export const obtenerPreview = asyncHandler(async (req, res) => {
  const material = await Material.findById(req.params.id).select('previews');
  const nombre = material?.previews?.[Number(req.params.n)];
  if (!nombre || !/^\d$/.test(req.params.n)) throw httpError(404, 'Imagen no encontrada');

  // Helmet pone same-origin por defecto; las imágenes las carga el frontend desde otro puerto/origen.
  res.set('Cross-Origin-Resource-Policy', 'cross-origin');
  res.set('Cache-Control', 'public, max-age=3600');
  res.sendFile(rutaDe('previews', nombre), { dotfiles: 'deny' }, (err) => {
    if (err && !res.headersSent) res.status(404).json({ exito: false, mensaje: 'Imagen no encontrada' });
  });
});

// Materiales publicados por el usuario (sin el enlace del archivo).
export const misMateriales = asyncHandler(async (req, res) => {
  const materiales = await Material.find({ autor: req.usuario.id }).select('-archivo_url').sort({ createdAt: -1 });
  res.status(200).json({ exito: true, materiales });
});
