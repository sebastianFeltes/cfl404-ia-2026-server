import { zodIssueList } from '../lib/zod-issues.js'

/**
 * Middleware genérico de validación con Zod.
 *
 * @param {import('zod').ZodSchema} schema
 * @param {'body' | 'params' | 'query'} target
 */
export const validate = (schema, target = 'body') => {
    return (req, res, next) => {
        try {
            const result = schema.safeParse(req[target])

            if (!result.success) {
                const details = zodIssueList(result.error)
                return res.status(400).json({
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        details,
                    },
                    message: 'Error de validación',
                    detalles: details.map((item) => ({
                        campo: item.field,
                        mensaje: item.message,
                    })),
                })
            }

            req[target] = result.data
            next()
        } catch {
            return res.status(400).json({
                error: 'Error de validación en los datos enviados',
                message: 'Error de validación',
            })
        }
    }
}

export const validateSchema = (schema) => validate(schema, 'body')
