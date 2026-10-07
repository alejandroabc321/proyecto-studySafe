// Pruebas funcionales de StudySafe. Levantan la API real contra una BD SEPARADA de pruebas.
// Ejecutar con:  npm test
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

process.env.JWT_SECRET ||= 'secreto_solo_para_pruebas_0123456789abcdef';
const URI_TEST = process.env.MONGO_URI_TEST || 'mongodb://127.0.0.1:27017/studysafe_test';

// Seguridad: jamás borrar una base que no sea de pruebas.
const nombreBD = new URL(URI_TEST).pathname.replace('/', '');
if (!nombreBD.toLowerCase().includes('test')) {
  throw new Error(`Por seguridad, la BD de pruebas debe contener "test" en su nombre (recibido: "${nombreBD}")`);
}

const { default: app } = await import('../app.js');
const { default: User } = await import('../models/User.js');
const { default: Compra } = await import('../models/Compra.js');
const { default: Material } = await import('../models/Material.js');

let server;
let base;

const pedir = async (metodo, ruta, { token, cuerpo, crudo } = {}) => {
  const headers = { ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  let body;
  if (crudo !== undefined) { headers['Content-Type'] = 'application/json'; body = crudo; }
  else if (cuerpo !== undefined) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(cuerpo); }
  const r = await fetch(`${base}${ruta}`, { method: metodo, headers, body });
  let json = null;
  try { json = await r.json(); } catch { /* respuesta sin JSON */ }
  return { status: r.status, json };
};

const datosUsuario = (n) => ({
  alias: `usuario${n}`,
  email_institucional: `usuario${n}@unicauca.edu.co`,
  nombre_real: `Usuario Numero ${n}`,
  documento_identidad: `10000000${n}`,
  password: 'Clave12345'
});

const registrarYLogin = async (n) => {
  const reg = await pedir('POST', '/auth/registro', { cuerpo: datosUsuario(n) });
  assert.equal(reg.status, 201);
  const login = await pedir('POST', '/auth/login', {
    cuerpo: { email_institucional: datosUsuario(n).email_institucional, password: 'Clave12345' }
  });
  assert.equal(login.status, 200);
  return { token: login.json.token, id: login.json.usuario.id };
};

const materialValido = (extra = {}) => ({
  titulo: 'Parcial 1 Algoritmos',
  descripcion: 'Solucionario completo',
  materia: 'Algoritmos',
  profesor: 'Ana Maria Gomez',
  tipo: 'Parcial',
  precio: 2000,
  archivo_url: 'https://drive.google.com/doc1',
  ...extra
});

const saldoDe = async (n) => {
  const l = await pedir('POST', '/auth/login', {
    cuerpo: { email_institucional: datosUsuario(n).email_institucional, password: 'Clave12345' }
  });
  return l.json.usuario.billetera.saldo;
};

