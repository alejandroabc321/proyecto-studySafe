import { verificarAccess } from '../libs/tokens.js';
import User from '../models/User.js';
import { asyncHandler } from './errorHandler.js';

// Protege rutas con el ACCESS token (Authorization: Bearer ...). Es de vida corta; cuando vence,
// el frontend lo renueva en silencio con POST /api/auth/refresh.
export const verificarToken = (req, res, next) => {
  const [esquema, token] = (req.headers.authorization || '').split(' ');

  if (esquema !== 'Bearer' || !token) {
    return res.status(401).json({ exito: false, codigo: 'SIN_TOKEN', mensaje: 'Acceso denegado: token no proporcionado' });
  }

  try {
    const payload = verificarAccess(token);
    req.usuario = { id: payload.id, alias: payload.alias, email: payload.email, rol: payload.rol };
    next();
  } catch (e) {
    const expirado = e.name === 'TokenExpiredError';
    res.status(401).json({
      exito: false,
      codigo: expirado ? 'TOKEN_EXPIRADO' : 'TOKEN_INVALIDO',
      mensaje: expirado ? 'El token expiró' : 'Token inválido'
    });
  }
};

// Solo administradores. El rol se consulta en la base de datos (no solo en el token) para que un admin
// al que se le quitó el rol o se desactivó pierda el acceso de inmediato y no 15 minutos después.
export const soloAdmin = asyncHandler(async (req, res, next) => {
  const u = await User.findById(req.usuario.id).select('rol activo');
  if (!u || !u.activo || u.rol !== 'admin') {
    return res.status(403).json({ exito: false, mensaje: 'Solo el administrador puede hacer esto' });
  }
  next();
});
