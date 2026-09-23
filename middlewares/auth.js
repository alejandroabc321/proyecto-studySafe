import jwt from 'jsonwebtoken';

export const verificarToken = (req, res, next) => {
  const tokenHeader = req.headers['authorization'];

  if (!tokenHeader) {
    return res.status(403).json({ mensaje: 'Acceso denegado: Token no proporcionado' });
  }

  const token = tokenHeader.split(' ')[1]; // Formato 'Bearer TOKEN'

  try {
    const verificado = jwt.verify(token, process.env.JWT_SECRET);
    req.usuario = verificado;
    next();
  } catch (error) {
    res.status(401).json({ mensaje: 'Token inválido o expirado' });
  }
};