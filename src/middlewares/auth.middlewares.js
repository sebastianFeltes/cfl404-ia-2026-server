import prisma from '../lib/prisma.js'
import { ACCESS_COOKIE, verifyAccessToken } from '../lib/auth-tokens.js'
import { canAccessQrScanner } from '../lib/qr-scanner-access.js'

/**
 * Normaliza sinónimos pero no colapsa roles distintos
 * (secretaria ≠ director, necesario para permisos de Instructores).
 *
 * Roles válidos: god · admin · director · regente · secretaria · preceptoria
 *                instructor · alumno · postulante · contralor
 */
const normalizeRole = (role) => {
    if (!role) return ''
    const r = role.toString().trim().toLowerCase()
    if (['dios', 'superadmin', 'root'].includes(r)) return 'god'
    if (r === 'administrador') return 'admin'
    if (r === 'directivo') return 'director'
    if (r === 'secretaría') return 'secretaria'
    if (r === 'preceptor') return 'preceptoria'
    if (['profesor', 'profesores', 'teacher', 'teachers', 'docente', 'docentes'].includes(r)) return 'instructor'
    if (['student', 'students', 'estudiante', 'estudiantes', 'alumnos'].includes(r)) return 'alumno'
    if (['aspirante', 'aspirantes', 'postulantes'].includes(r)) return 'postulante'
    return r
}

/** Equivalencias para rutas viejas que piden directivo / docente / estudiante */
const ROLE_EQUIVALENTS = {
    director: ['director', 'directivo', 'regente'],
    directivo: ['directivo', 'director', 'regente'],
    regente: ['regente', 'director', 'directivo'],
    docente: ['docente', 'instructor'],
    instructor: ['instructor', 'docente'],
    estudiante: ['estudiante', 'alumno', 'postulante', 'aspirante'],
    alumno: ['alumno', 'estudiante'],
    postulante: ['postulante', 'aspirante', 'estudiante'],
    admin: ['admin', 'administrador'],
    god: ['god', 'dios', 'superadmin', 'root'],
}

const STUDENT_ROLES = new Set(['alumno', 'postulante'])

const roleIsAllowed = (userRole, allowedRoles) => {
    if (allowedRoles.includes(userRole)) return true
    for (const allowed of allowedRoles) {
        const equivalents = ROLE_EQUIVALENTS[allowed] || [allowed]
        if (equivalents.includes(userRole)) return true
    }
    return false
}

function extractBearerToken(req) {
    const authHeader = req.headers.authorization
    if (!authHeader || typeof authHeader !== 'string') return null
    if (authHeader.startsWith('Bearer ')) return authHeader.slice(7).trim()
    return null
}

function extractAccessToken(req) {
    const bearer = extractBearerToken(req)
    if (bearer) return bearer
    const cookieToken = req.cookies?.[ACCESS_COOKIE]
    if (cookieToken && typeof cookieToken === 'string') return cookieToken.trim()
    return null
}

function isAuthMeRoute(req) {
    const url = `${req.originalUrl || ''} ${req.path || ''}`
    return /\/api\/auth\/me(?:\?|$|\/)/.test(url) || req.path === '/me'
}

function attachUser(req, user) {
    const roleName = normalizeRole(user.role?.name)
    req.user = {
        id: user.id,
        email: user.email,
        dni: user.dni,
        role: roleName,
        roleId: user.roleId,
        statusId: user.statusId,
        status: user.status?.name || null,
        type: STUDENT_ROLES.has(roleName) ? 'STUDENT' : 'STAFF',
    }
}

async function loadActiveUserFromToken(token) {
    let decoded
    try {
        decoded = verifyAccessToken(token)
    } catch (err) {
        const wrapped = new Error(err.name === 'TokenExpiredError' ? 'expired' : 'invalid')
        wrapped.cause = err
        throw wrapped
    }

    const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        include: { role: true, status: true },
    })
    if (!user) {
        const missing = new Error('missing')
        throw missing
    }
    return user
}

function statusAllowsAccess(user, req) {
    const statusName = String(user.status?.name || '').toLowerCase()
    if (statusName === 'activo') return true
    const isPendingPostulant = normalizeRole(user.role?.name) === 'postulante' && statusName === 'pendiente'
    return isPendingPostulant && isAuthMeRoute(req)
}

/**
 * Middleware: Autentica el token JWT (Authorization Bearer o cookie httpOnly).
 * Revalida rol y status contra la base; no confía en los claims del token.
 */
