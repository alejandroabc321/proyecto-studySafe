// Crea el primer administrador (o convierte en admin a un usuario que ya existe).
// Uso:  npm run crear-admin
// La contraseña se escribe en la consola (no se muestra) y nunca queda guardada en el código.
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import readline from 'node:readline';
import User from '../models/User.js';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
let oculto = false;
const salida = rl._writeToOutput.bind(rl);
rl._writeToOutput = (t) => { if (!oculto || t.includes('\n') || t.includes('\r')) salida(t); };

const preguntar = (texto, { secreto = false } = {}) => new Promise((resolve) => {
  rl.question(texto, (r) => { oculto = false; if (secreto) process.stdout.write('\n'); resolve(r.trim()); });
  oculto = secreto;
});

const terminar = async (codigo, mensaje) => {
  if (mensaje) console.log(mensaje);
  rl.close();
  await mongoose.disconnect();
  process.exit(codigo);
};

if (!process.env.MONGO_URI) { console.error('❌ Falta MONGO_URI. Ejecuta con: npm run crear-admin'); process.exit(1); }
await mongoose.connect(process.env.MONGO_URI);

const email = (await preguntar('Correo del administrador: ')).toLowerCase();
if (!/^\S+@\S+\.\S+$/.test(email)) await terminar(1, '❌ Correo no válido');

const existente = await User.findOne({ email_institucional: email });
if (existente) {
  if (existente.rol === 'admin') await terminar(0, 'ℹ️  Ese usuario ya es administrador.');
  const r = (await preguntar(`Ya existe "${existente.alias}". ¿Convertirlo en administrador? (s/n): `)).toLowerCase();
  if (r !== 's') await terminar(0, 'Cancelado.');
  existente.rol = 'admin';
  await existente.save();
  await terminar(0, `✅ ${existente.alias} ahora es administrador. Debe cerrar sesión y volver a entrar.`);
}

const alias = await preguntar('Alias (3-30: letras, números, _ . -): ');
if (!/^[\w.-]{3,30}$/.test(alias)) await terminar(1, '❌ Alias no válido');
const nombre = await preguntar('Nombre real: ');
const documento = await preguntar('Documento de identidad: ');
if (nombre.length < 3 || documento.length < 5) await terminar(1, '❌ Nombre o documento no válidos');
const clave = await preguntar('Contraseña (mínimo 8 caracteres): ', { secreto: true });
const clave2 = await preguntar('Repite la contraseña: ', { secreto: true });
if (clave.length < 8 || clave.length > 72) await terminar(1, '❌ La contraseña debe tener entre 8 y 72 caracteres');
if (clave !== clave2) await terminar(1, '❌ Las contraseñas no coinciden');

try {
  await User.create({
    alias, email_institucional: email, nombre_real: nombre, documento_identidad: documento,
    password: await bcrypt.hash(clave, 10), rol: 'admin', verificado_kyc: true
  });
} catch (e) {
  await terminar(1, e.code === 11000 ? '❌ Ya existe un usuario con ese alias o documento' : `❌ ${e.message}`);
}
await terminar(0, `✅ Administrador "${alias}" creado. Ya puedes iniciar sesión con ${email}.`);
