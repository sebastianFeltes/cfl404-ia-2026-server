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

/**
 * Middleware genérico de validación con Zod.
 * 
 * @param {import('zod').ZodSchema} schema - Schema de Zod para validar.
 * @param {'body' | 'params' | 'query'} target - Parte del request a validar.
 * @returns {import('express').RequestHandler}
 * 
 * @example
 * router.post('/', validate(createStaffSchema, 'body'), controller)
 * router.get('/:id', validate(idParamSchema, 'params'), controller)
 */
export const validate = (schema, target = 'body') => {
    return (req, res, next) => {
        const result = schema.safeParse(req[target])

        if (!result.success) {
            const details = result.error.issues.map((issue) => ({
                field: issue.path.join('.'),
                message: issue.message,
            }))

            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    details,
                },
                message: 'Error de validación',
            })
        }

        // Reemplazar con los datos parseados y sanitizados por Zod
        req[target] = result.data
        next()
    }
}