export const authenticateToken = async (req, res, next) => {
    const token = extractAccessToken(req)

    if (!token) {
        return res.status(401).json({
            error: 'Acceso no autorizado: Se requiere token de autenticación',
        })
    }

    try {
        const user = await loadActiveUserFromToken(token)
        if (!statusAllowsAccess(user, req)) {
            return res.status(401).json({
                error: 'Cuenta inactiva o no habilitada',
            })
        }
        attachUser(req, user)
        next()
    } catch (err) {
        if (err.message === 'expired') {
            return res.status(401).json({
                error: 'Sesión expirada: Por favor inicia sesión nuevamente',
            })
        }
        return res.status(401).json({
            error: 'Token inválido o corrupto',
        })
    }
}

/**
 * Middleware: Autenticación opcional.
 * Si viene token lo valida y puebla req.user; si no viene, permite continuar con req.user = null.
 */
export const optionalAuth = async (req, res, next) => {
    const token = extractAccessToken(req)
    if (!token) {
        req.user = null
        return next()
    }

    try {
        const user = await loadActiveUserFromToken(token)
        if (!statusAllowsAccess(user, req)) {
            req.user = null
            return next()
        }
        attachUser(req, user)
    } catch {
        req.user = null
    }
    next()
}

/**
 * Middleware: Verifica que el usuario autenticado posea al menos uno de los roles permitidos.
 * Solo god bypasea la lista. admin no es equivalente a god.
 * Debe usarse DESPUÉS de authenticateToken.
 */
export const authorizeRoles = (...allowedRoles) => {
    const rolesList = allowedRoles
        .flat()
        .map((role) => normalizeRole(role))

    return (req, res, next) => {
        if (!req.user || !req.user.role) {
            return res.status(401).json({
                error: 'Acceso denegado: Usuario no autenticado o sin rol asignado',
            })
        }

        const userRole = normalizeRole(req.user.role)

        if (userRole === 'god') {
            return next()
        }

        if (!roleIsAllowed(userRole, rolesList)) {
            return res.status(403).json({
                error: `Acceso denegado: Se requiere uno de los siguientes roles: [${rolesList.join(', ')}]`,
                requiredRoles: rolesList,
                userRole,
            })
        }

        next()
    }
}

/** Roles con CRUD completo (Instructores y secciones administrativas) */
export const CRUD_ROLES_SERVER = ['god', 'admin', 'director', 'regente', 'directivo']

/** Roles con solo lectura */
export const READ_ONLY_ROLES_SERVER = ['secretaria', 'preceptoria']

/** Personal de gestión (sin instructor ni alumnos) */
export const ACCESS_ROLES_SERVER = [...CRUD_ROLES_SERVER, ...READ_ONLY_ROLES_SERVER]

/**
 * Middleware: Exclusivo para Administradores y roles con CRUD completo
 */
export const requireAdmin = authorizeRoles(
    'god', 'admin', 'director', 'regente', 'directivo',
)

/**
 * Middleware: Personal de gestión (lectura de alumnos, instructores, etc.)
 */
export const requireStaff = authorizeRoles(
    'god', 'admin', 'director', 'regente', 'directivo',
    'secretaria', 'preceptoria',
)

/**
 * Middleware: Exclusivo para Docentes / Instructores (y roles superiores)
 */
export const requireDocente = authorizeRoles(
    'instructor', 'god', 'admin', 'director', 'regente', 'directivo',
)

/**
 * Middleware: Exclusivo para Alumnos (o Admins para gestión/supervisión)
 */
export const requireEstudiante = authorizeRoles(
    'alumno', 'postulante', 'god', 'admin', 'director', 'regente', 'directivo',
)

/**
 * Middleware: Lector QR de asistencia (contralor, god o emails autorizados)
 */
export const requireQrScanner = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Acceso no autorizado' })
    }

    if (canAccessQrScanner({ role: req.user.role, email: req.user.email })) {
        return next()
    }

    return res.status(403).json({
        error: 'Acceso denegado: Se requiere rol contralor o autorización para el lector QR',
    })
}

/**
 * Middleware: Permite el acceso únicamente si el recurso consultado pertenece al propio usuario
 * o si el usuario que consulta tiene rol de personal de gestión.
 *
 * @param {string} paramKey - Nombre del parámetro en req.params (por defecto 'id')
 */
export const requireSelfOrStaff = (paramKey = 'id') => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Acceso no autorizado' })
        }

        const resourceId = String(req.params[paramKey] ?? '')
        const isSelf = String(req.user.id) === resourceId
        const role = normalizeRole(req.user.role)
        const isStaff = ACCESS_ROLES_SERVER.includes(role)

        if (!isSelf && !isStaff) {
            return res.status(403).json({
                error: 'Acceso denegado: No tienes permiso para ver o modificar este recurso',
            })
        }

        next()
    }
}
