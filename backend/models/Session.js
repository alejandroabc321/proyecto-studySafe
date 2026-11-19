import mongoose from 'mongoose';

// Una sesión = una "familia" de refresh tokens que se van rotando en cada uso.
// Se guarda solo el HASH del token (si se filtra la base de datos, los tokens no sirven).
const sessionSchema = new mongoose.Schema({
  usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  familia: { type: String, required: true, unique: true },
  tokenHash: { type: String, required: true },          // el único refresh token vigente
  tokenHashAnterior: { type: String },                   // el anterior: si alguien lo reutiliza, hay robo
  rotadoEn: { type: Date },
  userAgent: { type: String, maxlength: 200 },
  expiraEn: { type: Date, required: true }
}, { timestamps: true });

// MongoDB borra solo las sesiones vencidas.
sessionSchema.index({ expiraEn: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('Session', sessionSchema, 'sesiones');
