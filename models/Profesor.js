import mongoose from 'mongoose';

const profesorSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  facultad: { type: String, required: true },
  materia: { type: String, required: true },
  calificacion_promedio: { type: Number, default: 0 },
  total_resenas: { type: Number, default: 0 }
}, { timestamps: true });

export default mongoose.model('Profesor', profesorSchema, 'profesores');
