import jwt from 'jsonwebtoken';

export const verificarToken = (req, res, next) => {
  const [esquema, token] = (req.headers.authorization || '').split(' ');

  if (esquema !== 'Bearer' || !token) {
    return res.status(401).json({ exito: false, mensaje: 'Acceso denegado: token no proporcionado' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.usuario = { id: payload.id, alias: payload.alias, email: payload.email };
    next();
  } catch {
    res.status(401).json({ exito: false, mensaje: 'Token inválido o expirado' });
  }
};
