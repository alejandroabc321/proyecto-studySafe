import User from '../models/User.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { asyncHandler, httpError } from '../middlewares/errorHandler.js';

export const registrarUsuario = asyncHandler(async (req, res) => {
  // req.body ya viene validado y limpio (validarRegistro). El rol NUNCA se acepta del cliente.
  const { alias, email_institucional, nombre_real, documento_identidad, password } = req.body;

  const existente = await User.findOne({
    $or: [{ email_institucional }, { alias }, { documento_identidad }]
  }).select('_id').lean();

  if (existente) throw httpError(409, 'El correo, alias o documento ya se encuentra registrado');

  const passwordHash = await bcrypt.hash(password, 10);

  const usuario = await User.create({
    alias,
    email_institucional,
    nombre_real,
    documento_identidad,
    password: passwordHash
  });

  res.status(201).json({
    exito: true,
    mensaje: 'Usuario registrado con éxito',
    usuario: { id: usuario._id, alias: usuario.alias, email: usuario.email_institucional }
  });
});

export const iniciarSesion = asyncHandler(async (req, res) => {
  const { email_institucional, password } = req.body;

  const usuario = await User.findOne({ email_institucional }).select('+password');
  const passwordValido = usuario ? await bcrypt.compare(password, usuario.password) : false;

  if (!usuario || !passwordValido) throw httpError(401, 'Credenciales inválidas');
  if (!usuario.activo) throw httpError(403, 'Tu cuenta está desactivada');

  const token = jwt.sign(
    { id: usuario._id, alias: usuario.alias, email: usuario.email_institucional },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );

  res.status(200).json({
    exito: true,
    token,
    usuario: {
      id: usuario._id,
      alias: usuario.alias,
      email: usuario.email_institucional,
      billetera: usuario.billetera
    }
  });
});
