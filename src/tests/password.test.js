import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { passwordError } from '../lib/password.js'

describe('política de contraseña', () => {
  test('exige 8 caracteres, mayúscula, número y símbolo', () => {
    assert.equal(passwordError('corta1!'), 'La contraseña debe tener al menos 8 caracteres')
    assert.equal(passwordError('sinmayus1!'), 'La contraseña debe incluir una mayúscula')
    assert.equal(passwordError('SinNumero!'), 'La contraseña debe incluir un número')
    assert.equal(passwordError('SinSimbolo1'), 'La contraseña debe incluir un símbolo')
    assert.equal(passwordError('Alumno404!'), null)
  })
})
