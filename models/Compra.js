import mongoose from 'mongoose';

const compraSchema = new mongoose.Schema({
  usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  material: { type: mongoose.Schema.Types.ObjectId, ref: 'Material', required: true },
  precio: { type: Number, required: true, min: 0 }
}, { timestamps: true });

// Un usuario solo puede comprar un material una vez (también protege ante doble clic simultáneo).
compraSchema.index({ usuario: 1, material: 1 }, { unique: true });

export default mongoose.model('Compra', compraSchema, 'compras');
