// Pruebas funcionales de StudySafe. Levantan la API real contra una BD SEPARADA de pruebas.
// Ejecutar con:  npm test
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

process.env.ACCESS_SECRET ||= 'secreto_access_solo_para_pruebas_0123456789abcdef';
process.env.REFRESH_SECRET ||= 'secreto_refresh_solo_para_pruebas_fedcba9876543210';
process.env.FRONTEND_URL = 'http://localhost:5173';
process.env.UPLOADS_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'studysafe-uploads-')); // los archivos de prueba no ensucian el proyecto
process.env.RATE_LIMIT_OFF = 'true'; // los limitadores se prueban aparte; aquí se registran muchos usuarios desde la misma IP
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
const { default: Session } = await import('../models/Session.js');
const { default: Profesor } = await import('../models/Profesor.js');
const { default: Transaccion } = await import('../models/Transaccion.js');

let server;
let base;

const pedir = async (metodo, ruta, { token, cuerpo, crudo, cookie, origen } = {}) => {
  const headers = { ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  if (cookie) headers.Cookie = cookie;
  if (origen) headers.Origin = origen;
  let body;
  if (crudo !== undefined) { headers['Content-Type'] = 'application/json'; body = crudo; }
  else if (cuerpo !== undefined) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(cuerpo); }
  const r = await fetch(`${base}${ruta}`, { method: metodo, headers, body });
  let json = null;
  try { json = await r.json(); } catch { /* respuesta sin JSON */ }
  return { status: r.status, json, setCookie: r.headers.getSetCookie() };
};

// De las cabeceras Set-Cookie devuelve el par "refreshToken=valor" listo para reenviarlo como Cookie.
const cookieRefresh = (r) => {
  const c = r.setCookie.find((x) => x.startsWith('refreshToken='));
  return c ? c.split(';')[0] : null;
};

