export const globalErrorHandler = (
    err, req, res, next
) => {
    // Log internal error in English
    console.error(`[ERROR] ${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
    console.error(err.message);
    console.error(err.stack);

    // ── Zod Validation Errors ──────────────────────────────
    if (err.name === 'ZodError') {
        const details = err.issues.map((issue) => ({
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
        });
    }

    // ── Prisma Known Request Errors ────────────────────────
    if (err.constructor?.name === 'PrismaClientKnownRequestError' || err.code?.startsWith?.('P')) {
        // P2002: Unique constraint violation
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
            });
        }

        // P2025: Record not found
        if (err.code === 'P2025') {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'NOT_FOUND',
                    details: [],
                },
                message: 'Registro no encontrado',
            });
        }
    }

    // ── Known Auth Errors (legacy) ─────────────────────────
    if (err.message === 'Invalid credentials') {
        return res.status(401).json({
            success: false,
            error: { code: 'INVALID_CREDENTIALS', details: [] },
            message: 'Credenciales inválidas',
        });
    }

    if (err.message === 'User already exists') {
        return res.status(409).json({
            success: false,
            error: { code: 'CONFLICT', details: [] },
            message: 'El usuario ya existe',
        });
    }

    // ── Custom statusCode errors (from controllers) ────────
    if (err.statusCode) {
        return res.status(err.statusCode).json({
            success: false,
            error: { code: 'REQUEST_ERROR', details: [] },
            message: err.message || 'Error en la solicitud',
        });
    }

    // ── Default: Internal Server Error ─────────────────────
    res.status(500).json({
        success: false,
        error: {
            code: 'INTERNAL_ERROR',
            details: [],
        },
        message: 'Error interno del servidor',
    });
};
