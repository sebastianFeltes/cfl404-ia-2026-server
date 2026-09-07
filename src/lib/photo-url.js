const ALLOWED_HOSTS = new Set([
  'lh3.googleusercontent.com',
  'lh4.googleusercontent.com',
  'lh5.googleusercontent.com',
  'lh6.googleusercontent.com',
  'googleusercontent.com',
  'images.unsplash.com',
])

function hostAllowed(hostname) {
  const host = String(hostname || '').toLowerCase()
  if (ALLOWED_HOSTS.has(host)) return true
  return host.endsWith('.googleusercontent.com')
}

/**
 * Acepta solo https hacia hosts de fotos conocidos.
 * Rechaza javascript:, data:, http: y hosts arbitrarios.
 */
export function isAllowedPhotoUrl(value) {
  if (value == null || value === '') return true
  if (typeof value !== 'string') return false
  const trimmed = value.trim()
  if (!trimmed) return true
  const lower = trimmed.toLowerCase()
  if (lower.startsWith('javascript:') || lower.startsWith('data:') || lower.startsWith('http:')) {
    return false
  }
  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol !== 'https:') return false
    return hostAllowed(parsed.hostname)
  } catch {
    return false
  }
}

export function assertAllowedPhotoUrl(value) {
  if (!isAllowedPhotoUrl(value)) {
    const error = new Error('La URL de la foto no está permitida')
    error.statusCode = 400
    throw error
  }
  return value || null
}