const datosUsuario = (n) => ({
  alias: `usuario${n}`,
  email_institucional: `usuario${n}@uniautonoma.edu.co`,
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
  return { token: login.json.accessToken, id: login.json.usuario.id, cookie: cookieRefresh(login) };
};

// Convierte en administrador a un usuario ya registrado (el registro público nunca da ese rol).
const crearAdmin = async (n) => {
  const u = await registrarYLogin(n);
  await User.updateOne({ _id: u.id }, { rol: 'admin' });
  return u;
};
const recargar = (admin, usuarioId, monto) =>
  pedir('POST', '/admin/recargas', { token: admin.token, cuerpo: { usuario: usuarioId, monto } });

// multipart/form-data (publicar con archivo y previsualizaciones)
const pedirForm = async (metodo, ruta, { token, campos = {}, archivos = [] }) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(campos)) f.append(k, String(v));
  for (const a of archivos) f.append(a.campo, new Blob([a.contenido]), a.nombre);
  const r = await fetch(`${base}${ruta}`, { method: metodo, headers: token ? { Authorization: `Bearer ${token}` } : {}, body: f });
  let json = null;
  try { json = await r.clone().json(); } catch { /* binario */ }
  return { status: r.status, json, headers: r.headers, buffer: Buffer.from(await r.arrayBuffer()) };
};
const PDF = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(200, 1)]);
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(100, 2)]);
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(100, 3)]);

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
  await Promise.all([User.init(), Compra.init(), Material.init(), Session.init(), Profesor.init()]); // índices únicos listos
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}/api`;
});

after(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  fs.rmSync(process.env.UPLOADS_DIR, { recursive: true, force: true });
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

  it('solo acepta @uniautonoma.edu.co: rechaza @unicauca.edu.co y dominios que lo imitan (400)', async () => {
    for (const correo of ['x@unicauca.edu.co', 'x@uniautonoma.edu.co.evil.com', 'x@falso-uniautonoma.edu.co']) {
      const r = await pedir('POST', '/auth/registro', { cuerpo: { ...datosUsuario(2), email_institucional: correo } });
      assert.equal(r.status, 400, correo);
    }
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

  it('login correcto devuelve access token y billetera (el refresh va solo en cookie)', async () => {
    const r = await pedir('POST', '/auth/login', {
      cuerpo: { email_institucional: datosUsuario(1).email_institucional, password: 'Clave12345' }
    });
    assert.equal(r.status, 200);
    assert.ok(r.json.accessToken);
    assert.equal(r.json.token, undefined);
    assert.equal(r.json.refreshToken, undefined);
    assert.equal(r.json.usuario.billetera.saldo, 0);
    assert.equal(r.json.usuario.rol, 'estudiante');
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
  let vendedor, comprador, admin, materialPago, materialGratis;
  before(async () => {
    vendedor = await registrarYLogin(30);
    comprador = await registrarYLogin(31);
    admin = await crearAdmin(33);
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

  it('el usuario ya NO puede recargarse a sí mismo (la ruta no existe) ni usar la del admin (403)', async () => {
    assert.equal((await pedir('POST', '/transacciones/recargar', { token: comprador.token, cuerpo: { monto: 5000 } })).status, 404);
    assert.equal((await recargar(comprador, comprador.id, 5000)).status, 403);
    assert.equal(await saldoDe(31), 0);
  });

  it('rechaza recargas inválidas del admin: negativa, muy baja, texto, usuario inválido (400)', async () => {
    for (const monto of [-5000, 500, 'mil']) assert.equal((await recargar(admin, comprador.id, monto)).status, 400);
    assert.equal((await recargar(admin, 'no-es-un-id', 5000)).status, 400);
  });

  it('recarga del admin suma al saldo y queda registrada quién la hizo', async () => {
    const r = await recargar(admin, comprador.id, 5000);
    assert.equal(r.status, 201);
    assert.equal(r.json.saldo, 5000);
    const t = await Transaccion.findOne({ usuario: comprador.id, tipo: 'recarga' });
    assert.equal(String(t.realizadaPor), admin.id);
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
    await recargar(admin, rico.id, 10000);
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
  let usuario, admin;
  before(async () => { usuario = await registrarYLogin(40); admin = await crearAdmin(41); });

  it('crear profesor exige token (401)', async () => {
    const r = await pedir('POST', '/profesores', { cuerpo: { nombre: 'Ana Gomez', facultad: 'Ingeniería', materia: 'Algoritmos' } });
    assert.equal(r.status, 401);
  });

  it('un estudiante puede registrar un profesor; el duplicado (otras mayúsculas) se rechaza (409)', async () => {
    const c = await pedir('POST', '/profesores', { token: usuario.token, cuerpo: { nombre: 'Ana Gomez', facultad: 'Ingeniería', materia: 'Algoritmos' } });
    assert.equal(c.status, 201);
    const l = await pedir('GET', '/profesores');
    assert.equal(l.status, 200);
    assert.ok(l.json.profesores.length >= 1);
    const d = await pedir('POST', '/profesores', { token: usuario.token, cuerpo: { nombre: 'ANA GOMEZ', facultad: 'Ingeniería', materia: 'Algoritmos' } });
    assert.equal(d.status, 409);
  });

  it('rechaza datos incompletos (400)', async () => {
    const r = await pedir('POST', '/profesores', { token: usuario.token, cuerpo: { nombre: 'Solo nombre' } });
    assert.equal(r.status, 400);
  });

  it('al publicar un material con un profesor nuevo, queda registrado; si ya existe no se duplica', async () => {
    const mat = (profesor) => materialValido({ profesor, titulo: 'Material de ' + profesor });
    assert.equal((await pedir('POST', '/feed/publicar', { token: usuario.token, cuerpo: mat('Luis Fernando Rojas') })).status, 201);
    assert.equal((await pedir('POST', '/feed/publicar', { token: usuario.token, cuerpo: mat('LUIS FERNANDO ROJAS') })).status, 201);
    const lista = (await pedir('GET', '/profesores')).json.profesores.filter((p) => /luis fernando rojas/i.test(p.nombre));
    assert.equal(lista.length, 1);
    assert.equal(lista[0].facultad, 'Por definir');
  });

  it('solo el admin elimina profesores (403 / 200); los materiales conservan el nombre', async () => {
    const id = (await pedir('GET', '/profesores')).json.profesores.find((p) => /luis fernando/i.test(p.nombre))._id;
    assert.equal((await pedir('DELETE', `/admin/profesores/${id}`, { token: usuario.token })).status, 403);
    assert.equal((await pedir('DELETE', `/admin/profesores/${id}`, { token: admin.token })).status, 200);
    assert.equal((await pedir('DELETE', `/admin/profesores/${id}`, { token: admin.token })).status, 404);
  });
});

describe('8. Administrador', () => {
  let admin, est, otroAdmin;
  before(async () => { admin = await crearAdmin(50); est = await registrarYLogin(51); otroAdmin = await crearAdmin(52); });

  it('un estudiante no entra a ninguna ruta de admin (403) y sin token es 401', async () => {
    assert.equal((await pedir('GET', '/admin/usuarios', { token: est.token })).status, 403);
    assert.equal((await pedir('GET', `/admin/usuarios/${est.id}`, { token: est.token })).status, 403);
    assert.equal((await pedir('GET', '/admin/usuarios')).status, 401);
  });

  it('un admin al que se le quita el rol pierde el acceso de inmediato (aunque su token siga vigente)', async () => {
    const temp = await crearAdmin(53);
    assert.equal((await pedir('GET', '/admin/usuarios', { token: temp.token })).status, 200);
    await User.updateOne({ _id: temp.id }, { rol: 'estudiante' });
    assert.equal((await pedir('GET', '/admin/usuarios', { token: temp.token })).status, 403);
  });

  it('lista y busca usuarios sin exponer datos sensibles', async () => {
    const r = await pedir('GET', '/admin/usuarios?q=usuario51', { token: admin.token });
    assert.equal(r.status, 200);
    assert.equal(r.json.usuarios.length, 1);
    const txt = JSON.stringify(r.json);
    assert.equal(txt.includes('password'), false);
    assert.equal(txt.includes('documento_identidad'), false);
  });

  it('el detalle muestra compras, publicaciones y movimientos del usuario', async () => {
    await pedir('POST', '/feed/publicar', { token: est.token, cuerpo: materialValido({ titulo: 'Del supervisado' }) });
    await recargar(admin, est.id, 4000);
    const r = await pedir('GET', `/admin/usuarios/${est.id}`, { token: admin.token });
    assert.equal(r.status, 200);
    assert.equal(r.json.usuario.alias, 'usuario51');
    assert.equal(r.json.publicaciones.length, 1);
    assert.equal(r.json.movimientos[0].realizadaPor.alias, 'usuario50');
    assert.ok(Array.isArray(r.json.compras));
    assert.equal(JSON.stringify(r.json).includes('archivo_url'), false);
  });

  it('desactivar una cuenta cierra sus sesiones y le impide entrar; activarla la devuelve', async () => {
    const e = await registrarYLogin(54);
    const d = await pedir('PATCH', `/admin/usuarios/${e.id}/estado`, { token: admin.token, cuerpo: { activo: false } });
    assert.equal(d.status, 200);
    assert.equal((await pedir('POST', '/auth/refresh', { cookie: e.cookie, origen: 'http://localhost:5173' })).status, 401);
    assert.equal((await pedir('POST', '/auth/login', { cuerpo: { email_institucional: datosUsuario(54).email_institucional, password: 'Clave12345' } })).status, 403);
    assert.equal((await recargar(admin, e.id, 5000)).status, 404);
    await pedir('PATCH', `/admin/usuarios/${e.id}/estado`, { token: admin.token, cuerpo: { activo: true } });
    assert.equal((await pedir('POST', '/auth/login', { cuerpo: { email_institucional: datosUsuario(54).email_institucional, password: 'Clave12345' } })).status, 200);
  });

  it('no puede desactivarse a sí mismo (400) ni a otro admin (403); valida el cuerpo (400)', async () => {
    assert.equal((await pedir('PATCH', `/admin/usuarios/${admin.id}/estado`, { token: admin.token, cuerpo: { activo: false } })).status, 400);
    assert.equal((await pedir('PATCH', `/admin/usuarios/${otroAdmin.id}/estado`, { token: admin.token, cuerpo: { activo: false } })).status, 403);
    assert.equal((await pedir('PATCH', `/admin/usuarios/${est.id}/estado`, { token: admin.token, cuerpo: { activo: 'no' } })).status, 400);
  });

  it('resumen, recargas y materiales globales: solo admin y con cifras correctas', async () => {
    for (const r of ['/admin/resumen', '/admin/recargas', '/admin/materiales']) {
      assert.equal((await pedir('GET', r, { token: est.token })).status, 403, r);
    }
    const antes = (await pedir('GET', '/admin/resumen', { token: admin.token })).json.resumen;
    const dest = await registrarYLogin(56);
    await recargar(admin, dest.id, 25000);
    const pub = await pedir('POST', '/feed/publicar', { token: dest.token, cuerpo: materialValido({ titulo: 'Para moderar' }) });
    const r = await pedir('GET', '/admin/resumen', { token: admin.token });
    assert.equal(r.status, 200);
    assert.equal(r.json.resumen.totalRecargado, antes.totalRecargado + 25000);
    assert.equal(r.json.resumen.saldoEnCirculacion, antes.saldoEnCirculacion + 25000);
    assert.equal(r.json.resumen.materiales, antes.materiales + 1);
    assert.equal(r.json.recientes[0].realizadaPor.alias, 'usuario50');
    const mat = await pedir('GET', '/admin/materiales?q=moderar', { token: admin.token });
    assert.equal(mat.json.materiales.length, 1);
    assert.equal(JSON.stringify(mat.json).includes('archivo_url'), false);
    assert.equal((await pedir('DELETE', `/admin/materiales/${pub.json.material._id}`, { token: est.token })).status, 403);
    assert.equal((await pedir('DELETE', `/admin/materiales/${pub.json.material._id}`, { token: admin.token })).status, 200);
    assert.equal((await pedir('GET', '/admin/recargas', { token: admin.token })).status, 200);
  });

  it('solicitudes de recarga: el usuario pide, el admin aprueba/rechaza una sola vez', async () => {
    const u = await registrarYLogin(54);
    const saldo = async () => (await User.findById(u.id)).billetera.saldo;
    for (const c of [{ monto: 500 }, { monto: 'mucho' }, {}, { monto: 5000, nota: 'x'.repeat(201) }]) assert.equal((await pedir('POST', '/transacciones/solicitudes', { token: u.token, cuerpo: c })).status, 400);
    assert.equal((await pedir('POST', '/transacciones/solicitudes', { cuerpo: { monto: 5000 } })).status, 401);
    const a = await pedir('POST', '/transacciones/solicitudes', { token: u.token, cuerpo: { monto: 20000, nota: 'Nequi' } });
    assert.equal(a.status, 201); assert.equal(a.json.solicitud.estado, 'pendiente');
    assert.equal(await saldo(), 0, 'pedir no mueve saldo');
    const b = await pedir('POST', '/transacciones/solicitudes', { token: u.token, cuerpo: { monto: 3000 } });
    await pedir('POST', '/transacciones/solicitudes', { token: u.token, cuerpo: { monto: 4000 } });
    assert.equal((await pedir('POST', '/transacciones/solicitudes', { token: u.token, cuerpo: { monto: 5000 } })).status, 429, 'máximo 3 pendientes');
    assert.equal((await pedir('GET', '/transacciones/solicitudes', { token: u.token })).json.solicitudes.length, 3);
    for (const [m, r] of [['GET', '/admin/solicitudes'], ['POST', `/admin/solicitudes/${a.json.solicitud._id}/aprobar`], ['POST', `/admin/solicitudes/${a.json.solicitud._id}/rechazar`]]) assert.equal((await pedir(m, r, { token: u.token })).status, 403);
    const l = await pedir('GET', '/admin/solicitudes?estado=pendiente', { token: admin.token });
    assert.equal(l.status, 200); assert.ok(l.json.solicitudes.some((s) => s._id === a.json.solicitud._id));
    assert.equal((await pedir('GET', '/admin/solicitudes?estado=zzz', { token: admin.token })).status, 400);
    assert.ok((await pedir('GET', '/admin/resumen', { token: admin.token })).json.resumen.solicitudesPendientes >= 3);
    const ap = await pedir('POST', `/admin/solicitudes/${a.json.solicitud._id}/aprobar`, { token: admin.token });
    assert.equal(ap.status, 200); assert.equal(ap.json.saldo, 20000);
    assert.equal((await pedir('POST', `/admin/solicitudes/${a.json.solicitud._id}/aprobar`, { token: admin.token })).status, 409);
    assert.equal((await pedir('POST', `/admin/solicitudes/${a.json.solicitud._id}/rechazar`, { token: admin.token })).status, 409);
    assert.equal(await saldo(), 20000, 'aprobar dos veces no duplica el saldo');
    assert.equal((await pedir('POST', `/admin/solicitudes/${b.json.solicitud._id}/rechazar`, { token: admin.token })).status, 200);
    assert.equal(await saldo(), 20000);
    const resto = (await pedir('GET', '/transacciones/solicitudes', { token: u.token })).json.solicitudes.find((x) => x.estado === 'pendiente');
    await User.updateOne({ _id: u.id }, { activo: false });
    assert.equal((await pedir('POST', `/admin/solicitudes/${resto._id}/aprobar`, { token: admin.token })).status, 404);
    await User.updateOne({ _id: u.id }, { activo: true });
    assert.equal((await pedir('POST', `/admin/solicitudes/${resto._id}/aprobar`, { token: admin.token })).status, 200, 'sigue pendiente tras el fallo');
  });
  it('el registro público no puede crear admins aunque envíe "rol"', async () => {
    const r = await pedir('POST', '/auth/registro', { cuerpo: { ...datosUsuario(55), rol: 'admin' } });
    assert.equal(r.status, 201);
    assert.equal((await User.findOne({ alias: 'usuario55' })).rol, 'estudiante');
  });
});

describe('9. Archivos subidos y previsualizaciones', () => {
  let vendedor, comprador, otro, admin, id;
  const campos = (extra = {}) => ({ titulo: 'Con archivo', descripcion: 'Incluye PDF', materia: 'Algoritmos', profesor: 'Ana Gomez', tipo: 'Guia', precio: 2000, ...extra });
  const archivosOk = () => [
    { campo: 'archivo', nombre: 'mi guía.pdf', contenido: PDF },
    { campo: 'previews', nombre: 'a.png', contenido: PNG },
    { campo: 'previews', nombre: 'b.jpg', contenido: JPG }
  ];
  before(async () => {
    vendedor = await registrarYLogin(60); comprador = await registrarYLogin(61); otro = await registrarYLogin(62); admin = await crearAdmin(63);
    await recargar(admin, comprador.id, 10000);
  });

  it('publicar con archivo exige sesión (401)', async () => {
    assert.equal((await pedirForm('POST', '/feed/publicar', { campos: campos(), archivos: archivosOk() })).status, 401);
  });

  it('publica un PDF con 2 previsualizaciones; la API no revela el nombre interno ni el enlace', async () => {
    const r = await pedirForm('POST', '/feed/publicar', { token: vendedor.token, campos: campos(), archivos: archivosOk() });
    assert.equal(r.status, 201, JSON.stringify(r.json));
    id = r.json.material._id;
    assert.equal(r.json.material.previews.length, 2);
    assert.equal(r.json.material.archivo.nombre, 'mi guía.pdf');
    assert.equal(JSON.stringify(r.json).includes('nombre_guardado'), false);
    const detalle = await pedir('GET', `/feed/${id}`);
    assert.equal(JSON.stringify(detalle.json).includes('nombre_guardado'), false);
    assert.equal(detalle.json.material.previews.length, 2);
    const docs = fs.readdirSync(path.join(process.env.UPLOADS_DIR, 'archivos'));
    assert.ok(docs.every((n) => !n.includes('guía')), 'el nombre en disco lo genera el servidor');
  });

  it('las previsualizaciones son públicas y se sirven como imagen', async () => {
    const r = await pedirForm('GET', `/feed/${id}/preview/0`, {});
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('content-type'), 'image/png');
    assert.equal(r.headers.get('cross-origin-resource-policy'), 'cross-origin');
    assert.equal((await pedirForm('GET', `/feed/${id}/preview/1`, {})).headers.get('content-type'), 'image/jpeg');
    assert.equal((await pedirForm('GET', `/feed/${id}/preview/2`, {})).status, 404);
    assert.equal((await pedirForm('GET', `/feed/${id}/preview/x`, {})).status, 404);
  });

  it('el archivo NO se descarga sin comprar (403 / 401); el autor sí', async () => {
    assert.equal((await pedirForm('GET', `/feed/${id}/descargar`, {})).status, 401);
    assert.equal((await pedirForm('GET', `/feed/${id}/descargar`, { token: otro.token })).status, 403);
    assert.equal((await pedir('GET', `/feed/${id}/archivo`, { token: otro.token })).status, 403);
    const r = await pedirForm('GET', `/feed/${id}/descargar`, { token: vendedor.token });
    assert.equal(r.status, 200);
    assert.deepEqual(r.buffer, PDF);
    assert.match(r.headers.get('content-disposition'), /attachment/);
  });

  it('tras comprar, el comprador descarga el archivo y /archivo informa sus datos', async () => {
    const c = await pedir('POST', `/transacciones/comprar/${id}`, { token: comprador.token });
    assert.equal(c.status, 201);
    assert.equal(c.json.tiene_archivo, true);
    const info = await pedir('GET', `/feed/${id}/archivo`, { token: comprador.token });
    assert.equal(info.json.archivo.nombre, 'mi guía.pdf');
    assert.equal(info.json.archivo_url, undefined);
    assert.deepEqual((await pedirForm('GET', `/feed/${id}/descargar`, { token: comprador.token })).buffer, PDF);
  });

  it('rechaza lo que no es lo que dice ser: .exe, PDF falso y SVG (400)', async () => {
    const malos = [
      { campo: 'archivo', nombre: 'virus.exe', contenido: Buffer.concat([Buffer.from('MZ'), Buffer.alloc(50)]) },
      { campo: 'archivo', nombre: 'falso.pdf', contenido: Buffer.from('<html><script>alert(1)</script></html>') },
      { campo: 'previews', nombre: 'x.svg', contenido: Buffer.from('<svg onload="alert(1)"/>') }
    ];
    for (const a of malos) {
      const r = await pedirForm('POST', '/feed/publicar', { token: vendedor.token, campos: campos(), archivos: [a] });
      assert.equal(r.status, 400, a.nombre);
    }
  });

  it('rechaza más de 2 previsualizaciones (400) y archivos demasiado grandes (413)', async () => {
    const tres = [...archivosOk(), { campo: 'previews', nombre: 'c.png', contenido: PNG }];
    assert.equal((await pedirForm('POST', '/feed/publicar', { token: vendedor.token, campos: campos(), archivos: tres })).status, 400);
    const grande = [{ campo: 'previews', nombre: 'g.png', contenido: Buffer.concat([PNG, Buffer.alloc(4 * 1024 * 1024)]) }];
    assert.equal((await pedirForm('POST', '/feed/publicar', { token: vendedor.token, campos: campos(), archivos: grande })).status, 413);
  });

  it('sin enlace ni archivo no se publica (400); con datos inválidos tampoco, y no queda nada en disco', async () => {
    const antes = fs.readdirSync(path.join(process.env.UPLOADS_DIR, 'archivos')).length;
    assert.equal((await pedirForm('POST', '/feed/publicar', { token: vendedor.token, campos: campos(), archivos: [] })).status, 400);
    const r = await pedirForm('POST', '/feed/publicar', { token: vendedor.token, campos: campos({ precio: -5 }), archivos: archivosOk() });
    assert.equal(r.status, 400);
    assert.equal(fs.readdirSync(path.join(process.env.UPLOADS_DIR, 'archivos')).length, antes);
  });

  it('un material puede tener solo enlace, como antes (JSON)', async () => {
    const r = await pedir('POST', '/feed/publicar', { token: vendedor.token, cuerpo: materialValido() });
    assert.equal(r.status, 201);
    assert.deepEqual(r.json.material.previews, []);
  });

  it('solo el autor edita; subir un archivo nuevo reemplaza al anterior en disco', async () => {
    const antes = fs.readdirSync(path.join(process.env.UPLOADS_DIR, 'archivos'));
    const viejo = (await Material.findById(id)).archivo.nombre_guardado;
    const ajeno = await pedirForm('PUT', `/feed/${id}`, { token: otro.token, campos: campos(), archivos: [{ campo: 'archivo', nombre: 'n.pdf', contenido: PDF }] });
    assert.equal(ajeno.status, 403);
    assert.deepEqual(fs.readdirSync(path.join(process.env.UPLOADS_DIR, 'archivos')), antes, 'un intento ajeno no deja archivos');

    const r = await pedirForm('PUT', `/feed/${id}`, { token: vendedor.token, campos: campos({ titulo: 'Con archivo v2' }), archivos: [{ campo: 'archivo', nombre: 'nuevo.pdf', contenido: PDF }] });
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.equal(r.json.material.archivo.nombre, 'nuevo.pdf');
    assert.ok(!fs.existsSync(path.join(process.env.UPLOADS_DIR, 'archivos', viejo)), 'el archivo anterior se borra');
    assert.equal(fs.readdirSync(path.join(process.env.UPLOADS_DIR, 'archivos')).length, antes.length);
  });

  it('al eliminar el material se borran sus archivos del disco', async () => {
    const m = await Material.findById(id);
    const doc = path.join(process.env.UPLOADS_DIR, 'archivos', m.archivo.nombre_guardado);
    const prev = path.join(process.env.UPLOADS_DIR, 'previews', m.previews[0]);
    assert.ok(fs.existsSync(doc) && fs.existsSync(prev));
    assert.equal((await pedir('DELETE', `/feed/${id}`, { token: vendedor.token })).status, 200);
    assert.ok(!fs.existsSync(doc) && !fs.existsSync(prev));
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

describe('7. Sesión: access token, refresh con rotación y logout', () => {
  const ORIGEN = 'http://localhost:5173';
  let n = 70;
  const nuevoLogin = async () => registrarYLogin(++n);

  it('el login entrega el refresh token en una cookie HttpOnly, SameSite=Strict y limitada a /api/auth', async () => {
    const { cookie } = await nuevoLogin();
    assert.ok(cookie, 'debe haber cookie refreshToken');
    const l = await pedir('POST', '/auth/login', {
      cuerpo: { email_institucional: datosUsuario(n).email_institucional, password: 'Clave12345' }
    });
    const c = l.setCookie.find((x) => x.startsWith('refreshToken='));
    assert.match(c, /HttpOnly/i);
    assert.match(c, /SameSite=Strict/i);
    assert.match(c, /Path=\/api\/auth/i);
  });

  it('el refresh token se guarda hasheado en MongoDB (nunca en claro)', async () => {
    const { cookie, id } = await nuevoLogin();
    const valor = cookie.split('=')[1];
    const sesiones = await Session.find({ usuario: id });
    assert.equal(sesiones.length, 1);
    assert.notEqual(sesiones[0].tokenHash, valor);
    assert.equal(sesiones[0].tokenHash.length, 64);
  });

  it('refresh sin cookie responde 401', async () => {
    assert.equal((await pedir('POST', '/auth/refresh')).status, 401);
  });

  it('refresh con cookie falsa o firmada con otro secreto responde 401', async () => {
    assert.equal((await pedir('POST', '/auth/refresh', { cookie: 'refreshToken=basura' })).status, 401);
    const falso = jwt.sign({ sub: '507f1f77bcf86cd799439011', sid: 'x' }, 'otro-secreto-cualquiera', { expiresIn: 60 });
    assert.equal((await pedir('POST', '/auth/refresh', { cookie: `refreshToken=${falso}` })).status, 401);
  });

  it('refresh válido: nuevo access token, usuario con saldo y refresh ROTADO (cookie distinta)', async () => {
    const s = await nuevoLogin();
    const r = await pedir('POST', '/auth/refresh', { cookie: s.cookie, origen: ORIGEN });
    assert.equal(r.status, 200);
    assert.ok(r.json.accessToken);
    assert.equal(r.json.usuario.billetera.saldo, 0);
    const nueva = cookieRefresh(r);
    assert.ok(nueva);
    assert.notEqual(nueva, s.cookie);
    // el access token nuevo sirve en una ruta protegida
    assert.equal((await pedir('GET', '/auth/yo', { token: r.json.accessToken })).status, 200);
    // y la cookie nueva se puede volver a usar (cadena de rotaciones)
    assert.equal((await pedir('POST', '/auth/refresh', { cookie: nueva })).status, 200);
  });

  it('dos refresh casi simultáneos con el mismo token no cierran la sesión (tolerancia de pestañas / StrictMode)', async () => {
    const s = await nuevoLogin();
    const [a, b] = await Promise.all([
      pedir('POST', '/auth/refresh', { cookie: s.cookie }),
      pedir('POST', '/auth/refresh', { cookie: s.cookie })
    ]);
    assert.equal(a.status, 200);
    assert.equal(b.status, 200);
    const rotada = cookieRefresh(a) || cookieRefresh(b);
    assert.ok(rotada, 'una de las dos respuestas rota la cookie');
    assert.equal((await pedir('POST', '/auth/refresh', { cookie: rotada })).status, 200, 'la cookie nueva sigue vigente');
  });

  it('reutilizar un refresh token viejo (fuera de la tolerancia) revoca TODA la sesión', async () => {
    const s = await nuevoLogin();
    const rotado = await pedir('POST', '/auth/refresh', { cookie: s.cookie });
    const vigente = cookieRefresh(rotado);
    const previa = process.env.REFRESH_GRACIA_MS;
    process.env.REFRESH_GRACIA_MS = '0';
    try {
      const robo = await pedir('POST', '/auth/refresh', { cookie: s.cookie }); // token ya usado
      assert.equal(robo.status, 401);
      // la cookie legítima también queda inutilizada: la cadena completa fue revocada
      assert.equal((await pedir('POST', '/auth/refresh', { cookie: vigente })).status, 401);
    } finally {
      if (previa === undefined) delete process.env.REFRESH_GRACIA_MS; else process.env.REFRESH_GRACIA_MS = previa;
    }
    assert.equal(await Session.countDocuments({ usuario: s.id }), 0);
  });

  it('logout real: borra la sesión en MongoDB, limpia la cookie y el refresh deja de funcionar', async () => {
    const s = await nuevoLogin();
    const out = await pedir('POST', '/auth/logout', { cookie: s.cookie, origen: ORIGEN });
    assert.equal(out.status, 200);
    const limpia = out.setCookie.find((x) => x.startsWith('refreshToken='));
    assert.match(limpia, /(Max-Age=0|Expires=Thu, 01 Jan 1970)/i);
    assert.equal(await Session.countDocuments({ usuario: s.id }), 0);
    assert.equal((await pedir('POST', '/auth/refresh', { cookie: s.cookie })).status, 401);
  });

  it('logout sin sesión responde 200 igualmente (idempotente)', async () => {
    assert.equal((await pedir('POST', '/auth/logout')).status, 200);
  });

  it('refresh y logout rechazan un Origin que no es el del frontend (403)', async () => {
    const s = await nuevoLogin();
    assert.equal((await pedir('POST', '/auth/refresh', { cookie: s.cookie, origen: 'http://sitio-malo.com' })).status, 403);
    assert.equal((await pedir('POST', '/auth/logout', { cookie: s.cookie, origen: 'http://sitio-malo.com' })).status, 403);
    assert.equal((await pedir('POST', '/auth/refresh', { cookie: s.cookie, origen: ORIGEN })).status, 200);
  });

  it('access token vencido: 401 TOKEN_EXPIRADO; uno firmado con el secreto del refresh no sirve', async () => {
    const s = await nuevoLogin();
    const vencido = jwt.sign({ id: s.id }, process.env.ACCESS_SECRET, { expiresIn: -10 });
    const r1 = await pedir('GET', '/auth/yo', { token: vencido });
    assert.equal(r1.status, 401);
    assert.equal(r1.json.codigo, 'TOKEN_EXPIRADO');
    const confundido = jwt.sign({ id: s.id }, process.env.REFRESH_SECRET, { expiresIn: 60 });
    assert.equal((await pedir('GET', '/auth/yo', { token: confundido })).status, 401);
    // y un refresh token tampoco sirve como access token
    assert.equal((await pedir('GET', '/auth/yo', { token: s.cookie.split('=')[1] })).status, 401);
  });

  it('un usuario desactivado no puede renovar y pierde todas sus sesiones (403)', async () => {
    const s = await nuevoLogin();
    await User.updateOne({ _id: s.id }, { activo: false });
    assert.equal((await pedir('POST', '/auth/refresh', { cookie: s.cookie })).status, 403);
    assert.equal(await Session.countDocuments({ usuario: s.id }), 0);
  });

  it('solo se conservan las 5 sesiones más recientes por usuario', async () => {
    const s = await nuevoLogin();
    for (let i = 0; i < 6; i++) {
      await pedir('POST', '/auth/login', { cuerpo: { email_institucional: datosUsuario(n).email_institucional, password: 'Clave12345' } });
    }
    assert.equal(await Session.countDocuments({ usuario: s.id }), 5);
  });
});
