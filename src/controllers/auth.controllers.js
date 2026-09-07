import { OAuth2Client } from 'google-auth-library'
import prisma from '../lib/prisma.js'
import { parseAcceptedTerms } from '../lib/accepted-terms.js'
import { assertAllowedPhotoUrl } from '../lib/photo-url.js'
import { DEV_LOGIN_ACCOUNTS, isDevLoginEnabled } from '../lib/dev-login.js'
import {
    ACCESS_COOKIE,
    REFRESH_COOKIE,
    REFRESH_TOKEN_DAYS,
    cookieBaseOptions,
    generateRefreshTokenValue,
    hashRefreshToken,
    refreshExpiryDate,
    signAccessToken,
} from '../lib/auth-tokens.js'

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || ''
const ALLOW_AUTO_REGISTER = process.env.ALLOW_GOOGLE_AUTO_REGISTER === 'true'

const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID)

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

const generateAuthToken = (user, type) => signAccessToken(user, type)

function accountMayLogin(user) {
    const statusName = user.status?.name
    const roleName = user.role?.name
    if (statusName === 'ACTIVO') return true
    return roleName === 'POSTULANTE' && statusName === 'PENDIENTE'
}

async function issueSession(res, user, type, { remember = true } = {}) {
    const accessToken = signAccessToken(user, type)
    const refreshRaw = generateRefreshTokenValue()
    const tokenHash = hashRefreshToken(refreshRaw)
    const expiresAt = refreshExpiryDate()

    await prisma.refreshToken.create({
        data: {
            userId: user.id,
            tokenHash,
            expiresAt,
        },
    })

    const base = cookieBaseOptions()
    res.cookie(ACCESS_COOKIE, accessToken, {
        ...base,
        maxAge: 15 * 60 * 1000,
    })
    res.cookie(REFRESH_COOKIE, refreshRaw, {
        ...base,
        maxAge: remember ? REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000 : undefined,
    })

    return accessToken
}

async function revokeRefreshCookie(req) {
    const raw = req.cookies?.[REFRESH_COOKIE]
    if (!raw) return
    const tokenHash = hashRefreshToken(raw)
    await prisma.refreshToken.updateMany({
        where: { tokenHash, revokedAt: null },
        data: { revokedAt: new Date() },
    })
}

function clearSessionCookies(res) {
    const base = cookieBaseOptions()
    res.clearCookie(ACCESS_COOKIE, base)
    res.clearCookie(REFRESH_COOKIE, base)
}

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
    acceptedTerms: Boolean(user.acceptedTerms),
    type,
    detail: user.userDetail,
})

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

const syncGoogleProfile = async (user, profile) => {
    const acceptedTerms = parseAcceptedTerms(profile.acceptedTerms)
    return prisma.user.update({
        where: { id: user.id },
        data: {
            googleId: user.googleId || profile.googleId,
            emailVerified: profile.emailVerified ?? user.emailVerified,
            profilePhotoUrl: profile.picture || user.profilePhotoUrl,
            locale: profile.locale || user.locale,
            lastLoginAt: new Date(),
            ...(acceptedTerms !== undefined && { acceptedTerms }),
        },
        include: userInclude,
    })
}

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
            acceptedTerms: parseAcceptedTerms(profile.acceptedTerms) === true,
            statusId: STATUS_PENDIENTE,
            roleId: ROLES.POSTULANTE,
            userDetail: { create: {} },
        },
        include: userInclude,
    })

    return { user: student, type: 'STUDENT' }
}