before(async () => {
  await mongoose.connect(URI_TEST);
  await mongoose.connection.dropDatabase();
  await Promise.all([User.init(), Compra.init(), Material.init()]); // índices únicos listos
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}/api`;
});

after(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  await new Promise((r) => server.close(r));
});

describe('1. Registro y login', () => {
  it('registra un usuario válido y no devuelve datos sensibles', async () => {
    const r = await pedir('POST', '/auth/registro', { cuerpo: datosUsuario(1) });
    assert.equal(r.status, 201);
    assert.equal(r.json.exito, true);
    assert.equal(JSON.stringify(r.json).includes('password'), false);
  });

  it('rechaza correos no institucionales (400)', async () => {
    const r = await pedir('POST', '/auth/registro', { cuerpo: { ...datosUsuario(2), email_institucional: 'x@gmail.com' } });
    assert.equal(r.status, 400);
  });

  it('rechaza contraseñas cortas (400)', async () => {
    const r = await pedir('POST', '/auth/registro', { cuerpo: { ...datosUsuario(2), password: '123' } });
    assert.equal(r.status, 400);
  });

  it('rechaza un registro duplicado (409)', async () => {
    const r = await pedir('POST', '/auth/registro', { cuerpo: datosUsuario(1) });
    assert.equal(r.status, 409);
  });

  it('ignora el campo "rol" enviado por el cliente (no se puede ser admin)', async () => {
    const r = await pedir('POST', '/auth/registro', { cuerpo: { ...datosUsuario(3), rol: 'admin' } });
    assert.equal(r.status, 201);
    const u = await User.findOne({ alias: 'usuario3' });
    assert.equal(u.rol, 'estudiante');
  });

  it('login correcto devuelve token y billetera', async () => {
    const r = await pedir('POST', '/auth/login', {
      cuerpo: { email_institucional: datosUsuario(1).email_institucional, password: 'Clave12345' }
    });
    assert.equal(r.status, 200);
    assert.ok(r.json.token);
    assert.equal(r.json.usuario.billetera.saldo, 0);
  });

  it('login con contraseña incorrecta (401)', async () => {
    const r = await pedir('POST', '/auth/login', {
      cuerpo: { email_institucional: datosUsuario(1).email_institucional, password: 'incorrecta1' }
    });
    assert.equal(r.status, 401);
  });

  it('bloquea inyección NoSQL en el login (400)', async () => {
    const r = await pedir('POST', '/auth/login', { cuerpo: { email_institucional: { $gt: '' }, password: 'x' } });
    assert.equal(r.status, 400);
  });
});

describe('2. Publicar y consultar materiales', () => {
  let vendedor;
  before(async () => { vendedor = await registrarYLogin(10); });

  it('no permite publicar sin token (401)', async () => {
    const r = await pedir('POST', '/feed/publicar', { cuerpo: materialValido() });
    assert.equal(r.status, 401);
  });

  it('rechaza token falso (401)', async () => {
    const r = await pedir('POST', '/feed/publicar', { token: 'abc.def.ghi', cuerpo: materialValido() });
    assert.equal(r.status, 401);
  });

  it('publica un material válido (201)', async () => {
    const r = await pedir('POST', '/feed/publicar', { token: vendedor.token, cuerpo: materialValido() });
    assert.equal(r.status, 201);
    assert.equal(r.json.material.precio, 2000);
    assert.equal(r.json.material.autor, vendedor.id);
  });

  it('rechaza material sin título, con tipo inválido, precio texto o precio negativo (400)', async () => {
    const { titulo, ...sinTitulo } = materialValido();
    for (const cuerpo of [sinTitulo, materialValido({ tipo: 'Examen' }), materialValido({ precio: 'abc' }), materialValido({ precio: -5 })]) {
      const r = await pedir('POST', '/feed/publicar', { token: vendedor.token, cuerpo });
      assert.equal(r.status, 400);
    }
  });

  it('rechaza archivo_url que no sea https (400)', async () => {
    const r = await pedir('POST', '/feed/publicar', { token: vendedor.token, cuerpo: materialValido({ archivo_url: 'javascript:alert(1)' }) });
    assert.equal(r.status, 400);
  });

  it('el feed es público, pagina, filtra y NO expone archivo_url', async () => {
    await pedir('POST', '/feed/publicar', { token: vendedor.token, cuerpo: materialValido({ titulo: 'Taller 2', tipo: 'Taller', precio: 0 }) });
    const todos = await pedir('GET', '/feed');
    assert.equal(todos.status, 200);
    assert.ok(todos.json.total >= 2);
    assert.equal(JSON.stringify(todos.json).includes('archivo_url'), false);
    assert.equal(JSON.stringify(todos.json).includes('drive.google.com'), false);

    const pagina = await pedir('GET', '/feed?limite=1');
    assert.equal(pagina.json.materiales.length, 1);

    const talleres = await pedir('GET', '/feed?tipo=Taller');
    assert.ok(talleres.json.materiales.every((m) => m.tipo === 'Taller'));
  });

  it('rechaza filtros maliciosos y no se rompe con regex raros', async () => {
    assert.equal((await pedir('GET', '/feed?tipo=Examen')).status, 400);
    assert.equal((await pedir('GET', '/feed?materia[$ne]=x')).status, 400);
    assert.equal((await pedir('GET', '/feed?materia=(a%2B')).status, 200);
  });

  it('un id inválido responde 400 y uno inexistente 404', async () => {
    assert.equal((await pedir('GET', '/feed/abc')).status, 400);
    assert.equal((await pedir('GET', '/feed/64b7f0c2a1b2c3d4e5f60718')).status, 404);
  });
});

describe('3. Editar y eliminar (solo el autor)', () => {
  let autor, otro, id;
  before(async () => {
    autor = await registrarYLogin(20);
    otro = await registrarYLogin(21);
    const r = await pedir('POST', '/feed/publicar', { token: autor.token, cuerpo: materialValido({ titulo: 'Para editar' }) });
    id = r.json.material._id;
  });

  it('el autor puede editar su material (200)', async () => {
    const r = await pedir('PUT', `/feed/${id}`, { token: autor.token, cuerpo: { precio: 2500 } });
    assert.equal(r.status, 200);
    assert.equal(r.json.material.precio, 2500);
  });

  it('otro usuario NO puede editar ni eliminar (403)', async () => {
    assert.equal((await pedir('PUT', `/feed/${id}`, { token: otro.token, cuerpo: { precio: 1 } })).status, 403);
    assert.equal((await pedir('DELETE', `/feed/${id}`, { token: otro.token })).status, 403);
  });

  it('no se puede editar con un cuerpo vacío (400)', async () => {
    assert.equal((await pedir('PUT', `/feed/${id}`, { token: autor.token, cuerpo: {} })).status, 400);
  });

  it('eliminar sin token (401)', async () => {
    assert.equal((await pedir('DELETE', `/feed/${id}`)).status, 401);
  });

  it('el autor elimina su material y luego ya no existe', async () => {
    assert.equal((await pedir('DELETE', `/feed/${id}`, { token: autor.token })).status, 200);
    assert.equal((await pedir('GET', `/feed/${id}`)).status, 404);
  });
});

describe('4. Billetera, compra y acceso al archivo (lo más crítico)', () => {
  let vendedor, comprador, materialPago, materialGratis;
  before(async () => {
    vendedor = await registrarYLogin(30);
    comprador = await registrarYLogin(31);
    materialPago = (await pedir('POST', '/feed/publicar', { token: vendedor.token, cuerpo: materialValido({ titulo: 'De pago', precio: 2000, archivo_url: 'https://drive.google.com/pago' }) })).json.material._id;
    materialGratis = (await pedir('POST', '/feed/publicar', { token: vendedor.token, cuerpo: materialValido({ titulo: 'Gratis', precio: 0, archivo_url: 'https://drive.google.com/gratis' }) })).json.material._id;
  });

  it('el archivo de pago NO se entrega sin comprar (403)', async () => {
    const r = await pedir('GET', `/feed/${materialPago}/archivo`, { token: comprador.token });
    assert.equal(r.status, 403);
  });

  it('el archivo gratuito sí se entrega (200)', async () => {
    const r = await pedir('GET', `/feed/${materialGratis}/archivo`, { token: comprador.token });
    assert.equal(r.status, 200);
    assert.equal(r.json.archivo_url, 'https://drive.google.com/gratis');
  });

  it('comprar sin saldo falla (402) y no cobra nada', async () => {
    const r = await pedir('POST', `/transacciones/comprar/${materialPago}`, { token: comprador.token });
    assert.equal(r.status, 402);
    assert.equal(await saldoDe(31), 0);
  });

  it('rechaza recargas inválidas: negativa, muy baja, texto (400)', async () => {
    for (const monto of [-5000, 500, 'mil']) {
      const r = await pedir('POST', '/transacciones/recargar', { token: comprador.token, cuerpo: { monto } });
      assert.equal(r.status, 400);
    }
  });

  it('recarga válida suma al saldo', async () => {
    const r = await pedir('POST', '/transacciones/recargar', { token: comprador.token, cuerpo: { monto: 5000 } });
    assert.equal(r.status, 201);
    assert.equal(r.json.saldo, 5000);
  });

  it('no se puede comprar el propio material (400) ni uno gratuito (400)', async () => {
    assert.equal((await pedir('POST', `/transacciones/comprar/${materialPago}`, { token: vendedor.token })).status, 400);
    assert.equal((await pedir('POST', `/transacciones/comprar/${materialGratis}`, { token: comprador.token })).status, 400);
  });

  it('compra exitosa: descuenta al comprador, paga al vendedor y entrega el archivo', async () => {
    const r = await pedir('POST', `/transacciones/comprar/${materialPago}`, { token: comprador.token });
    assert.equal(r.status, 201);
    assert.equal(r.json.saldo, 3000);
    assert.equal(r.json.archivo_url, 'https://drive.google.com/pago');
    assert.equal(await saldoDe(30), 2000);
  });

  it('tras comprar, el comprador accede al archivo (200)', async () => {
    const r = await pedir('GET', `/feed/${materialPago}/archivo`, { token: comprador.token });
    assert.equal(r.status, 200);
  });

  it('no se puede comprar dos veces el mismo material (409) y no se cobra de nuevo', async () => {
    const r = await pedir('POST', `/transacciones/comprar/${materialPago}`, { token: comprador.token });
    assert.equal(r.status, 409);
    assert.equal(await saldoDe(31), 3000);
  });

  it('el historial refleja recarga, compra y venta', async () => {
    const c = await pedir('GET', '/transacciones/historial', { token: comprador.token });
    assert.deepEqual(c.json.transacciones.map((t) => t.tipo).sort(), ['compra', 'recarga']);
    const v = await pedir('GET', '/transacciones/historial', { token: vendedor.token });
    assert.deepEqual(v.json.transacciones.map((t) => t.tipo), ['recompensa']);
  });

  it('el historial exige token (401)', async () => {
    assert.equal((await pedir('GET', '/transacciones/historial')).status, 401);
  });

  it('doble clic simultáneo: se cobra UNA sola vez', async () => {
    const rico = await registrarYLogin(32);
    await pedir('POST', '/transacciones/recargar', { token: rico.token, cuerpo: { monto: 10000 } });
    const nuevo = (await pedir('POST', '/feed/publicar', { token: vendedor.token, cuerpo: materialValido({ titulo: 'Carrera', precio: 3000 }) })).json.material._id;

    const [a, b] = await Promise.all([
      pedir('POST', `/transacciones/comprar/${nuevo}`, { token: rico.token }),
      pedir('POST', `/transacciones/comprar/${nuevo}`, { token: rico.token })
    ]);
    assert.deepEqual([a.status, b.status].sort(), [201, 409]);
    assert.equal(await saldoDe(32), 7000);
  });
});

describe('5. Profesores', () => {
  let usuario;
  before(async () => { usuario = await registrarYLogin(40); });

  it('crear profesor exige token (401)', async () => {
    const r = await pedir('POST', '/profesores', { cuerpo: { nombre: 'Ana Gomez', facultad: 'Ingeniería', materia: 'Algoritmos' } });
    assert.equal(r.status, 401);
  });

  it('crea y lista profesores', async () => {
    const c = await pedir('POST', '/profesores', { token: usuario.token, cuerpo: { nombre: 'Ana Gomez', facultad: 'Ingeniería', materia: 'Algoritmos' } });
    assert.equal(c.status, 201);
    const l = await pedir('GET', '/profesores');
    assert.equal(l.status, 200);
    assert.ok(l.json.profesores.length >= 1);
  });

  it('rechaza datos incompletos (400)', async () => {
    const r = await pedir('POST', '/profesores', { token: usuario.token, cuerpo: { nombre: 'Solo nombre' } });
    assert.equal(r.status, 400);
  });
});

describe('6. Robustez general', () => {
  it('JSON mal formado responde 400 (sin filtrar detalles internos)', async () => {
    const r = await pedir('POST', '/auth/login', { crudo: '{malo' });
    assert.equal(r.status, 400);
  });

  it('cuerpos demasiado grandes responden 413', async () => {
    const r = await pedir('POST', '/auth/login', { cuerpo: { email_institucional: 'a'.repeat(20000), password: 'x' } });
    assert.equal(r.status, 413);
  });

  it('rutas inexistentes responden 404', async () => {
    assert.equal((await pedir('GET', '/no-existe')).status, 404);
  });
});
