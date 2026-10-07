// Validadores de entrada. Cada uno devuelve { error } o { data } (datos limpios).

const texto = (v, min, max) =>
  typeof v === 'string' && v.trim().length >= min && v.trim().length <= max;

const urlHttps = (v) => {
  try {
    return new URL(v).protocol === 'https:';
  } catch {
    return false;
  }
};

export const DOMINIOS_PERMITIDOS = ['@unicauca.edu.co', '@uniautonoma.edu.co'];
export const TIPOS_MATERIAL = ['Taller', 'Parcial', 'Guia', 'Resumen'];

export const validarRegistro = (b = {}) => {
  const correo = b.email_institucional ?? b.email;
  const documento = typeof b.documento_identidad === 'number' ? String(b.documento_identidad) : b.documento_identidad;

  if (!texto(b.alias, 3, 30) || !/^[\w.-]+$/.test(b.alias.trim())) {
    return { error: 'Alias inválido (3 a 30 caracteres: letras, números, _ . -)' };
  }
  if (!texto(correo, 5, 100)) return { error: 'El correo es obligatorio' };
  const email = correo.trim().toLowerCase();
  if (!DOMINIOS_PERMITIDOS.some((d) => email.endsWith(d))) {
    return { error: 'Debes utilizar un correo institucional válido' };
  }
  if (!texto(b.nombre_real, 3, 100)) return { error: 'El nombre real es obligatorio' };
  if (!texto(documento, 5, 20)) return { error: 'El documento de identidad no es válido' };
  if (typeof b.password !== 'string' || b.password.length < 8 || b.password.length > 72) {
    return { error: 'La contraseña debe tener entre 8 y 72 caracteres' };
  }

  return {
    data: {
      alias: b.alias.trim(),
      email_institucional: email,
      nombre_real: b.nombre_real.trim(),
      documento_identidad: documento.trim(),
      password: b.password
    }
  };
};

export const validarLogin = (b = {}) => {
  const correo = b.email_institucional ?? b.email;
  if (!texto(correo, 5, 100) || typeof b.password !== 'string' || b.password.length === 0 || b.password.length > 72) {
    return { error: 'Por favor ingresa correo y contraseña válidos' };
  }
  return { data: { email_institucional: correo.trim().toLowerCase(), password: b.password } };
};

// parcial = true  -> para actualizar (todos los campos son opcionales, pero al menos uno)
export const validarMaterial = (b = {}, { parcial = false } = {}) => {
  const reglas = {
    titulo: (v) => texto(v, 3, 120),
    descripcion: (v) => texto(v, 1, 2000),
    materia: (v) => texto(v, 1, 80),
    profesor: (v) => texto(v, 1, 80),
    tipo: (v) => TIPOS_MATERIAL.includes(v),
    precio: (v) => Number.isInteger(v) && v >= 0 && v <= 500000,
    archivo_url: (v) => typeof v === 'string' && v.length <= 500 && urlHttps(v)
  };
  const data = {};

  for (const [campo, esValido] of Object.entries(reglas)) {
    const v = b[campo];
    if (v === undefined) {
      if (campo === 'precio') {
        if (!parcial) data.precio = 0;
        continue;
      }
      if (parcial) continue;
      return { error: `El campo "${campo}" es obligatorio` };
    }
    if (!esValido(v)) return { error: `El campo "${campo}" no es válido` };
    data[campo] = typeof v === 'string' ? v.trim() : v;
  }

  if (parcial && Object.keys(data).length === 0) return { error: 'No enviaste campos para actualizar' };
  return { data };
};

export const validarProfesor = (b = {}) => {
  if (!texto(b.nombre, 3, 100) || !texto(b.facultad, 2, 100) || !texto(b.materia, 2, 100)) {
    return { error: 'nombre, facultad y materia son obligatorios y deben ser texto válido' };
  }
  return { data: { nombre: b.nombre.trim(), facultad: b.facultad.trim(), materia: b.materia.trim() } };
};

export const validarRecarga = (b = {}) => {
  if (!Number.isInteger(b.monto) || b.monto < 1000 || b.monto > 2000000) {
    return { error: 'El monto debe ser un entero entre 1.000 y 2.000.000' };
  }
  const descripcion = b.descripcion === undefined ? 'Recarga de saldo' : b.descripcion;
  if (!texto(descripcion, 1, 200)) return { error: 'La descripción no es válida' };
  return { data: { monto: b.monto, descripcion: descripcion.trim() } };
};
