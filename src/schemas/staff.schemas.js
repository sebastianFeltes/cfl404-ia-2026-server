import { z } from 'zod'
import { stripText } from '../lib/profile-input.js'

// Schema para crear un nuevo instructor (POST)
export const createStaffSchema = z.object({
    first_name: z
        .string({ required_error: 'El nombre es obligatorio' })
        .transform(stripText)
        .pipe(z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(80, 'El nombre no puede exceder 80 caracteres')),
    last_name: z
        .string({ required_error: 'El apellido es obligatorio' })
        .transform(stripText)
        .pipe(z.string().min(2, 'El apellido debe tener al menos 2 caracteres').max(80, 'El apellido no puede exceder 80 caracteres')),
    email: z
        .string({ required_error: 'El email es obligatorio' })
        .email('El email no es válido')
        .trim()
        .toLowerCase(),
    dni: z
        .string({ required_error: 'El DNI es obligatorio' })
        .transform((value) => String(value).replace(/\D/g, ''))
        .pipe(z.string().regex(/^\d{7,8}$/, 'El DNI debe tener 7 u 8 dígitos')),
    status_id: z
        .number({ required_error: 'El estado es obligatorio' })
        .int('El estado debe ser un número entero')
        .refine(val => [1, 2, 3].includes(val), {
            message: 'El estado debe ser 1 (Activo), 2 (Inactivo) o 3 (Licencia)'
        }),
    role_id: z
        .number()
        .int('El rol debe ser un número entero')
        .refine((val) => [1, 2, 3, 4, 5, 6, 7].includes(val), {
            message: 'El rol debe ser un rol de personal válido',
        })
        .optional()
        .default(7),
    phone: z
        .string()
        .transform((value) => stripText(value).replace(/\D/g, ''))
        .pipe(z.string().refine((value) => value === '' || (value.length >= 8 && value.length <= 15), {
            message: 'El teléfono debe tener entre 8 y 15 dígitos',
        }))
        .optional()
        .nullable(),
    address: z
        .string()
        .transform(stripText)
        .pipe(z.string().max(160, 'La dirección no puede exceder 160 caracteres'))
        .optional()
        .nullable(),
    profile_photo_url: z
        .string()
        .max(2048, 'La URL de la foto no puede exceder 2048 caracteres')
        .url('La URL de la foto no es válida')
        .or(z.literal(''))
        .optional()
        .nullable(),
    assigned_course_ids: z
        .array(z.string())
        .max(50, 'No se pueden asignar más de 50 cursos')
        .optional()
        .nullable(),
})

// Schema para actualizar un instructor (PUT) - todos los campos opcionales
export const updateStaffSchema = createStaffSchema
    .partial()
    .refine(
        (data) => Object.keys(data).length > 0,
        { message: 'Debe enviar al menos un campo para actualizar' }
    )

// Schema para validar el parámetro :id (UUID)
export const idParamSchema = z.object({
    id: z
        .string({ required_error: 'El ID es obligatorio' })
        .uuid('El ID debe ser un UUID válido'),
})
