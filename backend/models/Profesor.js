import mongoose from 'mongoose';

const profesorSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  facultad: { type: String, required: true },
  materia: { type: String, required: true },
  calificacion_promedio: { type: Number, default: 0 },
  total_resenas: { type: Number, default: 0 },
  // Quién lo registró (un estudiante al publicar, o el administrador).
  creadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

// Un mismo profesor no puede registrarse dos veces (sin distinguir mayúsculas/tildes).
profesorSchema.index({ nombre: 1 }, { unique: true, collation: { locale: 'es', strength: 1 } });

export default mongoose.model('Profesor', profesorSchema, 'profesores');
