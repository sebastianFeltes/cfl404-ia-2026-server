// Archivo: src/middlewares/validateSchema.js
/**
 * Middleware genérico para validación de esquemas Zod en peticiones Express.
 * Intercepta req.body y valida que cumpla la estructura y reglas del esquema.
 * 
 * @param {import('zod').ZodSchema} schema - Esquema Zod a validar
 */
export const validateSchema = (schema) => (req, res, next) => {
  try {
    // Si la validación es exitosa, req.body queda tipado y saneado
    req.body = schema.parse(req.body)
    next()
  } catch (error) {
    return res.status(400).json({
      error: 'Error de validación en los datos enviados',
      detalles: error.errors?.map((err) => ({
        campo: err.path.join('.'),
        mensaje: err.message,
      })) || error.message,
    })
  }
}
