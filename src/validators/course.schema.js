import { z } from 'zod'
import { validateCourseStageDates } from '../lib/courseStage.js'

const optionalDate = z.string().min(1).optional().nullable()
const optionalTime = z.string().max(20).optional().nullable()
const coerceInt = z.coerce.number().int()

const courseDatesRefine = (data, ctx) => {
  if (!data.startDate && !data.endDate && data.isAnnual === undefined) return
  if (!data.startDate || !data.endDate) return
  const message = validateCourseStageDates({
    startDate: data.startDate,
    endDate: data.endDate,
    isAnnual: Boolean(data.isAnnual),
  })
  if (message) {
    ctx.addIssue({
      code: 'custom',
      path: ['startDate'],
      message,
    })
  }
}

/**
 * Esquema Zod de validación para la creación de un Curso
 */
export const createCourseSchema = z.object({
  name: z.string({
    required_error: 'El nombre del curso es obligatorio',
  }).min(3, 'El nombre debe tener al menos 3 caracteres'),

  familyId: coerceInt.min(1, 'Seleccioná una familia de curso'),

  instructorId: z.string().min(1, 'Seleccioná un instructor').optional(),

  description: z.string().min(5, 'La descripción debe tener al menos 5 caracteres').max(4000).optional().nullable(),

  quota: coerceInt.min(1, 'El cupo debe ser un número entero mayor a 0').optional(),

  hourQuantity: coerceInt.min(1, 'La cantidad de horas debe ser mayor a 0').optional(),

  classesQuantity: coerceInt.min(1, 'La cantidad de clases debe ser mayor a 0').optional(),

  statusId: coerceInt.min(1).max(4).optional(),

  maxAbsences: coerceInt.min(0).optional(),

  startTime: optionalTime,
  endTime: optionalTime,
  startDate: z.string().min(1, 'La fecha de inicio es obligatoria'),
  endDate: z.string().min(1, 'La fecha de fin es obligatoria'),
  preEnrollmentDate: optionalDate,
  isAnnual: z.coerce.boolean().optional(),
  titleRequired: z.coerce.boolean().optional(),
  endorsementBy: z.string().max(200).optional().nullable(),
  sponsorName: z.string().max(200).optional().nullable(),
  sponsorLogo: z.string().max(2048).optional().nullable(),
  dayIds: z.array(coerceInt).max(7).optional(),
}).superRefine(courseDatesRefine)

/**
 * Esquema Zod de validación para la edición parcial de un Curso
 */
export const updateCourseSchema = z.object({
  name: z.string().min(3, 'El nombre debe tener al menos 3 caracteres').optional(),
  familyId: coerceInt.min(1).optional().nullable(),
  instructorId: z.string().min(1).optional(),
  description: z.string().min(5).max(4000).optional().nullable(),
  quota: coerceInt.min(1).optional(),
  hourQuantity: coerceInt.min(1).optional(),
  classesQuantity: coerceInt.min(1).optional(),
  statusId: coerceInt.min(1).max(4).optional(),
  maxAbsences: coerceInt.min(0).optional(),
  startTime: optionalTime,
  endTime: optionalTime,
  startDate: optionalDate,
  endDate: optionalDate,
  preEnrollmentDate: optionalDate,
  isAnnual: z.coerce.boolean().optional(),
  titleRequired: z.coerce.boolean().optional(),
  endorsementBy: z.string().max(200).optional().nullable(),
  sponsorName: z.string().max(200).optional().nullable(),
  sponsorLogo: z.string().max(2048).optional().nullable(),
  dayIds: z.array(coerceInt).max(7).optional(),
}).superRefine(courseDatesRefine)
