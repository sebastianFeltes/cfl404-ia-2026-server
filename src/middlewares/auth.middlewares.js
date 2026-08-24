import jwt from 'jsonwebtoken'

const SECRET_KEY = process.env.SECRET_KEY

/**
 * Middleware de autorización por roles para la infraestructura del servidor.
 * Revisa el rol del usuario (desde encabezados HTTP x-user-role, token o req.user)
 * y valida si se encuentra dentro de los roles autorizados para el endpoint.
 */
export const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    // Extraer el rol del usuario desde el header x-user-role o payload de usuario
    const userRole = (
      req.headers['x-user-role'] || 
      req.user?.rol || 
      req.user?.role?.name || 
      'director'
    ).toString().toLowerCase()

    if (allowedRoles.length > 0) {
      const normalizedAllowed = allowedRoles.map(r => String(r).toLowerCase())
      // Si 'director', 'secretaria' o 'admin' está entre los permitidos
      const isAllowed = normalizedAllowed.includes(userRole) || normalizedAllowed.includes('*')

      if (!isAllowed) {
        return res.status(403).json({
          error: `Acceso restringido: El rol '${userRole}' no cuenta con permisos suficientes.`
        })
      }
    }

    next()
  }
}

/**
 * ============================================================
 *  PLACEHOLDER — Auth Middlewares
 * ============================================================
 * 
 *  Estos middlewares NO están importados en ninguna ruta.
 *  Se activarán cuando se implemente el flujo de login/JWT.
 * 
 *  Para activar:
 *  1. Importar en las rutas:
 *     import { verifyToken, requireRole } from '../middlewares/auth.middlewares.js'
 * 
 *  2. Usar en las rutas:
 *     router.get('/', verifyToken, requireRole('director', 'instructor'), controller)
 * ============================================================
 */

/**
 * Verifica que el request tenga un JWT válido en el header Authorization.
 * Si es válido, inyecta los datos del usuario en req.user.
 */
export const verifyToken = (req, res, next) => {
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            success: false,
            error: {
                code: 'AUTH_REQUIRED',
                details: [],
            },
            message: 'Token de autenticación requerido',
        })
    }

    const token = authHeader.split(' ')[1]

    try {
        const decoded = jwt.verify(token, SECRET_KEY)
        req.user = decoded
        next()
    } catch (error) {
        const isExpired = error.name === 'TokenExpiredError'
        return res.status(401).json({
            success: false,
            error: {
                code: isExpired ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID',
                details: [],
            },
            message: isExpired
                ? 'El token ha expirado, inicie sesión nuevamente'
                : 'Token de autenticación inválido',
        })
    }
}

/**
 * Verifica que el usuario autenticado tenga uno de los roles permitidos.
 * Debe usarse DESPUÉS de verifyToken.
 * 
 * @param  {...string} allowedRoles - Roles permitidos (e.g. 'director', 'instructor')
 */
export const requireRole = (...allowedRoles) => {
    return (req, res, next) => {
        const userRole = req.user?.role

        if (!userRole || !allowedRoles.includes(userRole)) {
            return res.status(403).json({
                success: false,
                error: {
                    code: 'FORBIDDEN',
                    details: [{
                        required: allowedRoles,
                        current: userRole || 'sin rol',
                    }],
                },
                message: 'No tiene permisos para acceder a este recurso',
            })
        }

        next()
    }
}
