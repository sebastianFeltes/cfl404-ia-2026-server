/**
 * La app mobile no hereda el bypass de god ni los roles de personal.
 * Solo un alumno activo puede seguir después de authenticateToken.
 */
export function requireMobileAlumno(req, res, next) {
    if (!req.user) {
        return res.status(401).json({ error: 'Acceso no autorizado' })
    }

    if (req.user.role !== 'alumno') {
        return res.status(403).json({
            error: 'La app mobile solo está disponible para alumnos',
        })
    }

    const statusName = String(req.user.status || '').toLowerCase()
    if (statusName !== 'activo') {
        return res.status(403).json({
            error: 'Tu cuenta de alumno no está activa',
        })
    }

    return next()
}

/** Marca el fallback para aceptar solo un mail cuyo rol en la base sea alumno. */
export function markMobileAlumnoLogin(req, _res, next) {
    req.mobileAlumnoOnly = true
    next()
}

/**
 * Marca cada request de /api/mobile para enganchar analíticas después,
 * sin mezclarlo con las rutas de la web.
 * Hoy solo deja el contexto; no envía eventos.
 */
export function trackMobileRequest(req, _res, next) {
    req.mobile = {
        channel: 'app',
        method: req.method,
        path: req.originalUrl || req.path,
        startedAt: Date.now(),
    }
    next()
}
