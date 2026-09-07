import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'

export const JWT_ISSUER = 'cfl404'
export const JWT_AUDIENCE = 'cfl404-web'
export const ACCESS_COOKIE = 'cfl404_access'
export const REFRESH_COOKIE = 'cfl404_refresh'
export const ACCESS_TOKEN_EXPIRES = '15m'
export const REFRESH_TOKEN_DAYS = 7

export function cookieBaseOptions() {
  const isProduction = process.env.NODE_ENV === 'production'
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' : 'lax',
    path: '/',
  }
}

export function signAccessToken(user, type) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role.name,
      roleId: user.roleId,
      type,
    },
    process.env.SECRET_KEY,
    {
      expiresIn: ACCESS_TOKEN_EXPIRES,
      algorithm: 'HS256',
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    },
  )
}

export function verifyAccessToken(token) {
  return jwt.verify(token, process.env.SECRET_KEY, {
    algorithms: ['HS256'],
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  })
}

export function hashRefreshToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex')
}

export function generateRefreshTokenValue() {
  return crypto.randomBytes(32).toString('hex')
}

export function refreshExpiryDate() {
  const expires = new Date()
  expires.setDate(expires.getDate() + REFRESH_TOKEN_DAYS)
  return expires
}
