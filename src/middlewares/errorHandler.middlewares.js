import { zodIssueList } from '../lib/zod-issues.js'

export const globalErrorHandler = (
    err, req, res, next
) => {
    const isProduction = process.env.NODE_ENV === 'production'
    if (!isProduction && !err.statusCode) {
        console.error(`[ERROR] ${new Date().toISOString()} - ${req.method} ${req.originalUrl}`)
        console.error(err.message)
        console.error(err.stack)
    }

    const isZod = err?.name === 'ZodError' || err?.constructor?.name === 'ZodError'
    if (isZod) {
        const details = Array.isArray(err.issues) ? zodIssueList(err) : []
        return res.status(400).json({
            success: false,
            error: {
                code: 'VALIDATION_ERROR',
                details,
            },
            message: 'Error de validación',
        })
    }

    if (err.constructor?.name === 'PrismaClientKnownRequestError' || err.code?.startsWith?.('P')) {
        if (err.code === 'P2002') {
            const target = err.meta?.target || []
            const fields = Array.isArray(target) ? target.join(', ') : target

            return res.status(409).json({
                success: false,
                error: {
                    code: 'CONFLICT',
                    details: [{
                        field: fields,
                        message: `Ya existe un registro con ese valor de ${fields}`,
                    }],
                },
                message: `El valor de ${fields} ya está registrado`,
            })
        }

        if (err.code === 'P2025') {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'NOT_FOUND',
                    details: [],
                },
                message: 'Registro no encontrado',
            })
        }
    }

    if (err.message === 'Invalid credentials') {
        return res.status(401).json({
            success: false,
            error: { code: 'INVALID_CREDENTIALS', details: [] },
            message: 'Credenciales inválidas',
        })
    }

    if (err.message === 'User already exists') {
        return res.status(409).json({
            success: false,
            error: { code: 'CONFLICT', details: [] },
            message: 'El usuario ya existe',
        })
    }

    if (err.statusCode) {
        return res.status(err.statusCode).json({
            success: false,
            error: { code: 'REQUEST_ERROR', details: [] },
            message: err.message || 'Error en la solicitud',
        })
    }

    res.status(500).json({
        success: false,
        error: {
            code: 'INTERNAL_ERROR',
            details: [],
        },
        message: 'Error interno del servidor',
    })
}
