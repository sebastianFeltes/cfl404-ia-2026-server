import crypto from 'node:crypto'
import prisma from './prisma.js'

export const ATTENDANCE_TOKEN_PREFIX = 'CFL404-ATT'
export const ATTENDANCE_TOKEN_REGEX =
  /CFL404-ATT-[A-Za-z0-9_-]{8}-[A-Za-z0-9_-]{4}-[A-Za-z0-9_-]{4}-[A-Za-z0-9_-]{4}-[A-Za-z0-9_-]{12}/

const LEGACY_TOKEN_REGEX = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/

export function formatAttendanceTokenBody(body32) {
  if (body32.length !== 32) {
    throw new Error('El cuerpo del token debe tener 32 caracteres')
  }
  return `${ATTENDANCE_TOKEN_PREFIX}-${body32.slice(0, 8)}-${body32.slice(8, 12)}-${body32.slice(12, 16)}-${body32.slice(16, 20)}-${body32.slice(20, 32)}`
}

export function buildAttendanceTokenFromUserId(userId) {
  if (!userId) return null
  return `${ATTENDANCE_TOKEN_PREFIX}-${userId}`
}

export function extractUserIdFromAttendanceToken(token) {
  const normalized = String(token ?? '').trim()
  if (!normalized.startsWith(`${ATTENDANCE_TOKEN_PREFIX}-`)) return null
  const candidate = normalized.slice(`${ATTENDANCE_TOKEN_PREFIX}-`.length)
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(candidate)) {
    return candidate
  }
  return null
}

export function generateFormattedAttendanceToken() {
  const body = crypto.randomBytes(24).toString('base64url')
  return formatAttendanceTokenBody(body)
}

export function extractAttendanceTokenFromBuffer(buffer) {
  const match = String(buffer ?? '').match(ATTENDANCE_TOKEN_REGEX)
  return match ? match[0] : null
}

export function isFormattedAttendanceToken(token) {
  if (!token || typeof token !== 'string') return false
  return ATTENDANCE_TOKEN_REGEX.test(token.trim())
}

export function normalizeAttendanceToken(raw) {
  const trimmed = String(raw ?? '').trim()
  if (!trimmed) return null

  const extracted = extractAttendanceTokenFromBuffer(trimmed)
  if (extracted) return extracted

  if (LEGACY_TOKEN_REGEX.test(trimmed)) return trimmed

  return null
}

export async function ensureAttendanceToken(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, attendanceToken: true, role: { select: { name: true } } },
  })

  if (!user || String(user.role?.name || '').toLowerCase() !== 'alumno') return null

  const idToken = buildAttendanceTokenFromUserId(userId)
  if (user.attendanceToken === idToken) {
    return idToken
  }

  await prisma.user.update({
    where: { id: userId },
    data: { attendanceToken: idToken },
  })
  return idToken
}