export const loginWithGoogle = async (req, res, next) => {
    try {
        const { credential } = req.body || {}

        if (!credential) {
            return res.status(400).json({ error: 'Falta el token de Google (credential)' })
        }

        const profile = await verifyGoogleCredential(credential)

        const rawAcceptedTerms =
            req.body?.acceptedTerms ??
            req.body?.termsAccepted ??
            req.body?.acceptTerms ??
            req.body?.acceptedConsent ??
            req.body?.terminosAceptados ??
            req.body?.declaracionJurada
        if (rawAcceptedTerms !== undefined) {
            const parsed = parseAcceptedTerms(rawAcceptedTerms)
            if (parsed === undefined) {
                return res.status(400).json({ error: 'acceptedTerms debe ser un boolean' })
            }
            profile.acceptedTerms = parsed
        }

        let record = await findUserByEmailOrGoogleId(profile.email, profile.googleId)
        let isNewAccount = false

        if (!record) {
            if (!ALLOW_AUTO_REGISTER) {
                return res.status(404).json({
                    error: 'Usuario no registrado en el sistema. Por favor, comunicate con la administración del CFL 404.',
                })
            }
            if (profile.acceptedTerms !== true) {
                return res.status(400).json({
                    error: 'Debés aceptar los términos y condiciones para registrarte',
                })
            }
            record = await registerStudentFromGoogle(profile)
            isNewAccount = true
        } else {
            const updated = await syncGoogleProfile(record.user, profile)
            record = { user: updated, type: typeFromRole(updated.role.name) }
        }

        const { user, type } = record
        if (!accountMayLogin(user)) {
            return res.status(401).json({ error: 'Cuenta inactiva o no habilitada' })
        }

        const token = await issueSession(res, user, type, { remember: true })

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

export const devLoginFallback = async (req, res, next) => {
    try {
        if (!isDevLoginEnabled()) {
            return res.status(404).json({ error: 'Not found' })
        }

        const { accountType = 'alumno' } = req.body || {}
        const key = String(accountType || '').toLowerCase()
        const targetEmail = DEV_LOGIN_ACCOUNTS[key]
        if (!targetEmail) {
            return res.status(400).json({ error: 'Tipo de cuenta de desarrollo no válido' })
        }

        const record = await findUserByEmailOrGoogleId(targetEmail)
        if (!record) {
            return res.status(404).json({
                error: `Usuario de prueba con email ${targetEmail} no encontrado. Ejecutá "npm run db:seed".`,
            })
        }

        const { user, type } = record
        if (!accountMayLogin(user)) {
            return res.status(401).json({ error: 'Cuenta inactiva o no habilitada' })
        }

        const token = await issueSession(res, user, type, { remember: true })

        return res.json({
            message: `Inicio de sesión de desarrollo (${user.role.name})`,
            token,
            user: serializeUser(user, type),
        })
    } catch (error) {
        next(error)
    }
}

export const logout = async (req, res, next) => {
    try {
        await revokeRefreshCookie(req)
        clearSessionCookies(res)
        return res.json({ message: 'Sesión cerrada' })
    } catch (error) {
        next(error)
    }
}

export const refreshSession = async (req, res, next) => {
    try {
        const raw = req.cookies?.[REFRESH_COOKIE]
        if (!raw) {
            return res.status(401).json({ error: 'No hay sesión para renovar' })
        }

        const tokenHash = hashRefreshToken(raw)
        const stored = await prisma.refreshToken.findUnique({
            where: { tokenHash },
            include: { user: { include: userInclude } },
        })

        if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
            clearSessionCookies(res)
            return res.status(401).json({ error: 'Sesión inválida o vencida' })
        }

        await prisma.refreshToken.update({
            where: { id: stored.id },
            data: { revokedAt: new Date() },
        })

        const user = stored.user
        if (!accountMayLogin(user)) {
            clearSessionCookies(res)
            return res.status(401).json({ error: 'Cuenta inactiva o no habilitada' })
        }

        const type = typeFromRole(user.role.name)
        const token = await issueSession(res, user, type, { remember: true })
        return res.json({
            message: 'Sesión renovada',
            user: serializeUser(user, type),
            token,
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

export const getMyProfile = async (req, res, next) => {
    try {
        const { id } = req.user

        const record = await loadUserById(id)
        if (!record) {
            return res.status(404).json({ error: 'Usuario no encontrado' })
        }

        return res.json({
            user: serializeUser(record.user, record.type),
        })
    } catch (error) {
        next(error)
    }
}

function rejectLockedIdentityChange(user, field, nextValue) {
    const roleName = user.role?.name
    if (roleName === 'POSTULANTE') return null
    const current = user[field]
    if (current && String(current).trim() && String(nextValue).trim() !== String(current).trim()) {
        return `No se puede modificar ${field === 'dni' ? 'el DNI' : 'el nombre'} desde este perfil`
    }
    return null
}

export const updateMyProfile = async (req, res, next) => {
    try {
        const { id } = req.user
        const record = await loadUserById(id)

        if (!record) {
            return res.status(404).json({ error: 'Usuario no encontrado' })
        }

        const body = req.body || {}
        const firstName = body.firstName ?? body.nombres
        const lastName = body.lastName ?? body.apellidos
        const profilePhotoUrl = body.profilePhotoUrl ?? body.fotoUrl
        const rawDni = body.dni
        const rawAcceptedTerms =
            body.acceptedTerms ??
            body.termsAccepted ??
            body.acceptTerms ??
            body.acceptedConsent ??
            body.terminosAceptados ??
            body.declaracionJurada

        if (firstName !== undefined) {
            const locked = rejectLockedIdentityChange(record.user, 'firstName', firstName)
            if (locked) return res.status(403).json({ error: locked })
        }
        if (lastName !== undefined) {
            const locked = rejectLockedIdentityChange(record.user, 'lastName', lastName)
            if (locked) return res.status(403).json({ error: locked })
        }
        if (rawDni !== undefined) {
            const locked = rejectLockedIdentityChange(record.user, 'dni', rawDni)
            if (locked) return res.status(403).json({ error: locked })
        }

        const data = {}

        if (firstName !== undefined) {
            const value = String(firstName).trim()
            if (!value) {
                return res.status(400).json({ error: 'El nombre no puede estar vacío' })
            }
            data.firstName = value
        }

        if (lastName !== undefined) {
            const value = String(lastName).trim()
            if (!value) {
                return res.status(400).json({ error: 'El apellido no puede estar vacío' })
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
            assertAllowedPhotoUrl(profilePhotoUrl)
            data.profilePhotoUrl = profilePhotoUrl || null
        }

        if (rawAcceptedTerms !== undefined) {
            const parsed = parseAcceptedTerms(rawAcceptedTerms)
            if (parsed === undefined) {
                return res.status(400).json({ error: 'acceptedTerms debe ser un boolean' })
            }
            data.acceptedTerms = parsed
        }

        const phone = body.phone ?? body.telefono
        const address = body.address ?? body.direccion
        const academicLevel = body.academicLevel ?? body.academic_level ?? body.nivelAcademico
        const gender = body.gender ?? body.genero
        const nacionality = body.nacionality ?? body.nacionalidad
        const extraPhone = body.extraPhone ?? body.extra_phone ?? body.telefonoEmergencia
        const extraEmail = body.extraEmail ?? body.extra_email ?? body.emailEmergencia
        const dob = body.dob ?? body.fechaNacimiento

        const detailData = {}
        if (phone !== undefined) detailData.phone = phone || null
        if (address !== undefined) detailData.address = address || null
        if (academicLevel !== undefined) detailData.academicLevel = academicLevel || 'Secundario'
        if (gender !== undefined) detailData.gender = gender || null
        if (nacionality !== undefined) detailData.nacionality = nacionality || 'Argentina'
        if (extraPhone !== undefined) detailData.extraPhone = extraPhone || null
        if (extraEmail !== undefined) detailData.extraEmail = extraEmail || null
        if (dob !== undefined) {
            detailData.dob = dob ? new Date(dob) : null
        }

        if (Object.keys(detailData).length > 0) {
            data.userDetail = {
                upsert: {
                    create: detailData,
                    update: detailData,
                },
            }
        }

        if (Object.keys(data).length === 0) {
            return res.status(400).json({ error: 'No hay campos para actualizar' })
        }

        const updated = await prisma.user.update({
            where: { id },
            data,
            include: userInclude,
        })

        const updatedType = typeFromRole(updated.role.name)

        return res.json({
            message: 'Perfil actualizado',
            user: serializeUser(updated, updatedType),
        })
    } catch (error) {
        next(error)
    }
}

export { generateAuthToken }
