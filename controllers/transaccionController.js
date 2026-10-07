import Transaccion from '../models/Transaccion.js';
import Material from '../models/Material.js';
import Compra from '../models/Compra.js';
import User from '../models/User.js';
import { asyncHandler, httpError } from '../middlewares/errorHandler.js';

export const obtenerHistorial = asyncHandler(async (req, res) => {
  const transacciones = await Transaccion.find({ usuario: req.usuario.id })
    .sort({ createdAt: -1 })
    .limit(100);

  res.status(200).json({ exito: true, total: transacciones.length, transacciones });
});

// Recarga de saldo SOLO PARA DESARROLLO/PRUEBAS. En producción debe reemplazarse por
// la confirmación (webhook) de una pasarela de pagos; el cliente nunca decide su saldo.
export const recargarSaldo = asyncHandler(async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    throw httpError(403, 'Las recargas directas están deshabilitadas en producción');
  }

  const { monto, descripcion } = req.body;

  const usuario = await User.findOneAndUpdate(
    { _id: req.usuario.id, activo: true },
    { $inc: { 'billetera.saldo': monto } },
    { new: true }
  );
  if (!usuario) throw httpError(404, 'Usuario no encontrado');

  const transaccion = await Transaccion.create({ usuario: usuario._id, tipo: 'recarga', monto, descripcion });

  res.status(201).json({ exito: true, saldo: usuario.billetera.saldo, transaccion });
});

// Compra de un material. El débito es atómico: solo se descuenta si el saldo alcanza.
export const comprarMaterial = asyncHandler(async (req, res) => {
  const compradorId = req.usuario.id;

  const material = await Material.findById(req.params.materialId);
  if (!material) throw httpError(404, 'Material no encontrado');
  if (String(material.autor) === compradorId) throw httpError(400, 'No puedes comprar tu propio material');
  if (material.precio === 0) throw httpError(400, 'Este material es gratuito, no requiere compra');
  if (await Compra.exists({ usuario: compradorId, material: material._id })) {
    throw httpError(409, 'Ya compraste este material');
  }

  const precio = material.precio;

  // 1) Débito atómico (la condición $gte evita saldos negativos aunque haya compras simultáneas)
  const comprador = await User.findOneAndUpdate(
    { _id: compradorId, 'billetera.saldo': { $gte: precio } },
    { $inc: { 'billetera.saldo': -precio } },
    { new: true }
  );
  if (!comprador) throw httpError(402, 'Saldo insuficiente');

  // 2) Registrar la compra; si falla (p. ej. duplicado simultáneo) se devuelve el dinero
  try {
    await Compra.create({ usuario: compradorId, material: material._id, precio });
  } catch (err) {
    await User.updateOne({ _id: compradorId }, { $inc: { 'billetera.saldo': precio } });
    throw err;
  }

  // 3) Pagar al autor, dejar el historial y contar la descarga
  await User.updateOne({ _id: material.autor }, { $inc: { 'billetera.saldo': precio } });
  await Transaccion.create([
    { usuario: compradorId, tipo: 'compra', monto: -precio, descripcion: `Compra: ${material.titulo}` },
    { usuario: material.autor, tipo: 'recompensa', monto: precio, descripcion: `Venta: ${material.titulo}` }
  ]);
  await Material.updateOne({ _id: material._id }, { $inc: { descargas: 1 } });

  res.status(201).json({
    exito: true,
    mensaje: 'Compra realizada con éxito',
    saldo: comprador.billetera.saldo,
    archivo_url: material.archivo_url
  });
});
