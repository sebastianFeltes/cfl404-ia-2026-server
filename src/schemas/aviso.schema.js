import { z } from 'zod'

const types = ['operativo', 'informativo', 'academico']
const audiences = ['todos', 'alumnos']
const publications = ['borrador', 'publicado', 'archivado']

const dateField = z.union([z.string(), z.null()]).optional()

function validDate(value) {
  if (value == null || value === '') return true
  return !Number.isNaN(Date.parse(value))
}

function windowIsValid(data, ctx) {
  if (!validDate(data.startsAt)) {
    ctx.addIssue({ code: 'custom', path: ['startsAt'], message: 'Fecha inválida' })
  }
  if (!validDate(data.endsAt)) {
    ctx.addIssue({ code: 'custom', path: ['endsAt'], message: 'Fecha inválida' })
  }
  if (data.startsAt && data.endsAt && Date.parse(data.endsAt) <= Date.parse(data.startsAt)) {
    ctx.addIssue({ code: 'custom', path: ['endsAt'], message: 'endsAt debe ser posterior a startsAt' })
  }
}

export const createAvisoSchema = z.object({
  title: z.string().trim().min(1),
  body: z.string().trim().min(1),
  type: z.enum(types),
  audience: z.enum(audiences),
  courseId: z.string().trim().nullable().optional(),
  priority: z.coerce.number().int().optional(),
  publication: z.enum(publications).optional(),
  startsAt: dateField,
  endsAt: dateField,
}).superRefine(windowIsValid)

export const updateAvisoSchema = z.object({
  title: z.string().trim().min(1).optional(),
  body: z.string().trim().min(1).optional(),
  type: z.enum(types).optional(),
  audience: z.enum(audiences).optional(),
  courseId: z.string().trim().nullable().optional(),
  priority: z.coerce.number().int().optional(),
  publication: z.enum(publications).optional(),
  startsAt: dateField,
  endsAt: dateField,
}).superRefine(windowIsValid)
