import jwt from 'jsonwebtoken'

/**
 * Normaliza nombres de roles comunes y sinónimos.
 * Los roles del sistema se devuelven en MAYÚSCULAS sin colapsar roles distintos.
 *
 * Roles válidos: GOD · ADMIN · DIRECTOR · REGENTE · SECRETARIA · PRECEPTORIA
 *                INSTRUCTOR · ALUMNO · POSTULANTE
 *                DIRECTIVO (backward compat — tokens anteriores)
 */
const normalizeRole = (role) => {
    if (!role) return ''
    const r = role.toString().trim().toUpperCase()
    if (r === 'STUDENT' || r === 'ESTUDIANTE') return 'ALUMNO'
    if (r === 'PROFESOR' || r === 'TEACHER') return 'INSTRUCTOR'  // sinónimos
    if (r === 'ADMINISTRADOR') return 'ADMIN'
    if (r === 'SECRETARÍA') return 'SECRETARIA'                   // normalizar tilde
    // GOD, ADMIN, DIRECTOR, REGENTE, SECRETARIA, PRECEPTORIA,
    // INSTRUCTOR, ALUMNO, POSTULANTE, DIRECTIVO → pasan tal cual
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

/** Roles con CRUD completo (Instructores y secciones administrativas) */
export const CRUD_ROLES_SERVER = ['GOD', 'ADMIN', 'DIRECTOR', 'REGENTE', 'DIRECTIVO']

/** Roles con solo lectura */
export const READ_ONLY_ROLES_SERVER = ['SECRETARIA', 'PRECEPTORIA']

/** Todos los roles con algún acceso */
export const ACCESS_ROLES_SERVER = [...CRUD_ROLES_SERVER, ...READ_ONLY_ROLES_SERVER]

/**
 * Middleware: Exclusivo para Administradores y roles con CRUD completo
 */
export const requireAdmin = authorizeRoles(
    'GOD', 'ADMIN', 'DIRECTOR', 'REGENTE', 'DIRECTIVO'
)

/**
 * Middleware: Exclusivo para Personal Educativo con acceso de lectura o superior
 */
export const requireStaff = authorizeRoles(
    'GOD', 'ADMIN', 'DIRECTOR', 'REGENTE', 'DIRECTIVO',
    'SECRETARIA', 'PRECEPTORIA', 'INSTRUCTOR'
)

/**
 * Middleware: Exclusivo para Docentes / Instructores (y roles superiores)
 */
export const requireDocente = authorizeRoles(
    'INSTRUCTOR', 'GOD', 'ADMIN', 'DIRECTOR', 'REGENTE', 'DIRECTIVO'
)

/**
 * Middleware: Exclusivo para Alumnos (o Admins para gestión/supervisión)
 */
export const requireEstudiante = authorizeRoles(
    'ALUMNO', 'POSTULANTE', 'GOD', 'ADMIN', 'DIRECTOR', 'REGENTE', 'DIRECTIVO'
)

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
