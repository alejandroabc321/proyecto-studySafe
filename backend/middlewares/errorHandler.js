// Crea un error con código HTTP para lanzarlo desde cualquier controlador.
export const httpError = (status, mensaje) => Object.assign(new Error(mensaje), { status });

// Evita repetir try/catch en cada controlador (Express 4 no captura errores async solo).
export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Manejador central: nunca devolvemos detalles internos al cliente.
export const errorHandler = (err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ exito: false, mensaje: 'El cuerpo de la petición no es un JSON válido' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ exito: false, mensaje: 'La petición es demasiado grande' });
  }
  if (err.code === 11000) {
    return res.status(409).json({ exito: false, mensaje: 'Ya existe un registro con esos datos' });
  }
  if (err.name === 'ValidationError' || err.name === 'CastError') {
    return res.status(400).json({ exito: false, mensaje: 'Datos inválidos' });
  }
  if (err.status && err.status < 500) {
    return res.status(err.status).json({ exito: false, mensaje: err.message });
  }
  console.error(err);
  res.status(500).json({ exito: false, mensaje: 'Error interno del servidor' });
};
