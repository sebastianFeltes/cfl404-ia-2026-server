import { z } from 'zod'

// Schema para crear un nuevo instructor (POST)
export const createStaffSchema = z.object({
    first_name: z
        .string({ required_error: 'El nombre es obligatorio' })
        .min(2, 'El nombre debe tener al menos 2 caracteres')
        .max(100, 'El nombre no puede exceder 100 caracteres')
        .trim(),
    last_name: z
        .string({ required_error: 'El apellido es obligatorio' })
        .min(2, 'El apellido debe tener al menos 2 caracteres')
        .max(100, 'El apellido no puede exceder 100 caracteres')
        .trim(),
    email: z
        .string({ required_error: 'El email es obligatorio' })
        .email('El email no es válido')
        .trim()
        .toLowerCase(),
    dni: z
        .string({ required_error: 'El DNI es obligatorio' })
        .min(6, 'El DNI debe tener al menos 6 caracteres')
        .max(20, 'El DNI no puede exceder 20 caracteres')
        .trim(),
    status_id: z
        .number({ required_error: 'El estado es obligatorio' })
        .int('El estado debe ser un número entero')
        .refine(val => [1, 2, 3].includes(val), {
            message: 'El estado debe ser 1 (Activo), 2 (Inactivo) o 3 (Licencia)'
        }),
    role_id: z
        .number()
        .int('El rol debe ser un número entero')
        .positive('El rol debe ser un número positivo')
        .optional()
        .default(7),
    phone: z
        .string()
        .max(30, 'El teléfono no puede exceder 30 caracteres')
        .trim()
        .optional()
        .nullable(),
    address: z
        .string()
        .max(200, 'La dirección no puede exceder 200 caracteres')
        .trim()
        .optional()
        .nullable(),
    profile_photo_url: z
        .string()
        .url('La URL de la foto no es válida')
        .or(z.literal(''))
        .optional()
        .nullable(),
    assigned_course_ids: z
        .array(z.string())
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
