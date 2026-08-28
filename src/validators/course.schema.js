import { z } from 'zod'

/**
 * Esquema Zod de validación para la creación de un Curso
 */
export const createCourseSchema = z.object({
  name: z.string({
    required_error: 'El nombre del curso es obligatorio'
  }).min(3, 'El nombre debe tener al menos 3 caracteres'),
  
  category: z.enum(['Oficios', 'Tecnología', 'Emprendimiento', 'Servicios', 'Administración']).optional(),
  
  description: z.string().min(5, 'La descripción debe tener al menos 5 caracteres').optional(),
  
  quota: z.number().int().min(1, 'El cupo debe ser un número entero mayor a 0').or(z.string().transform(Number)).optional(),
  
  hourQuantity: z.number().int().min(1, 'La cantidad de horas debe ser mayor a 0').or(z.string().transform(Number)).optional(),
  
  classesQuantity: z.number().int().min(1, 'La cantidad de clases debe ser mayor a 0').or(z.string().transform(Number)).optional(),
  
  statusId: z.number().int().min(1).max(4).or(z.string().transform(Number)).optional(),
  
  maxAbsences: z.number().int().min(0).or(z.string().transform(Number)).optional(),
  
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  staffId: z.string().optional()
})

/**
 * Esquema Zod de validación para la edición parcial de un Curso
 */
export const updateCourseSchema = createCourseSchema.partial()
