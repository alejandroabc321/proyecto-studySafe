import Profesor from '../models/Profesor.js';
import { asyncHandler } from '../middlewares/errorHandler.js';

export const obtenerProfesores = asyncHandler(async (req, res) => {
  const profesores = await Profesor.find().sort({ nombre: 1 });
  res.status(200).json({ exito: true, profesores });
});

export const crearProfesor = asyncHandler(async (req, res) => {
  const nuevoProfesor = await Profesor.create(req.body);
  res.status(201).json({ exito: true, profesor: nuevoProfesor });
});
