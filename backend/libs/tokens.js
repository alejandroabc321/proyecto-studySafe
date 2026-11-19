// Utilidades de tokens (esquema híbrido: access token corto + refresh token rotativo).
//  - Access token : JWT de vida corta (15 min). El frontend lo guarda SOLO en memoria.
//  - Refresh token: JWT de vida larga en cookie HttpOnly. Su hash se guarda en MongoDB (modelo Session),
//                   lo que permite revocarlo (logout real) y detectar si alguien lo reutiliza.
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';

export const COOKIE_REFRESH = 'refreshToken';
const RUTA_COOKIE = '/api/auth'; // la cookie solo viaja a las rutas de autenticación

// Se leen en cada llamada (no al importar) para poder cambiarlos en las pruebas.
export const ttl = () => ({
  accessSeg: Number(process.env.ACCESS_TTL_SEG) || 15 * 60,
  refreshMs: (Number(process.env.REFRESH_TTL_DIAS) || 7) * 24 * 60 * 60 * 1000,
  sesionMaxMs: (Number(process.env.SESION_MAX_DIAS) || 30) * 24 * 60 * 60 * 1000,
  // Tolerancia para dos peticiones /refresh casi simultáneas con el mismo token (dos pestañas, React StrictMode).
  graciaMs: process.env.REFRESH_GRACIA_MS !== undefined ? Number(process.env.REFRESH_GRACIA_MS) : 10_000
});

export const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
export const nuevaFamilia = () => crypto.randomUUID();

export const firmarAccess = (usuario) =>
  jwt.sign(
    { id: String(usuario._id), alias: usuario.alias, email: usuario.email_institucional, rol: usuario.rol },
    process.env.ACCESS_SECRET,
    { algorithm: 'HS256', expiresIn: ttl().accessSeg }
  );

export const verificarAccess = (token) =>
  jwt.verify(token, process.env.ACCESS_SECRET, { algorithms: ['HS256'] });

// jti aleatorio: dos refresh emitidos en el mismo segundo nunca son idénticos.
export const firmarRefresh = ({ usuarioId, familia, expiraEnSeg }) =>
  jwt.sign(
    { sub: String(usuarioId), sid: familia, jti: crypto.randomUUID() },
    process.env.REFRESH_SECRET,
    { algorithm: 'HS256', expiresIn: Math.max(expiraEnSeg, 1) }
  );

export const verificarRefresh = (token, opciones = {}) =>
  jwt.verify(token, process.env.REFRESH_SECRET, { algorithms: ['HS256'], ...opciones });

// HttpOnly (JS no puede leerla), SameSite=Strict (mitiga CSRF) y Secure en producción (solo HTTPS).
const base = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  path: RUTA_COOKIE
});

export const ponerCookieRefresh = (res, token, maxAgeMs) =>
  res.cookie(COOKIE_REFRESH, token, { ...base(), maxAge: maxAgeMs });

export const borrarCookieRefresh = (res) => res.clearCookie(COOKIE_REFRESH, base());
