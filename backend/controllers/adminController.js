import User from '../models/User.js';
import Session from '../models/Session.js';
import Material from '../models/Material.js';
import Compra from '../models/Compra.js';
import Transaccion from '../models/Transaccion.js';
import Profesor from '../models/Profesor.js';
import SolicitudRecarga from '../models/SolicitudRecarga.js';
import { asyncHandler, httpError } from '../middlewares/errorHandler.js';
import { borrar } from '../libs/archivos.js';

const escaparRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Lista de usuarios con búsqueda por alias o correo.
export const listarUsuarios = asyncHandler(async (req, res) => {
  const { q, rol } = req.query;
  const filtro = {};

  if (q !== undefined) {
    if (typeof q !== 'string') throw httpError(400, 'El parámetro "q" no es válido');
    const t = q.trim().slice(0, 60);
    if (t) {
      const re = new RegExp(escaparRegex(t), 'i');
      filtro.$or = [{ alias: re }, { email_institucional: re }];
    }
  }
  if (rol !== undefined) {
    if (!['estudiante', 'admin'].includes(rol)) throw httpError(400, 'El filtro "rol" no es válido');
    filtro.rol = rol;
  }

  const pagina = Math.max(parseInt(req.query.pagina, 10) || 1, 1);
  const limite = Math.min(Math.max(parseInt(req.query.limite, 10) || 20, 1), 50);

  const [usuarios, total] = await Promise.all([
    User.find(filtro)
      .select('alias email_institucional rol activo billetera createdAt')
      .sort({ createdAt: -1 })
      .skip((pagina - 1) * limite)
      .limit(limite),
    User.countDocuments(filtro)
  ]);

  res.status(200).json({ exito: true, total, pagina, limite, usuarios });
});

// Todo lo que el administrador necesita para supervisar a un usuario.
export const detalleUsuario = asyncHandler(async (req, res) => {
  const usuario = await User.findById(req.params.id)
    .select('alias email_institucional rol activo billetera createdAt +nombre_real');
  if (!usuario) throw httpError(404, 'Usuario no encontrado');

  const [compras, publicaciones, movimientos] = await Promise.all([
    Compra.find({ usuario: usuario._id }).populate('material', 'titulo materia tipo').sort({ createdAt: -1 }).limit(100),
    Material.find({ autor: usuario._id }).select('-archivo_url').sort({ createdAt: -1 }).limit(100),
    Transaccion.find({ usuario: usuario._id }).populate('realizadaPor', 'alias').sort({ createdAt: -1 }).limit(100)
  ]);

  res.status(200).json({ exito: true, usuario, compras, publicaciones, movimientos });
});

// Activar / desactivar una cuenta. Al desactivar se cierran todas sus sesiones.
export const cambiarEstado = asyncHandler(async (req, res) => {
  if (req.params.id === req.usuario.id) throw httpError(400, 'No puedes desactivar tu propia cuenta');

  const objetivo = await User.findById(req.params.id).select('rol activo alias');
  if (!objetivo) throw httpError(404, 'Usuario no encontrado');
  if (objetivo.rol === 'admin') throw httpError(403, 'No se puede desactivar a otro administrador');

  objetivo.activo = req.body.activo;
  await objetivo.save();
  if (!objetivo.activo) await Session.deleteMany({ usuario: objetivo._id });

  res.status(200).json({
    exito: true,
    mensaje: objetivo.activo ? 'Cuenta activada' : 'Cuenta desactivada y sesiones cerradas',
    usuario: { _id: objetivo._id, alias: objetivo.alias, activo: objetivo.activo }
  });
});

