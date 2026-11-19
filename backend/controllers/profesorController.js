import Profesor from '../models/Profesor.js';
import { asyncHandler, httpError } from '../middlewares/errorHandler.js';

export const obtenerProfesores = asyncHandler(async (req, res) => {
  const profesores = await Profesor.find().sort({ nombre: 1 });
  res.status(200).json({ exito: true, profesores });
});

export const crearProfesor = asyncHandler(async (req, res) => {
  let nuevoProfesor;
  try {
    nuevoProfesor = await Profesor.create({ ...req.body, creadoPor: req.usuario.id });
  } catch (err) {
    if (err.code === 11000) throw httpError(409, 'Este profesor ya está registrado');
    throw err;
  }
  res.status(201).json({ exito: true, profesor: nuevoProfesor });
});

// Registra al profesor si aún no existe (lo usa la publicación de materiales). Nunca hace fallar la publicación:
// si ya existe (índice único, sin distinguir mayúsculas ni tildes) simplemente se ignora.
export const registrarProfesorSiNoExiste = async (nombre, materia, usuarioId) => {
  if (!nombre || nombre.length < 3) return;
  try {
    await Profesor.create({ nombre, facultad: 'Por definir', materia, creadoPor: usuarioId });
  } catch (err) {
    if (err.code !== 11000) console.error('No se pudo registrar al profesor:', err.message);
  }
};
