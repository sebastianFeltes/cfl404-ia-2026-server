import jwt from 'jsonwebtoken'
import { OAuth2Client } from 'google-auth-library'
import prisma from '../lib/prisma.js'

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID || '')

/**
 * Genera un JWT de sesión para el usuario
 */
const generateAuthToken = (user, type) => {
    return jwt.sign(
        {
            id: user.id,
            email: user.email,
            dni: user.dni,
            role: user.role.name,
            roleId: user.roleId,
            type // 'STUDENT' o 'STAFF'
        },
        process.env.SECRET_KEY,
        { expiresIn: '7d' }
    )
}

/**
 * Busca un usuario por email en las tablas Student y Staff
 */
const findUserByEmailOrGoogleId = async (email, googleId) => {
    // 1. Buscar en Student
    let student = await prisma.student.findFirst({
        where: {
            OR: [
                ...(email ? [{ email }] : []),
                ...(googleId ? [{ googleId }] : [])
            ]
        },
        include: {
            role: true,
            studentDetail: true
        }
    })

    if (student) {
        return { user: student, type: 'STUDENT' }
    }

    // 2. Buscar en Staff
    let staff = await prisma.staff.findFirst({
        where: {
            OR: [
                ...(email ? [{ email }] : []),
                ...(googleId ? [{ googleId }] : [])
            ]
        },
        include: {
            role: true,
            staffDetail: true
        }
    })

    if (staff) {
        return { user: staff, type: 'STAFF' }
    }

    return null
}

/**
 * POST /api/auth/google
 * Autenticación mediante Google OAuth con soporte de token real y fallback para desarrollo
 */
export const loginWithGoogle = async (req, res, next) => {
    try {
        const { credential, email: devEmail, googleId: devGoogleId, name: devName, picture: devPicture } = req.body || {}

        let email = devEmail
        let googleId = devGoogleId
        let picture = devPicture
        let firstName = ''
        let lastName = ''

        // 1. Si viene un token 'credential' de Google OAuth (Google Identity Services)
        if (credential) {
            try {
                if (process.env.GOOGLE_CLIENT_ID) {
                    const ticket = await googleClient.verifyIdToken({
                        idToken: credential,
                        audience: process.env.GOOGLE_CLIENT_ID
                    })
                    const payload = ticket.getPayload()
                    if (payload) {
                        email = payload.email
                        googleId = payload.sub
                        picture = payload.picture
                        firstName = payload.given_name || ''
                        lastName = payload.family_name || ''
                    }
                } else {
                    // Fallback: decodificar payload del JWT de Google en modo desarrollo sin CLIENT_ID
                    const base64Url = credential.split('.')[1]
                    if (base64Url) {
                        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
                        const jsonPayload = decodeURIComponent(
                            Buffer.from(base64, 'base64')
                                .toString('binary')
                                .split('')
                                .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                                .join('')
                        )
                        const decoded = JSON.parse(jsonPayload)
                        email = decoded.email
                        googleId = decoded.sub
                        picture = decoded.picture
                        firstName = decoded.given_name || ''
                        lastName = decoded.family_name || ''
                    }
                }
            } catch (err) {
                console.warn('⚠️ Error al verificar token con Google OAuth:', err.message)
                return res.status(401).json({ error: 'Token de Google inválido o expirado' })
            }
        }

        if (!email) {
            return res.status(400).json({ error: 'El correo electrónico es requerido para autenticar' })
        }

        // 2. Buscar usuario en la base de datos
        let record = await findUserByEmailOrGoogleId(email, googleId)

        if (!record) {
            return res.status(404).json({
                error: 'Usuario no registrado en el sistema. Por favor, comunícate con la administración del CFL 404.'
            })
        }

        const { user, type } = record

        // 3. Vincular googleId o foto de perfil si no los tenía
        if (googleId && (!user.googleId || !user.profilePhotoUrl)) {
            if (type === 'STUDENT') {
                await prisma.student.update({
                    where: { id: user.id },
                    data: {
                        googleId: user.googleId || googleId,
                        profilePhotoUrl: user.profilePhotoUrl || picture
                    }
                })
            } else {
                await prisma.staff.update({
                    where: { id: user.id },
                    data: {
                        googleId: user.googleId || googleId,
                        profilePhotoUrl: user.profilePhotoUrl || picture
                    }
                })
            }
        }

        // 4. Generar Token JWT
        const token = generateAuthToken(user, type)

        return res.json({
            message: 'Autenticación exitosa',
            token,
            user: {
                id: user.id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                dni: user.dni,
                role: user.role.name,
                roleId: user.roleId,
                profilePhotoUrl: user.profilePhotoUrl || picture,
                type,
                detail: type === 'STUDENT' ? user.studentDetail : user.staffDetail
            }
        })
    } catch (error) {
        next(error)
    }
}

/**
 * POST /api/auth/dev-login
 * Fallback de desarrollo para inicio de sesión rápido (demo de alumno, docente o admin)
 */
export const devLoginFallback = async (req, res, next) => {
    try {
        const { accountType = 'alumno', email } = req.body || {}

        let targetEmail = email
        if (!targetEmail) {
            switch (accountType.toLowerCase()) {
                case 'docente':
                case 'profesor':
                    targetEmail = 'docente.test@cfl404.edu.ar'
                    break
                case 'admin':
                    targetEmail = 'admin.test@cfl404.edu.ar'
                    break
                case 'alumno':
                case 'estudiante':
                default:
                    targetEmail = 'alumno.test@cfl404.edu.ar'
                    break
            }
        }

        const record = await findUserByEmailOrGoogleId(targetEmail)
        if (!record) {
            return res.status(404).json({ error: `Usuario de prueba con email ${targetEmail} no encontrado en la BD.` })
        }

        const { user, type } = record
        const token = generateAuthToken(user, type)

        return res.json({
            message: `Inicio de sesión exitoso (Modo Fallback / Demo: ${user.role.name})`,
            token,
            user: {
                id: user.id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                dni: user.dni,
                role: user.role.name,
                roleId: user.roleId,
                profilePhotoUrl: user.profilePhotoUrl,
                type,
                detail: type === 'STUDENT' ? user.studentDetail : user.staffDetail
            }
        })
    } catch (error) {
        next(error)
    }
}

/**
 * GET /api/auth/me
 * Obtiene el perfil autenticado a partir del JWT
 */
export const getMyProfile = async (req, res, next) => {
    try {
        const { email, id, type } = req.user

        const record = await findUserByEmailOrGoogleId(email)
        if (!record) {
            return res.status(404).json({ error: 'Usuario no encontrado' })
        }

        const { user } = record

        return res.json({
            user: {
                id: user.id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                dni: user.dni,
                role: user.role.name,
                roleId: user.roleId,
                profilePhotoUrl: user.profilePhotoUrl,
                type,
                detail: type === 'STUDENT' ? user.studentDetail : user.staffDetail
            }
        })
    } catch (error) {
        next(error)
    }
}
