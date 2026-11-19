import mongoose from 'mongoose';

// Petición de saldo hecha por un usuario. No mueve dinero: solo el administrador
// puede aprobarla (entonces se hace la recarga) o rechazarla.
const solicitudSchema = new mongoose.Schema({
  usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  monto: { type: Number, required: true, min: 1000, max: 2000000 },
  nota: { type: String, trim: true, maxlength: 200, default: '' },
  estado: { type: String, enum: ['pendiente', 'aprobada', 'rechazada'], default: 'pendiente' },
  resueltaPor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  resueltaEn: Date
}, { timestamps: true });

solicitudSchema.index({ estado: 1, createdAt: -1 });
solicitudSchema.index({ usuario: 1, createdAt: -1 });

export default mongoose.model('SolicitudRecarga', solicitudSchema, 'solicitudes_recarga');
