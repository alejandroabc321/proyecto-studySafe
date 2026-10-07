import Material from '../models/Material.js';
import Compra from '../models/Compra.js';
import { asyncHandler, httpError } from '../middlewares/errorHandler.js';
import { TIPOS_MATERIAL } from '../validators/index.js';

const escaparRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Crear una nueva publicación de material académico
export const publicarMaterial = asyncHandler(async (req, res) => {
  const nuevoMaterial = await Material.create({ ...req.body, autor: req.usuario.id });

  res.status(201).json({
    exito: true,
    mensaje: 'Material publicado con éxito en el feed',
    material: nuevoMaterial
  });
});

// Lista pública del feed. NO incluye archivo_url (solo se entrega a quien tiene acceso).
export const obtenerFeed = asyncHandler(async (req, res) => {
  const { materia, tipo } = req.query;
  const filtro = {};

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
      .sort({ createdAt: -1 })
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

  material.set(req.body);
  await material.save();

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
  res.status(200).json({ exito: true, mensaje: 'Material eliminado' });
});

// Entrega el enlace del archivo solo si es gratis, es del autor, o ya fue comprado.
export const obtenerArchivo = asyncHandler(async (req, res) => {
  const material = await Material.findById(req.params.id);
  if (!material) throw httpError(404, 'Material no encontrado');

  const tieneAcceso =
    material.precio === 0 ||
    String(material.autor) === req.usuario.id ||
    Boolean(await Compra.exists({ usuario: req.usuario.id, material: material._id }));

  if (!tieneAcceso) throw httpError(403, 'Debes comprar este material para acceder al archivo');

  res.status(200).json({ exito: true, archivo_url: material.archivo_url });
});
