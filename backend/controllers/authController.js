import User from '../models/User.js';
import Session from '../models/Session.js';
import bcrypt from 'bcryptjs';
import { asyncHandler, httpError } from '../middlewares/errorHandler.js';
import {
  COOKIE_REFRESH, ttl, hashToken, nuevaFamilia, firmarAccess, firmarRefresh, verificarRefresh,
  ponerCookieRefresh, borrarCookieRefresh
} from '../libs/tokens.js';

const MAX_SESIONES_POR_USUARIO = 5; // por ejemplo: PC, celular, otro navegador...

// Datos que el frontend puede ver del usuario (nunca password ni datos KYC).
const datosPublicos = (u) => ({
  id: u._id,
  alias: u.alias,
  email: u.email_institucional,
  rol: u.rol,
  avatar: u.avatar,
  billetera: u.billetera
});

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

  // Nueva sesión: refresh token en cookie HttpOnly (y su hash en MongoDB) + access token en el cuerpo.
  const { refreshMs } = ttl();
  const familia = nuevaFamilia();
  const refreshToken = firmarRefresh({ usuarioId: usuario._id, familia, expiraEnSeg: Math.floor(refreshMs / 1000) });

  await Session.create({
    usuario: usuario._id,
    familia,
    tokenHash: hashToken(refreshToken),
    userAgent: (req.get('user-agent') || '').slice(0, 200),
    expiraEn: new Date(Date.now() + refreshMs)
  });

  // Conserva solo las últimas sesiones del usuario.
  const sobrantes = await Session.find({ usuario: usuario._id }).sort({ createdAt: -1 }).skip(MAX_SESIONES_POR_USUARIO).select('_id');
  if (sobrantes.length) await Session.deleteMany({ _id: { $in: sobrantes.map((s) => s._id) } });

  ponerCookieRefresh(res, refreshToken, refreshMs);
  res.status(200).json({ exito: true, accessToken: firmarAccess(usuario), usuario: datosPublicos(usuario) });
});

// Renueva el access token usando el refresh token de la cookie y ROTA el refresh token.
// Si alguien reutiliza un refresh token ya rotado, se asume robo y se revoca la sesión completa.
export const refrescarToken = asyncHandler(async (req, res) => {
  const token = req.cookies?.[COOKIE_REFRESH];
  if (!token) throw httpError(401, 'No hay sesión iniciada');

  const rechazar = (codigo, mensaje) => { borrarCookieRefresh(res); throw httpError(codigo, mensaje); };

  let payload;
  try { payload = verificarRefresh(token); } catch { rechazar(401, 'La sesión expiró. Inicia sesión de nuevo'); }

  let sesion = await Session.findOne({ familia: payload.sid, usuario: payload.sub });
  if (!sesion) rechazar(401, 'La sesión ya no es válida. Inicia sesión de nuevo');

  const { refreshMs, sesionMaxMs, graciaMs } = ttl();

  // Tope absoluto: aunque la use todos los días, una sesión no dura más de SESION_MAX_DIAS.
  const limite = sesion.createdAt.getTime() + sesionMaxMs;
  if (Date.now() >= limite) {
    await sesion.deleteOne();
    rechazar(401, 'La sesión expiró. Inicia sesión de nuevo');
  }

  // Un usuario desactivado pierde todas sus sesiones al intentar renovar.
  const usuario = await User.findById(payload.sub);
  if (!usuario || !usuario.activo) {
    await Session.deleteMany({ usuario: payload.sub });
    rechazar(403, 'Tu cuenta está desactivada');
  }

  const responder = () =>
    res.status(200).json({ exito: true, accessToken: firmarAccess(usuario), usuario: datosPublicos(usuario) });

  const hash = hashToken(token);

  if (hash === sesion.tokenHash) {
    // Rotación: se emite un refresh token nuevo y el actual pasa a ser "el anterior".
    const expiraMs = Math.min(Date.now() + refreshMs, limite);
    const nuevo = firmarRefresh({ usuarioId: usuario._id, familia: sesion.familia, expiraEnSeg: Math.floor((expiraMs - Date.now()) / 1000) });
    const rotada = await Session.findOneAndUpdate(
      { _id: sesion._id, tokenHash: hash }, // condición atómica: solo una petición puede rotar este token
      { $set: { tokenHash: hashToken(nuevo), tokenHashAnterior: hash, rotadoEn: new Date(), expiraEn: new Date(expiraMs) } }
    );
    if (rotada) {
      ponerCookieRefresh(res, nuevo, expiraMs - Date.now());
      return responder();
    }
    // Otra petición rotó primero: se vuelve a leer la sesión y se evalúa como token ya usado.
    sesion = await Session.findById(sesion._id);
    if (!sesion) rechazar(401, 'La sesión ya no es válida. Inicia sesión de nuevo');
  }

  // Token ya usado. Dentro de la tolerancia es una petición paralela legítima: se entrega un access
  // token pero NO se rota otra vez (el navegador ya recibió la cookie nueva en la primera respuesta).
  const reciente = sesion.rotadoEn && Date.now() - sesion.rotadoEn.getTime() <= graciaMs;
  if (hash === sesion.tokenHashAnterior && reciente) return responder();

  // Reutilización fuera de la tolerancia o token desconocido: posible robo -> se revoca toda la sesión.
  await sesion.deleteOne();
  rechazar(401, 'Sesión inválida. Inicia sesión de nuevo');
});

// Logout real: borra la sesión en MongoDB y la cookie del navegador. Siempre responde 200.
export const cerrarSesion = asyncHandler(async (req, res) => {
  const token = req.cookies?.[COOKIE_REFRESH];
  if (token) {
    try {
      const payload = verificarRefresh(token, { ignoreExpiration: true });
      await Session.deleteOne({ familia: payload.sid, usuario: payload.sub });
    } catch { /* token inválido: no hay nada que revocar */ }
  }
  borrarCookieRefresh(res);
  res.status(200).json({ exito: true, mensaje: 'Sesión cerrada' });
});

// Datos del usuario autenticado (el frontend lo usa para refrescar el saldo).
export const perfil = asyncHandler(async (req, res) => {
  const u = await User.findById(req.usuario.id);
  if (!u) throw httpError(404, 'Usuario no encontrado');
  res.status(200).json({ exito: true, usuario: datosPublicos(u) });
});
