import jwt from 'jsonwebtoken'
import { OAuth2Client } from 'google-auth-library'
import prisma from '../lib/prisma.js'

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || ''
const IS_PRODUCTION = process.env.NODE_ENV === 'production'
const ALLOW_AUTO_REGISTER = process.env.ALLOW_GOOGLE_AUTO_REGISTER !== 'false'
const ALLOW_DEV_LOGIN = process.env.ALLOW_DEV_LOGIN === 'true' && !IS_PRODUCTION

const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID)

// Debe coincidir con los ids sembrados en prisma/seed.js
const ROLES = {
    GOD: 1,
    ADMIN: 2,
    DIRECTOR: 3,
    REGENTE: 4,
    SECRETARIA: 5,
    PRECEPTORIA: 6,
    INSTRUCTOR: 7,
    ALUMNO: 8,
    POSTULANTE: 9,
}

const STATUS_MAP = { 1: 'Activo', 2: 'Inactivo', 3: 'Pendiente', 4: 'Egresado' }
const STATUS_PENDIENTE = 3
const STUDENT_ROLES = new Set(['ALUMNO', 'POSTULANTE'])
const userInclude = { role: true, status: true, userDetail: true }

const typeFromRole = (roleName) => (STUDENT_ROLES.has(roleName) ? 'STUDENT' : 'STAFF')

/**
 * Firma el JWT de sesión propio de la plataforma.
 * Google solo autentica: la autorización (rol) sale siempre de nuestra base.
 */
const generateAuthToken = (user, type) =>
    jwt.sign(
        {
            id: user.id,
            email: user.email,
            dni: user.dni,
            role: user.role.name,
            roleId: user.roleId,
            type, // 'STUDENT' o 'STAFF'
        },
        process.env.SECRET_KEY,
        { expiresIn: '7d' },
    )

/**
 * Serializa el usuario con la misma forma en todos los endpoints de auth,
 * para que el cliente no tenga que interpretar respuestas distintas.
 */
const serializeUser = (user, type) => ({
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    dni: user.dni,
    role: user.role.name,
    roleId: user.roleId,
    statusId: user.statusId,
    status: STATUS_MAP[user.statusId] || 'Activo',
    emailVerified: user.emailVerified,
    profilePhotoUrl: user.profilePhotoUrl,
    locale: user.locale,
    lastLoginAt: user.lastLoginAt,
    type,
    detail: user.userDetail,
})

/**
 * Busca al usuario en las dos tablas de personas (Student y Staff).
 * El googleId tiene prioridad sobre el email: es el identificador estable
 * de Google, mientras que el email de una cuenta puede cambiar.
 */
const findUserByEmailOrGoogleId = async (email, googleId) => {
    const filters = [
        ...(googleId ? [{ googleId }] : []),
        ...(email ? [{ email }] : []),
    ]
    if (filters.length === 0) return null

    const user = await prisma.user.findFirst({
        where: { OR: filters },
        include: userInclude,
    })
    if (!user) return null

    return { user, type: typeFromRole(user.role.name) }
}

/**
 * Extrae y valida los datos del ID token emitido por Google Identity Services.
 * La firma se verifica siempre contra las claves públicas de Google; si falta
 * GOOGLE_CLIENT_ID el login se rechaza en lugar de confiar en un token sin validar.
 */
const verifyGoogleCredential = async (credential) => {
    if (!GOOGLE_CLIENT_ID) {
        throw Object.assign(
            new Error('GOOGLE_CLIENT_ID no está configurado en el servidor'),
            { statusCode: 500 },
        )
    }

    let payload
    try {
        const ticket = await googleClient.verifyIdToken({
            idToken: credential,
            audience: GOOGLE_CLIENT_ID,
        })
        payload = ticket.getPayload()
    } catch (err) {
        throw Object.assign(
            new Error('Token de Google inválido o expirado'),
            { statusCode: 401, cause: err },
        )
    }

    if (!payload?.email) {
        throw Object.assign(
            new Error('El token de Google no incluye un correo electrónico'),
            { statusCode: 400 },
        )
    }

    if (payload.email_verified === false) {
        throw Object.assign(
            new Error('La cuenta de Google no tiene el correo verificado'),
            { statusCode: 403 },
        )
    }

    return {
        email: payload.email.toLowerCase(),
        googleId: payload.sub,
        emailVerified: Boolean(payload.email_verified),
        firstName: payload.given_name || payload.name?.split(' ')[0] || 'Usuario',
        lastName: payload.family_name || payload.name?.split(' ').slice(1).join(' ') || 'Google',
        picture: payload.picture || null,
        locale: payload.locale || null,
    }
}

