const QR_SCANNER_ROLES = new Set(['god', 'contralor'])

export const QR_SCANNER_EMAILS = new Set([
  'programma.ad.futura@gmail.com',
])

export function normalizeScannerEmail(email) {
  return String(email ?? '').trim().toLowerCase()
}

export function canAccessQrScanner({ role, email }) {
  const normalizedRole = String(role ?? '').trim().toLowerCase()
  if (QR_SCANNER_ROLES.has(normalizedRole)) return true
  return QR_SCANNER_EMAILS.has(normalizeScannerEmail(email))
}
