import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  alias: { type: String, required: true, unique: true },
  avatar: { type: String, default: 'default.png' },
  rol: { type: String, enum: ['estudiante', 'admin'], default: 'estudiante' },
  nivel_reputacion: {
    nivel: { type: Number, default: 1 },
    puntos_xp: { type: Number, default: 0 }
  },
  // KYC PRIVADO: No se retorna por defecto en consultas de la API
  nombre_real: { type: String, required: true, select: false },
  documento_identidad: { type: String, required: true, unique: true, select: false },
  email_institucional: { type: String, required: true, unique: true },
  password: { type: String, required: true, select: false },
  verificado_kyc: { type: Boolean, default: false },
  billetera: {
    saldo: { type: Number, default: 0, min: 0 },
    moneda: { type: String, default: 'COP' }
  },
  activo: { type: Boolean, default: true }
}, { timestamps: true });

export default mongoose.model('User', userSchema, 'usuarios');
