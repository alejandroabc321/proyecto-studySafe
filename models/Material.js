import mongoose from 'mongoose';

const materialSchema = new mongoose.Schema({
  titulo: { type: String, required: true },
  descripcion: { type: String, required: true },
  materia: { type: String, required: true },
  profesor: { type: String, required: true },
  tipo: {
    type: String,
    enum: ['Taller', 'Parcial', 'Guia', 'Resumen'],
    required: true
  },
  precio: { type: Number, default: 0, min: 0 },
  archivo_url: { type: String, required: true },
  autor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  descargas: { type: Number, default: 0 }
}, { timestamps: true });

materialSchema.index({ createdAt: -1 });
materialSchema.index({ autor: 1 });

export default mongoose.model('Material', materialSchema, 'materiales');
