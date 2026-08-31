import jwt from 'jsonwebtoken'

/**
 * Normaliza nombres de roles comunes y sinónimos
 */
const normalizeRole = (role) => {
    if (!role) return ''
    const r = role.toString().trim().toUpperCase()
    if (['ALUMNO', 'STUDENT', 'POSTULANTE', 'ASPIRANTE'].includes(r)) return 'ESTUDIANTE'
    if (['PROFESOR', 'TEACHER', 'INSTRUCTOR', 'DOCENTE'].includes(r)) return 'DOCENTE'
    if (['ADMINISTRADOR', 'ADMIN', 'GOD', 'DIOS', 'SUPERADMIN', 'ROOT'].includes(r)) return 'ADMIN'
    if (['DIRECTOR', 'DIRECTIVO', 'SECRETARIA', 'SECRETARÍA', 'REGENTE', 'PRECEPTORIA', 'PRECEPTOR'].includes(r)) return 'DIRECTIVO'
    return r
}

/**
 * Middleware: Autentica el token JWT presente en la cabecera Authorization (Bearer <token>)
 * Si el token es válido, inyecta req.user con la información decodificada.
 */
export const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'] || req.headers['x-access-token']
    
    if (!authHeader) {
        return res.status(401).json({
            error: 'Acceso no autorizado: Se requiere token de autenticación'
        })
    }

    // Extrae el token si viene con prefijo 'Bearer '
    const token = authHeader.startsWith('Bearer ')
        ? authHeader.slice(7).trim()
        : authHeader.trim()

    if (!token) {
        return res.status(401).json({
            error: 'Acceso no autorizado: Formato de token inválido'
        })
    }

    jwt.verify(token, process.env.SECRET_KEY, (err, decoded) => {
        if (err) {
            if (err.name === 'TokenExpiredError') {
                return res.status(401).json({
                    error: 'Sesión expirada: Por favor inicia sesión nuevamente'
                })
            }
            return res.status(403).json({
                error: 'Token inválido o corrupto'
            })
        }

        // Inyecta el usuario decodificado en la petición
        req.user = {
            ...decoded,
            role: normalizeRole(decoded.role)
        }

        next()
    })
}

/**
 * Middleware: Autenticación opcional.
 * Si viene token lo valida y puebla req.user; si no viene, permite continuar con req.user = null.
 */
export const optionalAuth = (req, res, next) => {
    const authHeader = req.headers['authorization'] || req.headers['x-access-token']
    if (!authHeader) {
        req.user = null
        return next()
    }

    const token = authHeader.startsWith('Bearer ')
        ? authHeader.slice(7).trim()
        : authHeader.trim()

    if (!token) {
        req.user = null
        return next()
    }

    jwt.verify(token, process.env.SECRET_KEY, (err, decoded) => {
        if (!err && decoded) {
            req.user = {
                ...decoded,
                role: normalizeRole(decoded.role)
            }
        } else {
            req.user = null
        }
        next()
    })
}

/**
 * Middleware: Verifica que el usuario autenticado posea al menos uno de los roles permitidos.
 * Soporta múltiples argumentos: authorizeRoles('ADMIN', 'DOCENTE') o arreglo: authorizeRoles(['ADMIN', 'DOCENTE'])
 * Debe usarse DESPUÉS de authenticateToken.
 *
 * @param  {...(string|string[])} allowedRoles - Roles con permiso para acceder a la ruta
 */
export const authorizeRoles = (...allowedRoles) => {
    // Aplana el arreglo por si se pasó un array como parámetro
    const rolesList = allowedRoles
        .flat()
        .map(role => normalizeRole(role))

    return (req, res, next) => {
        if (!req.user || !req.user.role) {
            return res.status(401).json({
                error: 'Acceso denegado: Usuario no autenticado o sin rol asignado'
            })
        }

        const userRole = normalizeRole(req.user.role)

        // Superadmin / Modo Dios / Admin tiene acceso irrestricto
        if (userRole === 'ADMIN' || ['GOD', 'DIOS', 'SUPERADMIN', 'ROOT'].includes(String(req.user.role).toUpperCase())) {
            return next()
        }

        if (!rolesList.includes(userRole)) {
            return res.status(403).json({
                error: `Acceso denegado: Se requiere uno de los siguientes roles: [${rolesList.join(', ')}]`,
                requiredRoles: rolesList,
                userRole
            })
        }

        next()
    }
}

/**
 * Middleware: Exclusivo para Administradores y Directivos
 */
export const requireAdmin = authorizeRoles('ADMIN', 'DIRECTIVO')

/**
 * Middleware: Exclusivo para Personal Educativo (Docentes, Directivos y Admins)
 */
export const requireStaff = authorizeRoles('DOCENTE', 'DIRECTIVO', 'ADMIN')

/**
 * Middleware: Exclusivo para Docentes (y administradores con permiso superior)
 */
export const requireDocente = authorizeRoles('DOCENTE', 'DIRECTIVO', 'ADMIN')

/**
 * Middleware: Exclusivo para Estudiantes (o Admins para gestión/supervisión)
 */
export const requireEstudiante = authorizeRoles('ESTUDIANTE', 'DIRECTIVO', 'ADMIN')

/**
 * Middleware: Permite el acceso únicamente si el recurso consultado pertenece al propio usuario
 * (ej: /api/students/:id) o si el usuario que consulta tiene rol ADMIN / DIRECTIVO / DOCENTE.
 *
 * @param {string} paramKey - Nombre del parámetro en req.params (por defecto 'id' o 'studentId')
 */
export const requireSelfOrStaff = (paramKey = 'id') => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Acceso no autorizado' })
        }

        const resourceId = req.params[paramKey]
        const isSelf = req.user.id === resourceId
        const isStaff = ['ADMIN', 'DIRECTIVO', 'DOCENTE'].includes(normalizeRole(req.user.role))

        if (!isSelf && !isStaff) {
            return res.status(403).json({
                error: 'Acceso denegado: No tienes permiso para ver o modificar este recurso'
            })
        }

        next()
    }
}
