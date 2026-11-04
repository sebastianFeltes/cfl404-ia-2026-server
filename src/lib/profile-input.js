const CONTROL = /[\u0000-\u001F\u007F]/g
const TAGS = /<[^>]*>/g
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const GENDERS = [
  'Masculino',
  'Femenino',
  'No binario',
  'Otro',
  'Prefiero no decirlo',
  'No especificado',
]

export const ACADEMIC_LEVELS = [
  'Primario incompleto',
  'Primario completo',
  'Secundario incompleto',
  'Secundario',
  'Secundario completo',
  'Terciario en curso',
  'Terciario',
  'Terciario graduado',
  'Universitario en curso',
  'Universitario graduado',
]

function fail(message) {
  const error = new Error(message)
  error.statusCode = 400
  return error
}

export function stripText(value) {
  return String(value ?? '')
    .replace(CONTROL, '')
    .replace(TAGS, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function todayYmd(now = new Date()) {
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function cleanPersonName(value, label) {
  const text = stripText(value)
  if (text.length < 2) throw fail(`${label} tiene que tener al menos 2 caracteres`)
  if (text.length > 80) throw fail(`${label} supera los 80 caracteres`)
  return text
}

export function cleanDni(value, { required = false } = {}) {
  const digits = String(value ?? '').replace(/\D/g, '')
  if (!digits) {
    if (required) throw fail('El DNI debe tener 7 u 8 dígitos')
    return null
  }
  if (!/^\d{7,8}$/.test(digits)) throw fail('El DNI debe tener 7 u 8 dígitos')
  return digits
}

export function cleanPhone(value, label, { required = false } = {}) {
  const raw = stripText(value)
  if (!raw) {
    if (required) throw fail(`${label} es obligatorio`)
    return null
  }
  const digits = raw.replace(/\D/g, '')
  if (digits.length < 8 || digits.length > 15) {
    throw fail(`${label} debe tener entre 8 y 15 dígitos`)
  }
  if (/^(\d)\1+$/.test(digits)) {
    throw fail(`${label} no puede ser una secuencia repetida`)
  }
  return digits
}

export function cleanAddress(value, { required = false } = {}) {
  const text = stripText(value)
  if (!text) {
    if (required) throw fail('La dirección es obligatoria')
    return null
  }
  if (text.length > 160) throw fail('La dirección supera los 160 caracteres')
  return text
}

export function cleanNationality(value) {
  const text = stripText(value)
  if (!text) return 'Argentina'
  if (text.length > 60) throw fail('La nacionalidad supera los 60 caracteres')
  return text
}

export function cleanChoice(value, allowed, label) {
  const text = stripText(value)
  if (!text) return null
  if (!allowed.includes(text)) throw fail(`${label} no es válido`)
  return text
}

export function cleanEmail(value) {
  const text = stripText(value).toLowerCase()
  if (!text) return null
  if (text.length > 120 || !EMAIL.test(text)) throw fail('El correo alternativo no es válido')
  return text
}

export function dobError(value, now = new Date()) {
  const text = stripText(value)
  if (!text) return null
  const ymd = text.slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return 'La fecha de nacimiento no es válida'
  const [year, month, day] = ymd.split('-').map(Number)
  const utc = new Date(Date.UTC(year, month - 1, day, 12))
  if (
    utc.getUTCFullYear() !== year
    || utc.getUTCMonth() !== month - 1
    || utc.getUTCDate() !== day
    || year < 1900
  ) {
    return 'La fecha de nacimiento no es válida'
  }
  if (ymd > todayYmd(now)) return 'La fecha de nacimiento no puede ser futura'
  return null
}

export function cleanDob(value, { required = false, now = new Date() } = {}) {
  const text = stripText(value)
  if (!text) {
    if (required) throw fail('La fecha de nacimiento es obligatoria')
    return null
  }
  const message = dobError(text, now)
  if (message) throw fail(message)
  const [year, month, day] = text.slice(0, 10).split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day, 12))
}
