import { z } from 'zod';

// Solo se aceptan correos de Uniautónoma (misma regla que el backend).
const DOMINIO = '@uniautonoma.edu.co';
export const esCorreoInstitucional = (v) => v.trim().toLowerCase().endsWith(DOMINIO);

const correo = z.string().trim()
  .min(1, 'Escribe tu correo institucional')
  .email('El correo no tiene un formato válido (ej. nombre@uniautonoma.edu.co)');

export const loginSchema = z.object({
  email_institucional: correo,
  password: z.string().min(1, 'Escribe tu contraseña'),
});

export const registerSchema = z.object({
  alias: z.string().trim()
    .min(3, 'El alias debe tener al menos 3 caracteres')
    .max(30, 'El alias no puede pasar de 30 caracteres')
    .regex(/^[\w.-]+$/, 'El alias solo puede tener letras, números, guion, guion bajo y punto'),
  nombre_real: z.string().trim().min(3, 'Escribe tu nombre completo (mínimo 3 caracteres)').max(100, 'Máximo 100 caracteres'),
  documento_identidad: z.string().trim().min(5, 'El documento debe tener al menos 5 caracteres').max(20, 'El documento no puede pasar de 20 caracteres'),
  email_institucional: correo.refine(esCorreoInstitucional, `Debes usar tu correo institucional ${DOMINIO}`),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres').max(72, 'La contraseña no puede pasar de 72 caracteres'),
  confirmPassword: z.string().min(1, 'Confirma tu contraseña'),
}).refine((d) => d.password === d.confirmPassword, { message: 'Las contraseñas no coinciden', path: ['confirmPassword'] });
