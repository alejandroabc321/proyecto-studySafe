// Ejecuta una función validadora sobre req.body. Si es válido, deja en req.body
// SOLO los campos permitidos (así un cliente no puede colar campos como "rol").
export const validar = (fn, opciones) => (req, res, next) => {
  const { error, data } = fn(req.body, opciones);
  if (error) return res.status(400).json({ exito: false, mensaje: error });
  req.body = data;
  next();
};

// Verifica que un parámetro de la URL sea un ObjectId válido de MongoDB.
export const validarId = (param = 'id') => (req, res, next) => {
  if (!/^[a-f\d]{24}$/i.test(req.params[param] || '')) {
    return res.status(400).json({ exito: false, mensaje: 'Identificador inválido' });
  }
  next();
};
