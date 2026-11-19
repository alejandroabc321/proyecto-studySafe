// Falla al arrancar si falta algo crítico (nunca usamos secretos "por defecto").
const requeridas = ['MONGO_URI', 'ACCESS_SECRET', 'REFRESH_SECRET'];
const faltan = requeridas.filter((k) => !process.env[k]);

if (faltan.length > 0) {
  console.error(`❌ Faltan variables de entorno: ${faltan.join(', ')}. Revisa tu archivo .env`);
  process.exit(1);
}

// Dos secretos DISTINTOS: así un access token no puede hacerse pasar por un refresh token (ni al revés).
if (process.env.ACCESS_SECRET === process.env.REFRESH_SECRET) {
  console.error('❌ ACCESS_SECRET y REFRESH_SECRET deben ser diferentes.');
  process.exit(1);
}

for (const k of ['ACCESS_SECRET', 'REFRESH_SECRET']) {
  if (process.env[k].length < 32) {
    const msg = `${k} es muy corto; usa al menos 32 caracteres aleatorios.`;
    if (process.env.NODE_ENV === 'production') { console.error(`❌ ${msg}`); process.exit(1); }
    console.warn(`⚠️  ${msg}`);
  }
}
