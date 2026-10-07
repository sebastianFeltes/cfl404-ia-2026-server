import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { canAccessQrScanner } from '../lib/qr-scanner-access.js'

describe('qr-scanner-access', () => {
  test('contralor y god tienen acceso', () => {
    assert.equal(canAccessQrScanner({ role: 'contralor', email: 'x@y.com' }), true)
    assert.equal(canAccessQrScanner({ role: 'god', email: 'x@y.com' }), true)
  })

  test('email autorizado tiene acceso sin rol contralor', () => {
    assert.equal(
      canAccessQrScanner({ role: 'admin', email: 'programma.ad.futura@gmail.com' }),
      true,
    )
  })

  test('staff sin autorización explícita no tiene acceso', () => {
    assert.equal(canAccessQrScanner({ role: 'director', email: 'directivo.test@cfl404.edu.ar' }), false)
  })
})
