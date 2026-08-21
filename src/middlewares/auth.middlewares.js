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

import jwt from 'jsonwebtoken'

const SECRET_KEY = process.env.SECRET_KEY

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