// Suma el saldo y deja el movimiento registrado con el admin responsable.
// Si no se puede registrar, se revierte el saldo (sin registro no hay recarga).
const aplicarRecarga = async ({ usuarioId, monto, descripcion, adminId }) => {
  const usuario = await User.findOneAndUpdate(
    { _id: usuarioId, activo: true },
    { $inc: { 'billetera.saldo': monto } },
    { new: true }
  ).select('alias billetera');
  if (!usuario) throw httpError(404, 'Usuario no encontrado o desactivado');

  let transaccion;
  try {
    transaccion = await Transaccion.create({ usuario: usuario._id, tipo: 'recarga', monto, descripcion, realizadaPor: adminId });
  } catch (err) {
    await User.updateOne({ _id: usuario._id }, { $inc: { 'billetera.saldo': -monto } });
    throw err;
  }
  return { usuario, transaccion };
};

// Recarga de saldo hecha por el administrador (queda registrado quién la hizo).
export const recargarUsuario = asyncHandler(async (req, res) => {
  const { usuario: usuarioId, monto, descripcion } = req.body;
  const { usuario, transaccion } = await aplicarRecarga({ usuarioId, monto, descripcion, adminId: req.usuario.id });

  res.status(201).json({ exito: true, mensaje: `Recarga de ${monto} a ${usuario.alias}`, saldo: usuario.billetera.saldo, transaccion });
});

// Moderación: el administrador puede quitar un profesor mal escrito o duplicado.
// Los materiales ya publicados conservan el nombre que tenían.
export const eliminarProfesor = asyncHandler(async (req, res) => {
  const p = await Profesor.findById(req.params.id);
  if (!p) throw httpError(404, 'Profesor no encontrado');
  await p.deleteOne();
  res.status(200).json({ exito: true, mensaje: 'Profesor eliminado' });
});

const pagina = (req, max = 50) => ({
  pagina: Math.max(parseInt(req.query.pagina, 10) || 1, 1),
  limite: Math.min(Math.max(parseInt(req.query.limite, 10) || 20, 1), max)
});
const suma = (r) => r[0]?.total ?? 0;

// Panel de control: cifras globales de la plataforma y las últimas recargas.
export const resumen = asyncHandler(async (req, res) => {
  const [usuarios, activos, admins, materiales, compras, ventas, saldo, recargado, recientes, solicitudesPendientes] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ activo: true }),
    User.countDocuments({ rol: 'admin' }),
    Material.countDocuments(),
    Compra.countDocuments(),
    Compra.aggregate([{ $group: { _id: null, total: { $sum: '$precio' } } }]),
    User.aggregate([{ $group: { _id: null, total: { $sum: '$billetera.saldo' } } }]),
    Transaccion.aggregate([{ $match: { tipo: 'recarga' } }, { $group: { _id: null, total: { $sum: '$monto' } } }]),
    Transaccion.find({ tipo: 'recarga' }).populate('usuario', 'alias').populate('realizadaPor', 'alias').sort({ createdAt: -1 }).limit(5),
    SolicitudRecarga.countDocuments({ estado: 'pendiente' })
  ]);

  res.status(200).json({
    exito: true,
    resumen: {
      usuarios, activos, inactivos: usuarios - activos, admins,
      materiales, compras,
      dineroVendido: suma(ventas),     // total pagado en compras
      saldoEnCirculacion: suma(saldo), // suma de todas las billeteras
      totalRecargado: suma(recargado),
      solicitudesPendientes
    },
    recientes
  });
});

// Todas las recargas de la plataforma (quién recibió, cuánto y qué administrador la registró).
export const listarRecargas = asyncHandler(async (req, res) => {
  const { pagina: p, limite } = pagina(req);
  const [recargas, total] = await Promise.all([
    Transaccion.find({ tipo: 'recarga' }).populate('usuario', 'alias email_institucional').populate('realizadaPor', 'alias')
      .sort({ createdAt: -1 }).skip((p - 1) * limite).limit(limite),
    Transaccion.countDocuments({ tipo: 'recarga' })
  ]);
  res.status(200).json({ exito: true, total, pagina: p, limite, recargas });
});

