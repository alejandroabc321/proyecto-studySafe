// Falla al arrancar si falta algo crítico (nunca usamos secretos "por defecto").
const requeridas = ['MONGO_URI', 'JWT_SECRET'];
const faltan = requeridas.filter((k) => !process.env[k]);

if (faltan.length > 0) {
  console.error(`❌ Faltan variables de entorno: ${faltan.join(', ')}. Revisa tu archivo .env`);
  process.exit(1);
}

if (process.env.JWT_SECRET.length < 16) {
  console.warn('⚠️  JWT_SECRET es muy corto; usa al menos 32 caracteres aleatorios.');
}
