// Aplica (o actualiza) los validadores $jsonSchema de MongoDB para que COINCIDAN con los modelos de Mongoose.
// Uso:
//   node --env-file=.env scripts/aplicar-validadores.js          -> modo "warn"  (solo registra incumplimientos)
//   node --env-file=.env scripts/aplicar-validadores.js error    -> modo "error" (rechaza documentos inválidos)
import mongoose from 'mongoose';

const modo = process.argv[2] === 'error' ? 'error' : 'warn';
const ID = 'objectId';
const NUM = 'number'; // int, long, double o decimal

const validadores = {
  usuarios: {
    required: ['alias', 'nombre_real', 'documento_identidad', 'email_institucional', 'password'],
    properties: {
      alias: { bsonType: 'string' },
      avatar: { bsonType: 'string' },
      rol: { enum: ['estudiante', 'admin'] },
      nombre_real: { bsonType: 'string' },
      documento_identidad: { bsonType: 'string' },
      email_institucional: { bsonType: 'string' },
      password: { bsonType: 'string' },
      verificado_kyc: { bsonType: 'bool' },
      activo: { bsonType: 'bool' },
      nivel_reputacion: { bsonType: 'object', properties: { nivel: { bsonType: NUM }, puntos_xp: { bsonType: NUM } } },
      billetera: { bsonType: 'object', properties: { saldo: { bsonType: NUM, minimum: 0 }, moneda: { bsonType: 'string' } } }
    }
  },
  materiales: {
    required: ['titulo', 'descripcion', 'materia', 'profesor', 'tipo', 'archivo_url', 'autor'],
    properties: {
      titulo: { bsonType: 'string' }, descripcion: { bsonType: 'string' },
      materia: { bsonType: 'string' }, profesor: { bsonType: 'string' },
      tipo: { enum: ['Taller', 'Parcial', 'Guia', 'Resumen'] },
      precio: { bsonType: NUM, minimum: 0 },
      archivo_url: { bsonType: 'string' },
      autor: { bsonType: ID },
      descargas: { bsonType: NUM }
    }
  },
  profesores: {
    required: ['nombre', 'facultad', 'materia'],
    properties: {
      nombre: { bsonType: 'string' }, facultad: { bsonType: 'string' }, materia: { bsonType: 'string' },
      calificacion_promedio: { bsonType: NUM }, total_resenas: { bsonType: NUM }
    }
  },
  transacciones: {
    required: ['usuario', 'tipo', 'monto', 'descripcion'],
    properties: {
      usuario: { bsonType: ID },
      tipo: { enum: ['recarga', 'compra', 'recompensa'] },
      monto: { bsonType: NUM },
      descripcion: { bsonType: 'string' }
    }
  },
  compras: {
    required: ['usuario', 'material', 'precio'],
    properties: { usuario: { bsonType: ID }, material: { bsonType: ID }, precio: { bsonType: NUM, minimum: 0 } }
  }
};

await mongoose.connect(process.env.MONGO_URI);
const db = mongoose.connection.db;
const existentes = new Set((await db.listCollections().toArray()).map((c) => c.name));

for (const [nombre, def] of Object.entries(validadores)) {
  const opciones = {
    validator: { $jsonSchema: { bsonType: 'object', ...def } },
    validationLevel: 'moderate',
    validationAction: modo
  };
  if (existentes.has(nombre)) await db.command({ collMod: nombre, ...opciones });
  else await db.createCollection(nombre, opciones);
  console.log(`✅ ${nombre}: validador aplicado (modo ${modo})`);
}

await mongoose.disconnect();
