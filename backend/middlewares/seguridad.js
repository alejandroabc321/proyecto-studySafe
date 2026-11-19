import rateLimit from 'express-rate-limit';

export const origenPermitido = () => process.env.FRONTEND_URL || 'http://localhost:5173';

// Defensa extra contra CSRF en las rutas que usan la cookie (refresh y logout):
// si el navegador envía el encabezado Origin, debe ser el del frontend.
export const verificarOrigen = (req, res, next) => {
  const origen = req.get('origin');
  if (origen && origen !== origenPermitido()) {
    return res.status(403).json({ exito: false, mensaje: 'Origen no permitido' });
  }
  next();
};

const limitador = (opciones) =>
  rateLimit({
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => process.env.RATE_LIMIT_OFF === 'true', // solo para las pruebas automáticas
    message: { exito: false, mensaje: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo' },
    ...opciones
  });

// Login: 10 intentos cada 15 min por cada combinación IP + correo
// (frena la fuerza bruta contra una cuenta sin bloquear a toda la red de la universidad).
export const limitarLogin = limitador({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.RATE_LIMIT_LOGIN_MAX) || 10,
  keyGenerator: (req) => `${req.ip}|${req.body?.email_institucional || ''}`
});

// Registro: 20 cuentas por hora por IP.
export const limitarRegistro = limitador({
  windowMs: 60 * 60 * 1000,
  limit: Number(process.env.RATE_LIMIT_REGISTRO_MAX) || 20
});
