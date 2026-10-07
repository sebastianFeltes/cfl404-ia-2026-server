const AR_TIMEZONE = 'America/Argentina/Buenos_Aires'

const WEEKDAY_TO_NUMBER = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
}

const CODE_ABBREVIATIONS = {
  presente: 'P',
  tarde: 'T',
  'media falta': 'M',
  ausente: 'A',
  justificado: 'J',
  feriado: 'F',
}

function formatParts(date, options) {
  return new Intl.DateTimeFormat('en-US', { timeZone: AR_TIMEZONE, ...options }).formatToParts(date)
}

export function getArgentinaDateKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: AR_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

export function getArgentinaMonthYear(date = new Date()) {
  const parts = formatParts(date, { month: 'numeric', year: 'numeric' })
  return {
    month: Number(parts.find((p) => p.type === 'month')?.value ?? 1),
    year: Number(parts.find((p) => p.type === 'year')?.value ?? 1970),
  }
}

export function getArgentinaDayNumber(date = new Date()) {
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: AR_TIMEZONE,
    weekday: 'short',
  }).format(date)
  return WEEKDAY_TO_NUMBER[weekday] ?? 7
}

export function getArgentinaMinutes(date = new Date()) {
  const parts = formatParts(date, {
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  })
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0)
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0)
  return hour * 60 + minute
}

export function parseStartTimeMinutes(startTime) {
  if (!startTime || typeof startTime !== 'string') return null
  const match = startTime.trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return null
  return hours * 60 + minutes
}

/**
 * Ventanas (minutos desde el inicio del curso):
 *  -60 a +15 → presente
 *  +16 a +30 → tarde
 *  +31 a +44 → media falta
 *  +45 en adelante → ausente
 */
export function resolveAttendanceCodeName(minutesFromStart) {
  if (minutesFromStart < -60) {
    return { error: 'Fuera de horario: demasiado temprano para registrar asistencia' }
  }
  if (minutesFromStart <= 15) return { codeName: 'presente' }
  if (minutesFromStart <= 30) return { codeName: 'tarde' }
  if (minutesFromStart <= 44) return { codeName: 'media falta' }
  return { codeName: 'ausente' }
}

export function abbreviateAttendanceCode(codeName) {
  if (!codeName) return ''
  return CODE_ABBREVIATIONS[String(codeName).toLowerCase()] || String(codeName).charAt(0).toUpperCase()
}

export function getArgentinaDayBoundsUtc(date = new Date()) {
  const dateKey = getArgentinaDateKey(date)
  const startUtc = new Date(`${dateKey}T00:00:00-03:00`)
  const endUtc = new Date(`${dateKey}T23:59:59.999-03:00`)
  return { dateKey, startUtc, endUtc }
}