// Todos los materiales publicados (para supervisar y moderar).
export const listarMateriales = asyncHandler(async (req, res) => {
  const { q } = req.query;
  const filtro = {};
  if (q !== undefined) {
    if (typeof q !== 'string') throw httpError(400, 'El parámetro "q" no es válido');
    const t = q.trim().slice(0, 60);
    if (t) {
      const re = new RegExp(escaparRegex(t), 'i');
      filtro.$or = [{ titulo: re }, { materia: re }, { profesor: re }];
    }
  }
  const { pagina: p, limite } = pagina(req);
  const [materiales, total] = await Promise.all([
    Material.find(filtro).select('-archivo_url').populate('autor', 'alias').sort({ createdAt: -1 }).skip((p - 1) * limite).limit(limite),
    Material.countDocuments(filtro)
  ]);
  res.status(200).json({ exito: true, total, pagina: p, limite, materiales });
});

// Moderación: el administrador puede retirar cualquier material (se borran también sus archivos).
export const eliminarMaterialAdmin = asyncHandler(async (req, res) => {
  const m = await Material.findById(req.params.id);
  if (!m) throw httpError(404, 'Material no encontrado');
  await m.deleteOne();
  await borrar('archivos', m.archivo?.nombre_guardado);
  await Promise.all((m.previews || []).map((n) => borrar('previews', n)));
  res.status(200).json({ exito: true, mensaje: 'Material eliminado' });
});

// ---------- Solicitudes de recarga ----------

export const listarSolicitudes = asyncHandler(async (req, res) => {
  const { estado } = req.query;
  const filtro = {};
  if (estado !== undefined) {
    if (!['pendiente', 'aprobada', 'rechazada'].includes(estado)) throw httpError(400, 'Estado no válido');
    filtro.estado = estado;
  }
  const { pagina: p, limite } = pagina(req);
  const [solicitudes, total, pendientes] = await Promise.all([
    SolicitudRecarga.find(filtro).sort('-createdAt').skip((p - 1) * limite).limit(limite)
      .populate('usuario', 'alias email_institucional billetera.saldo').populate('resueltaPor', 'alias'),
    SolicitudRecarga.countDocuments(filtro),
    SolicitudRecarga.countDocuments({ estado: 'pendiente' })
  ]);
  res.status(200).json({ exito: true, solicitudes, total, pendientes, pagina: p, limite });
});

// Aprobar = recargar al usuario por el monto pedido. Se "reclama" la solicitud de forma
// atómica primero para que dos clics (o dos admins) no la apliquen dos veces.
export const aprobarSolicitud = asyncHandler(async (req, res) => {
  const sol = await SolicitudRecarga.findOneAndUpdate(
    { _id: req.params.id, estado: 'pendiente' },
    { estado: 'aprobada', resueltaPor: req.usuario.id, resueltaEn: new Date() },
    { new: true }
  );
  if (!sol) throw httpError(409, 'La solicitud no existe o ya fue resuelta');
  try {
    const { usuario } = await aplicarRecarga({
      usuarioId: sol.usuario, monto: sol.monto, adminId: req.usuario.id,
      descripcion: 'Recarga solicitada y aprobada por el administrador'
    });
    res.status(200).json({ exito: true, mensaje: `Recarga de ${sol.monto} aprobada para ${usuario.alias}`, saldo: usuario.billetera.saldo });
  } catch (err) {
    await SolicitudRecarga.updateOne({ _id: sol._id }, { estado: 'pendiente', $unset: { resueltaPor: 1, resueltaEn: 1 } });
    throw err;
  }
});

export const rechazarSolicitud = asyncHandler(async (req, res) => {
  const sol = await SolicitudRecarga.findOneAndUpdate(
    { _id: req.params.id, estado: 'pendiente' },
    { estado: 'rechazada', resueltaPor: req.usuario.id, resueltaEn: new Date() },
    { new: true }
  );
  if (!sol) throw httpError(409, 'La solicitud no existe o ya fue resuelta');
  res.status(200).json({ exito: true, mensaje: 'Solicitud rechazada' });
});
