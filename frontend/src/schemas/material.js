import { z } from 'zod';

export const TIPOS = ['Taller', 'Parcial', 'Guia', 'Resumen'];

// Mismas reglas que validators/index.js del backend. El enlace es opcional (el material puede ser un archivo subido);
// que haya al menos uno de los dos lo comprueba MaterialForm.
export const materialSchema = () => z.object({
  titulo: z.string().min(3, 'Mínimo 3 caracteres').max(120, 'Máximo 120 caracteres'),
  descripcion: z.string().min(1, 'Describe el material').max(2000, 'Máximo 2000 caracteres'),
  materia: z.string().min(1, 'Escribe la materia').max(80),
  profesor: z.string().min(1, 'Escribe el profesor').max(80),
  tipo: z.enum(TIPOS),
  precio: z.coerce.number({ invalid_type_error: 'Escribe un precio' }).int('Usa un número entero').min(0, 'No puede ser negativo').max(500000, 'Máximo $500.000'),
  archivo_url: z.string().max(500, 'Máximo 500 caracteres').refine((v) => v === '' || v.startsWith('https://'), 'Pega un enlace que empiece con https://'),
});

export const rechargeSchema = z.object({
  monto: z.coerce.number({ invalid_type_error: 'Escribe un monto' }).int('Usa un número entero').min(1000, 'Mínimo $1.000').max(2000000, 'Máximo $2.000.000'),
  descripcion: z.string().max(200, 'Máximo 200 caracteres').optional(),
});

export const profesorSchema = z.object({
  nombre: z.string().trim().min(3, 'Mínimo 3 caracteres').max(100, 'Máximo 100 caracteres'),
  facultad: z.string().trim().min(2, 'Escribe la facultad').max(100, 'Máximo 100 caracteres'),
  materia: z.string().trim().min(2, 'Escribe la materia').max(100, 'Máximo 100 caracteres'),
});

export const solicitudSchema = z.object({
  monto: z.string().trim().min(1, 'Escribe el monto que necesitas').pipe(z.coerce.number({ invalid_type_error: 'Escribe un monto válido' }).int('Usa un número entero').min(1000, 'Mínimo $1.000').max(2000000, 'Máximo $2.000.000')),
  nota: z.string().max(200, 'Máximo 200 caracteres').optional(),
});