/**
 * Sincroniza en la base los datos que devuelve Google en cada inicio de sesión:
 * vincula el googleId la primera vez, refresca la foto/locale y sella el último acceso.
 */
const syncGoogleProfile = async (user, profile) => {
    return prisma.user.update({
        where: { id: user.id },
        data: {
            googleId: user.googleId || profile.googleId,
            emailVerified: profile.emailVerified ?? user.emailVerified,
            profilePhotoUrl: profile.picture || user.profilePhotoUrl,
            locale: profile.locale || user.locale,
            lastLoginAt: new Date(),
        },
        include: userInclude,
    })
}

/**
 * Crea el alumno a partir del perfil de Google cuando la cuenta no existe todavía.
 * Queda en estado pendiente y sin DNI: administración completa el legajo después.
 */
const registerStudentFromGoogle = async (profile) => {
    const student = await prisma.user.create({
        data: {
            firstName: profile.firstName,
            lastName: profile.lastName,
            email: profile.email,
            googleId: profile.googleId,
            emailVerified: profile.emailVerified,
            profilePhotoUrl: profile.picture,
            locale: profile.locale,
            lastLoginAt: new Date(),
            statusId: STATUS_PENDIENTE,
            roleId: ROLES.POSTULANTE,
            userDetail: { create: {} },
        },
        include: userInclude,
    })

    return { user: student, type: 'STUDENT' }
}

/**
 * POST /api/auth/google
 * Recibe el ID token de Google Identity Services, lo verifica y devuelve
 * el JWT de sesión de la plataforma junto con el perfil del usuario.
 */
export const loginWithGoogle = async (req, res, next) => {
    try {
        const { credential } = req.body || {}

        if (!credential) {
            return res.status(400).json({ error: 'Falta el token de Google (credential)' })
        }

        const profile = await verifyGoogleCredential(credential)

        let record = await findUserByEmailOrGoogleId(profile.email, profile.googleId)
        let isNewAccount = false

        if (!record) {
            if (!ALLOW_AUTO_REGISTER) {
                return res.status(404).json({
                    error: 'Usuario no registrado en el sistema. Por favor, comunicate con la administración del CFL 404.',
                })
            }
            record = await registerStudentFromGoogle(profile)
            isNewAccount = true
        } else {
            const updated = await syncGoogleProfile(record.user, profile)
            record = { user: updated, type: typeFromRole(updated.role.name) }
        }

        const { user, type } = record
        const token = generateAuthToken(user, type)

        return res.json({
            message: isNewAccount
                ? 'Cuenta creada con Google. Falta que administración valide tus datos.'
                : 'Autenticación exitosa',
            isNewAccount,
            token,
            user: serializeUser(user, type),
        })
    } catch (error) {
        if (error.statusCode) {
            return res.status(error.statusCode).json({ error: error.message })
        }
        next(error)
    }
}

/**
 * POST /api/auth/dev-login
 * Atajo de desarrollo para entrar con las cuentas de prueba del seed
 * sin pasar por Google. Deshabilitado si ALLOW_DEV_LOGIN no es true.
 */
