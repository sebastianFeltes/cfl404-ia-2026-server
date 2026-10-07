import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  abbreviateAttendanceCode,
  getArgentinaDayNumber,
  parseStartTimeMinutes,
  resolveAttendanceCodeName,
} from '../lib/attendance-time.js'
import {
  ATTENDANCE_TOKEN_REGEX,
  extractAttendanceTokenFromBuffer,
  formatAttendanceTokenBody,
  generateFormattedAttendanceToken,
  isFormattedAttendanceToken,
  normalizeAttendanceToken,
} from '../lib/attendance-token.js'

describe('attendance-time', () => {
  test('parseStartTimeMinutes convierte HH:mm', () => {
    assert.equal(parseStartTimeMinutes('18:00'), 18 * 60)
    assert.equal(parseStartTimeMinutes('17:30'), 17 * 60 + 30)
    assert.equal(parseStartTimeMinutes(''), null)
    assert.equal(parseStartTimeMinutes('invalid'), null)
  })

  test('resolveAttendanceCodeName aplica ventanas institucionales', () => {
    assert.deepEqual(resolveAttendanceCodeName(-60), { codeName: 'presente' })
    assert.deepEqual(resolveAttendanceCodeName(0), { codeName: 'presente' })
    assert.deepEqual(resolveAttendanceCodeName(15), { codeName: 'presente' })
    assert.deepEqual(resolveAttendanceCodeName(16), { codeName: 'tarde' })
    assert.deepEqual(resolveAttendanceCodeName(30), { codeName: 'tarde' })
    assert.deepEqual(resolveAttendanceCodeName(31), { codeName: 'media falta' })
    assert.deepEqual(resolveAttendanceCodeName(44), { codeName: 'media falta' })
    assert.deepEqual(resolveAttendanceCodeName(45), { codeName: 'ausente' })
    assert.ok(resolveAttendanceCodeName(-61).error)
  })

  test('abbreviateAttendanceCode devuelve siglas', () => {
    assert.equal(abbreviateAttendanceCode('presente'), 'P')
    assert.equal(abbreviateAttendanceCode('tarde'), 'T')
    assert.equal(abbreviateAttendanceCode('media falta'), 'M')
    assert.equal(abbreviateAttendanceCode('ausente'), 'A')
    assert.equal(abbreviateAttendanceCode('justificado'), 'J')
    assert.equal(abbreviateAttendanceCode('feriado'), 'F')
  })

  test('getArgentinaDayNumber devuelve número 1-7', () => {
    const day = getArgentinaDayNumber(new Date())
    assert.ok(day >= 1 && day <= 7)
  })
})

describe('attendance-token', () => {
  test('genera token con formato CFL404-ATT', () => {
    const token = generateFormattedAttendanceToken()
    assert.match(token, ATTENDANCE_TOKEN_REGEX)
    assert.equal(isFormattedAttendanceToken(token), true)
  })

  test('formatAttendanceTokenBody respeta segmentos 8-4-4-4-12', () => {
    const body = '12345678901234567890123456789012'
    assert.equal(
      formatAttendanceTokenBody(body),
      'CFL404-ATT-12345678-9012-3456-7890-123456789012',
    )
  })

  test('extractAttendanceTokenFromBuffer detecta token completo en buffer', () => {
    const token = 'CFL404-ATT-AbCdEfGh-IjKl-MnOp-QrSt-UvWxYz123456'
    const buffer = `noise${token}tail`
    assert.equal(extractAttendanceTokenFromBuffer(buffer), token)
  })

  test('normalizeAttendanceToken rechaza basura', () => {
    assert.equal(normalizeAttendanceToken('token-inventado'), null)
    assert.equal(normalizeAttendanceToken(''), null)
  })
})
