import mongoose from 'mongoose';

const transaccionSchema = new mongoose.Schema({
  usuario: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  tipo: {
    type: String,
    enum: ['recarga', 'compra', 'recompensa'],
    required: true
  },
  // Positivo = entra dinero (recarga, venta). Negativo = sale dinero (compra).
  monto: { type: Number, required: true },
  descripcion: { type: String, required: true }
}, { timestamps: true });

transaccionSchema.index({ usuario: 1, createdAt: -1 });

export default mongoose.model('Transaccion', transaccionSchema, 'transacciones');
