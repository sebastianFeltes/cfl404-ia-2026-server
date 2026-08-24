// Archivo: src/schemas/alumnos.schema.js
import { z } from 'zod'

/**
 * Función auxiliar para validar que un teléfono no sea una secuencia repetitiva o ficticia
 */
function isValidPhoneNumber(phone) {
  if (!phone) return true // Opcional
  const digits = String(phone).replace(/\D/g, '')
  if (digits.length === 0) return true

  // 1. Longitud mínima y máxima válida para teléfonos en Argentina (8 a 13 dígitos)
  if (digits.length < 8 || digits.length > 13) {
    return false
  }

  // 2. Bloqueo de secuencias repetitivas idénticas (ej: 00000000, 11111111, 9999999999)
  if (/^(\d)\1+$/.test(digits)) {
    return false
  }

  // 3. Bloqueo de secuencias triviales consecutivas (ej: 12345678, 98765432)
  const trivialSequences = [
    '0123456789',
    '1234567890',
    '9876543210',
    '876543210',
    '12345678',
    '87654321'
  ]
  if (trivialSequences.some((seq) => seq.includes(digits))) {
    return false
  }

  return true
}

/**
 * Esquema de validación para la creación de un nuevo Alumno con validaciones de seguridad
 */
export const createAlumnoSchema = z
  .object({
    first_name: z
      .string({ required_error: 'El nombre es obligatorio' })
      .min(2, 'El nombre debe tener al menos 2 caracteres')
      .trim(),
    last_name: z
      .string({ required_error: 'El apellido es obligatorio' })
      .min(2, 'El apellido debe tener al menos 2 caracteres')
      .trim(),
    dni: z
      .string({ required_error: 'El DNI es obligatorio' })
      .transform((val) => val.replace(/[\.\s-]/g, ''))
      .refine((val) => /^\d{7,8}$/.test(val), {
        message: 'El DNI debe tener entre 7 y 8 dígitos numéricos',
      }),
    email: z
      .string({ required_error: 'El correo electrónico es obligatorio' })
      .email('El formato del correo electrónico no es válido')
      .trim()
      .toLowerCase(),
    phone: z
      .string()
      .optional()
      .nullable()
      .default('')
      .refine(isValidPhoneNumber, {
        message:
          'El teléfono no es válido (no puede tener menos de 8 dígitos ni ser una secuencia repetitiva como 11111111 o 12345678)',
      }),
    extra_phone: z
      .string()
      .optional()
      .nullable()
      .default('')
      .refine(isValidPhoneNumber, {
        message:
          'El teléfono de emergencia no es válido (no puede ser una secuencia repetitiva o ficticia)',
      }),
    course: z.string().optional().nullable().default(''),
    course_name: z.string().optional().nullable().default(''),
    academic_level: z.string().optional().nullable().default('Secundario'),
    address: z.string().optional().nullable().default(''),
    dob: z.string().optional().nullable().default(''),
    gender: z.string().optional().nullable().default(''),
    nacionality: z.string().optional().nullable().default('Argentina'),
    status: z
      .enum(['Activo', 'Inactivo', 'Pendiente', 'Egresado'])
      .optional()
      .default('Activo'),
    status_id: z.number().optional(),
    role_name: z.string().optional(),
    profile_photo_url: z.string().optional().nullable(),
  })
  // Regla de seguridad: el teléfono principal y el teléfono de emergencia deben ser diferentes
  .refine(
    (data) => {
      if (!data.phone || !data.extra_phone) return true
      const p1 = String(data.phone).replace(/\D/g, '')
      const p2 = String(data.extra_phone).replace(/\D/g, '')
      if (p1.length >= 8 && p2.length >= 8 && p1 === p2) {
        return false
      }
      return true
    },
    {
      message:
        'El teléfono de emergencia/alternativo no puede ser idéntico al teléfono principal del alumno',
      path: ['extra_phone'],
    }
  )

/**
 * Esquema de validación para la actualización de un Alumno
 */
export const updateAlumnoSchema = z
  .object({
    first_name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').trim().optional(),
    last_name: z.string().min(2, 'El apellido debe tener al menos 2 caracteres').trim().optional(),
    dni: z
      .string()
      .transform((val) => val.replace(/[\.\s-]/g, ''))
      .refine((val) => /^\d{7,8}$/.test(val), {
        message: 'El DNI debe tener entre 7 y 8 dígitos numéricos',
      })
      .optional(),
    email: z.string().email('El formato del correo electrónico no es válido').trim().toLowerCase().optional(),
    phone: z.string().optional().nullable().refine(isValidPhoneNumber, {
      message: 'El teléfono no puede ser una secuencia repetitiva o ficticia',
    }),
    extra_phone: z.string().optional().nullable().refine(isValidPhoneNumber, {
      message: 'El teléfono de emergencia no puede ser una secuencia repetitiva o ficticia',
    }),
    course: z.string().optional().nullable(),
    course_name: z.string().optional().nullable(),
    academic_level: z.string().optional().nullable(),
    address: z.string().optional().nullable(),
    dob: z.string().optional().nullable(),
    gender: z.string().optional().nullable(),
    nacionality: z.string().optional().nullable(),
    status: z.enum(['Activo', 'Inactivo', 'Pendiente', 'Egresado']).optional(),
    status_id: z.number().optional(),
    role_name: z.string().optional(),
    profile_photo_url: z.string().optional().nullable(),
  })
  .refine(
    (data) => {
      if (!data.phone || !data.extra_phone) return true
      const p1 = String(data.phone).replace(/\D/g, '')
      const p2 = String(data.extra_phone).replace(/\D/g, '')
      if (p1.length >= 8 && p2.length >= 8 && p1 === p2) {
        return false
      }
      return true
    },
    {
      message: 'El teléfono de emergencia no puede ser idéntico al teléfono principal',
      path: ['extra_phone'],
    }
  )