export const devLoginFallback = async (req, res, next) => {
    try {
        if (!ALLOW_DEV_LOGIN) {
            return res.status(403).json({ error: 'El acceso de desarrollo está deshabilitado' })
        }

        const { accountType = 'alumno', email } = req.body || {}

        const demoAccounts = {
            alumno: 'alumno.test@cfl404.edu.ar',
            estudiante: 'alumno.test@cfl404.edu.ar',
            docente: 'docente.test@cfl404.edu.ar',
            profesor: 'docente.test@cfl404.edu.ar',
            admin: 'admin.test@cfl404.edu.ar',
            directivo: 'directivo.test@cfl404.edu.ar',
        }

        const targetEmail = email || demoAccounts[accountType.toLowerCase()] || demoAccounts.alumno

        const record = await findUserByEmailOrGoogleId(targetEmail)
        if (!record) {
            return res.status(404).json({
                error: `Usuario de prueba con email ${targetEmail} no encontrado. Ejecutá "npm run db:seed".`,
            })
        }

        const { user, type } = record
        const token = generateAuthToken(user, type)

        return res.json({
            message: `Inicio de sesión de desarrollo (${user.role.name})`,
            token,
            user: serializeUser(user, type),
        })
    } catch (error) {
        next(error)
    }
}

const loadUserById = async (id) => {
    const user = await prisma.user.findUnique({ where: { id }, include: userInclude })
    return user ? { user, type: typeFromRole(user.role.name) } : null
}

const dniBelongsToSomeoneElse = async (dni, excludeId) => {
    if (!dni) return false

    const other = await prisma.user.findFirst({
        where: { dni, NOT: { id: excludeId } },
        select: { id: true },
    })
    return Boolean(other)
}

/**
 * GET /api/auth/me
 * Devuelve el perfil vigente del usuario del JWT. El cliente lo usa al
 * arrancar para validar que el token guardado siga siendo válido.
 */
export const getMyProfile = async (req, res, next) => {
    try {
        const { id, type, email } = req.user

        const record = (await loadUserById(id)) || (await findUserByEmailOrGoogleId(email))
        if (!record || record.user.id !== id) {
            return res.status(404).json({ error: 'Usuario no encontrado' })
        }

        return res.json({ user: serializeUser(record.user, record.type) })
    } catch (error) {
        next(error)
    }
}

/**
 * PATCH /api/auth/me
 * Persiste nombre, apellido, DNI y foto del usuario autenticado.
 * El correo lo administra Google: no se modifica desde este endpoint.
 */
export const updateMyProfile = async (req, res, next) => {
    try {
        const { id, type, email } = req.user
        const record = (await loadUserById(id)) || (await findUserByEmailOrGoogleId(email))

        if (!record || record.user.id !== id) {
            return res.status(404).json({ error: 'Usuario no encontrado' })
        }

        const body = req.body || {}
        const firstName = body.firstName ?? body.nombres
        const lastName = body.lastName ?? body.apellidos
        const profilePhotoUrl = body.profilePhotoUrl ?? body.fotoUrl
        const rawDni = body.dni

        const data = {}

        if (firstName !== undefined) {
            const value = String(firstName).trim()
            if (value.length < 2) {
                return res.status(400).json({ error: 'El nombre debe tener al menos 2 caracteres' })
            }
            data.firstName = value
        }

        if (lastName !== undefined) {
            const value = String(lastName).trim()
            if (value.length < 2) {
                return res.status(400).json({ error: 'El apellido debe tener al menos 2 caracteres' })
            }
            data.lastName = value
        }

        if (rawDni !== undefined) {
            const value = String(rawDni).trim()
            if (!value) {
                data.dni = null
            } else if (value.length < 6 || value.length > 20) {
                return res.status(400).json({ error: 'El DNI debe tener entre 6 y 20 caracteres' })
            } else if (await dniBelongsToSomeoneElse(value, id)) {
                return res.status(409).json({ error: 'Ese DNI ya está registrado en el sistema' })
            } else {
                data.dni = value
            }
        }

        if (profilePhotoUrl !== undefined) {
            data.profilePhotoUrl = profilePhotoUrl || null
        }

        if (Object.keys(data).length === 0) {
            return res.status(400).json({ error: 'No hay campos para actualizar' })
        }

        const updated = await prisma.user.update({
            where: { id },
            data,
            include: userInclude,
        })

        return res.json({
            message: 'Perfil actualizado',
            user: serializeUser(updated, record.type),
        })
    } catch (error) {
        next(error)
    }
}
