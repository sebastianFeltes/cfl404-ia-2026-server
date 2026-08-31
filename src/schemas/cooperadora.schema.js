import { z } from 'zod'

/**
 * Esquema de validación para registrar o actualizar un pago de cuota de Cooperadora
 */
export const savePaymentSchema = z.object({
  studentId: z.string({
    required_error: 'El ID del alumno es obligatorio',
  }).min(1, 'El ID del alumno no puede estar vacío'),
  month: z.coerce
    .number({
      required_error: 'El mes es obligatorio',
    })
    .int()
    .min(1, 'El mes debe estar entre 1 y 12')
    .max(12, 'El mes debe estar entre 1 y 12'),
  year: z.coerce
    .number()
    .int()
    .min(2020, 'El año debe ser válido')
    .default(() => new Date().getFullYear()),
  amount: z.coerce
    .number({
      required_error: 'El monto es obligatorio',
    })
    .min(2000, 'El pago mínimo de cooperadora debe ser de $2.000'),
  date: z.string().optional().nullable(),
  notes: z.string().optional().nullable().default(''),
})

/**
 * Esquema de validación para registrar un movimiento de Buffet (ingreso o egreso)
 */
export const createBuffetSchema = z.object({
  fecha: z.string().optional().nullable(),
  date: z.string().optional().nullable(),
  monto: z.coerce
    .number({
      required_error: 'El monto es obligatorio',
    })
    .positive('El monto debe ser un número positivo mayor a 0'),
  tipo: z.enum(['ingreso', 'egreso'], {
    required_error: 'El tipo debe ser "ingreso" o "egreso"',
  }),
  detalle: z
    .string({
      required_error: 'El detalle o concepto es obligatorio',
    })
    .min(2, 'El detalle debe contener al menos 2 caracteres')
    .trim(),
  observaciones: z.string().optional().nullable().default(''),
})
