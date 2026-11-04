import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, test } from 'node:test'
import { isAllowedPhotoUrl } from '../lib/photo-url.js'
import { cleanDni, cleanDob, cleanPersonName, stripText } from '../lib/profile-input.js'
import { storeProfilePhoto } from '../lib/profile-photo.js'
import { createAlumnoSchema } from '../schemas/alumnos.schema.js'

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

describe('sanitización de perfil', () => {
  test('el nombre pierde etiquetas y caracteres de control', () => {
    assert.equal(cleanPersonName('  Ana<script>alert(1)</script>  ', 'El nombre'), 'Anaalert(1)')
    assert.equal(stripText('Calle\u0000 1'), 'Calle 1')
  })

  test('el DNI queda en 7 u 8 dígitos', () => {
    assert.equal(cleanDni('12.345.678'), '12345678')
    assert.throws(() => cleanDni('123456'), /7 u 8/)
    assert.throws(() => cleanDni('<b>123</b>', { required: true }), /7 u 8/)
  })

  test('la fecha futura se rechaza', () => {
    assert.throws(() => cleanDob('2999-01-01'), /futura/)
    assert.ok(cleanDob('2001-05-04') instanceof Date)
  })

  test('la foto data: se guarda como archivo propio y no como URL', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'cfl-avatar-'))
    const userId = '123e4567-e89b-12d3-a456-426614174000'
    const stored = await storeProfilePhoto(userId, PNG, { root })
    assert.match(stored, /^\/uploads\/avatars\/123e4567-e89b-12d3-a456-426614174000\.png\?v=\d+$/)
    const file = await fs.readFile(path.join(root, `${userId}.png`))
    assert.equal(file[0], 0x89)
    assert.equal(isAllowedPhotoUrl(stored), true)
    assert.equal(isAllowedPhotoUrl('data:text/html,<script>'), false)
    assert.equal(isAllowedPhotoUrl('/uploads/avatars/../secret.png'), false)
    await assert.rejects(() => storeProfilePhoto(userId, 'data:image/svg+xml;base64,PHN2Zz4=', { root }))
  })

  test('el alta de alumno rechaza foto arbitraria y fecha futura', () => {
    const base = {
      first_name: 'Ana<script>',
      last_name: 'Paz',
      dni: '12.345.678',
      email: 'ana@example.com',
    }
    const ok = createAlumnoSchema.parse(base)
    assert.equal(ok.first_name, 'Ana')
    assert.equal(ok.dni, '12345678')
    assert.equal(createAlumnoSchema.safeParse({ ...base, dob: '2999-01-01' }).success, false)
    assert.equal(createAlumnoSchema.safeParse({ ...base, profile_photo_url: 'javascript:alert(1)' }).success, false)
  })
})
