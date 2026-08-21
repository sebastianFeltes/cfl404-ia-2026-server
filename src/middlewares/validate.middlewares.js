/**
 * Middleware genérico para ejecutar la validación de esquemas Zod en Express
 */
export const validateSchema = (schema) => {
  return (req, res, next) => {
    const result = schema.safeParse(req.body)
    
    if (!result.success) {
      const errors = result.error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message
      }))

      return res.status(400).json({
        error: 'Error de validación en los datos del formulario',
        details: errors
      })
    }

    // Sobrescribir req.body con los datos validados y formateados
    req.body = result.data
    next()
  }
}
