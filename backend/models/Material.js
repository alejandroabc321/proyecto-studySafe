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
  // El material se entrega como ENLACE (archivo_url) y/o como ARCHIVO subido al servidor (carpeta uploads/, no la base de datos).
  archivo_url: { type: String },
  archivo: {
    nombre_original: String,
    nombre_guardado: String, // uuid generado por el servidor (privado)
    mime: String,
    tamano: Number
  },
  previews: [String],        // nombres guardados de las 1-2 imágenes de previsualización
  autor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  descargas: { type: Number, default: 0 }
}, { timestamps: true });

// Lo que sale por la API: nunca el nombre interno del archivo; las previsualizaciones salen como rutas públicas.
materialSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.previews = (ret.previews || []).map((_, i) => `/feed/${ret._id}/preview/${i}`);
    if (ret.archivo?.nombre_guardado) {
      ret.archivo = { nombre: ret.archivo.nombre_original, mime: ret.archivo.mime, tamano: ret.archivo.tamano };
    } else {
      delete ret.archivo;
    }
    return ret;
  }
});

materialSchema.index({ createdAt: -1 });
materialSchema.index({ autor: 1 });

export default mongoose.model('Material', materialSchema, 'materiales');
