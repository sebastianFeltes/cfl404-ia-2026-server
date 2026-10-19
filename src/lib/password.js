import bcrypt from 'bcrypt'

const ROUNDS = 12

export const DUMMY_PASSWORD_HASH = bcrypt.hashSync('invalid-password-placeholder', ROUNDS)

export function normalizeDni(value) {
    return String(value ?? '').replace(/\D/g, '')
}

export function passwordError(password) {
    const value = String(password ?? '')
    if (value.length < 8) return 'La contraseña debe tener al menos 8 caracteres'
    if (!/[A-Z]/.test(value)) return 'La contraseña debe incluir una mayúscula'
    if (!/\d/.test(value)) return 'La contraseña debe incluir un número'
    if (!/[^A-Za-z0-9]/.test(value)) return 'La contraseña debe incluir un símbolo'
    return null
}

export async function hashPassword(password) {
    const error = passwordError(password)
    if (error) {
        const invalid = new Error(error)
        invalid.statusCode = 400
        throw invalid
    }
    return bcrypt.hash(password, ROUNDS)
}

export function passwordsMatch(password, hash) {
    return bcrypt.compare(String(password ?? ''), hash || DUMMY_PASSWORD_HASH)
}
