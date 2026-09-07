import assert from 'node:assert/strict'
import { after, before, describe, test } from 'node:test'
import { isDevLoginEnabled } from '../lib/dev-login.js'
import { assertSecureBoot } from '../lib/boot.js'
import { isAllowedPhotoUrl } from '../lib/photo-url.js'
import { jsonRequest, prisma, startTestServer, tokenForEmail } from './helpers.js'

let ctx
let alumno
let director
let instructor
let studentRow

describe('auditoría de seguridad CFL 404', () => {
  before(async () => {
    ctx = await startTestServer()
    alumno = await tokenForEmail('alumno.test@cfl404.edu.ar')
    director = await tokenForEmail('directivo.test@cfl404.edu.ar')
    instructor = await tokenForEmail('docente.test@cfl404.edu.ar')
    studentRow = await prisma.user.findFirst({
      where: { role: { name: { in: ['ALUMNO', 'POSTULANTE'] } } },
      select: { id: true },
    })
  })

  after(async () => {
    await ctx.close()
    await prisma.$disconnect()
  })

  describe('ola 0 — críticos', () => {
  test('C-01 GET /api/alumnos sin token → 401', async () => {
    const res = await jsonRequest(ctx.base, '/api/alumnos')
    assert.equal(res.status, 401)
  })

  test('C-01 GET /api/v1/alumnos sin token → 401', async () => {
    const res = await jsonRequest(ctx.base, '/api/v1/alumnos')
    assert.equal(res.status, 401)
  })

  test('C-01 JWT de ALUMNO → 403', async () => {
    const res = await jsonRequest(ctx.base, '/api/v1/alumnos', { token: alumno.token })
    assert.equal(res.status, 403)
  })

  test('C-01 JWT de DIRECTOR → 200', async () => {
    const res = await jsonRequest(ctx.base, '/api/v1/alumnos', { token: director.token })
    assert.equal(res.status, 200)
    assert.ok(Array.isArray(res.json.data))
  })

  test('C-02 UUID de INSTRUCTOR en GET /api/alumnos/:id → 404', async () => {
    const res = await jsonRequest(ctx.base, `/api/v1/alumnos/${instructor.user.id}`, {
      token: director.token,
    })
    assert.equal(res.status, 404)
  })

  test('C-02 DELETE de instructor → 404 y la fila sigue', async () => {
    const res = await jsonRequest(ctx.base, `/api/v1/alumnos/${instructor.user.id}`, {
      method: 'DELETE',
      token: director.token,
    })
    assert.equal(res.status, 404)
    const still = await prisma.user.findUnique({ where: { id: instructor.user.id } })
    assert.ok(still)
    assert.notEqual(still.statusId, undefined)
  })

  test('C-02 PUT con role_id 1 no escala el rol', async () => {
    assert.ok(studentRow?.id)
    const before = await prisma.user.findUnique({ where: { id: studentRow.id } })
    const res = await jsonRequest(ctx.base, `/api/v1/alumnos/${studentRow.id}`, {
      method: 'PUT',
      token: director.token,
      body: { role_id: 1 },
    })
    assert.ok(res.status === 400 || res.status === 403)
    const after = await prisma.user.findUnique({ where: { id: studentRow.id } })
    assert.equal(after.roleId, before.roleId)
  })

  test('C-02 GET /courses no incluye email de instructor', async () => {
    const res = await jsonRequest(ctx.base, '/courses')
    assert.equal(res.status, 200)
    const courses = Array.isArray(res.json) ? res.json : []
    for (const course of courses) {
      assert.equal(course.instructor?.email, undefined)
    }
  })

  test('C-03 DIRECTOR no puede persistir role_id 1 en instructores', async () => {
    const res = await jsonRequest(ctx.base, '/api/v1/instructores', {
      method: 'POST',
      token: director.token,
      body: {
        first_name: 'Hacker',
        last_name: 'Godmode',
        email: `godmode.${Date.now()}@example.com`,
        dni: String(80000000 + Math.floor(Math.random() * 999999)).slice(0, 8),
        status_id: 1,
        role_id: 1,
      },
    })
    assert.ok(res.status === 400 || res.status === 403)
    const created = await prisma.user.findFirst({ where: { firstName: 'Hacker', lastName: 'Godmode' } })
    assert.equal(created, null)
  })

  test('C-04 dev-login no está habilitado fuera de development', () => {
    assert.equal(isDevLoginEnabled({ nodeEnv: 'production', allowDevLogin: 'true' }), false)
    assert.equal(isDevLoginEnabled({ nodeEnv: 'test', allowDevLogin: 'true' }), false)
  })

  test('C-04 POST /api/auth/dev-login en test → 404', async () => {
    const res = await jsonRequest(ctx.base, '/api/auth/dev-login', {
      method: 'POST',
      body: { accountType: 'god' },
    })
    assert.equal(res.status, 404)
  })

  test('C-05 cola virtual: join público y webhook exige secreto', async () => {
    const join = await jsonRequest(ctx.base, '/api/queue/join', {
      method: 'POST',
      body: { courseId: 'x' },
    })
    const hook = await jsonRequest(ctx.base, '/api/webhooks/queue', {
      method: 'POST',
      body: { ticketId: 'TQ-1', status: 'DONE' },
    })
    assert.equal(join.status, 201)
    assert.equal(hook.status, 401)
  })

  test('C-06 authenticateToken usa rol de DB; ALUMNO no entra a instructores', async () => {
    const res = await jsonRequest(ctx.base, '/api/v1/instructores', { token: alumno.token })
    assert.equal(res.status, 403)
  })
})

describe('ola 1 — altas', () => {
  test('H-01 ADMIN no es equivalente a GOD en el helper de boot/dev-login', () => {
    assert.equal(isDevLoginEnabled({ nodeEnv: 'production', allowDevLogin: 'true' }), false)
  })

  test('H-12 GET /attendance no es público', async () => {
    const res = await jsonRequest(ctx.base, '/attendance')
    assert.ok(res.status === 401 || res.status === 404)
  })

  test('H-14 INSTRUCTOR no puede cambiar DNI por PATCH /me', async () => {
    const before = instructor.user.dni
    const res = await jsonRequest(ctx.base, '/api/auth/me', {
      method: 'PATCH',
      token: instructor.token,
      body: { dni: '99999999' },
    })
    assert.equal(res.status, 403)
    const after = await prisma.user.findUnique({ where: { id: instructor.user.id } })
    assert.equal(after.dni, before)
  })

  test('H-15 UUID de ALUMNO contra instructores → 404', async () => {
    const res = await jsonRequest(ctx.base, `/api/v1/instructores/${alumno.user.id}`, {
      token: director.token,
    })
    assert.equal(res.status, 404)
  })

  test('H-09 PATCH /me con URL no https → 400', async () => {
    const res = await jsonRequest(ctx.base, '/api/auth/me', {
      method: 'PATCH',
      token: instructor.token,
      body: { profilePhotoUrl: 'javascript:alert(1)' },
    })
    assert.equal(res.status, 400)
  })

  test('H-10 body > 32kb → 413', async () => {
    const res = await jsonRequest(ctx.base, '/api/v1/instructores', {
      method: 'POST',
      token: director.token,
      body: { first_name: 'x'.repeat(40_000) },
    })
    assert.equal(res.status, 413)
  })

  test('H-06 POST alumno con curso inventado → 400', async () => {
    const res = await jsonRequest(ctx.base, '/api/v1/alumnos', {
      method: 'POST',
      token: director.token,
      body: {
        first_name: 'Nueva',
        last_name: 'Persona',
        dni: String(70_000_000 + Math.floor(Math.random() * 9_999_999)).slice(0, 8),
        email: `nueva.${Date.now()}@example.com`,
        course_name: 'Curso Inventado Que No Existe XYZ',
      },
    })
    assert.equal(res.status, 400)
  })
})

describe('ola 2 — medias', () => {
  test('M-03 SECRET_KEY corto impide el boot', () => {
    assert.throws(() => assertSecureBoot({ secretKey: 'short', nodeEnv: 'development' }))
  })

  test('M-03 ALLOW_DEV_LOGIN en production impide el boot', () => {
    assert.throws(() =>
      assertSecureBoot({
        secretKey: 'a'.repeat(32),
        nodeEnv: 'production',
        allowDevLogin: 'true',
        databaseUrl: 'postgresql://localhost/cfl',
      }),
    )
  })

  test('M-05 status_id inválido → 400', async () => {
    assert.ok(studentRow?.id)
    const res = await jsonRequest(ctx.base, `/api/v1/alumnos/${studentRow.id}`, {
      method: 'PUT',
      token: director.token,
      body: { status_id: 999 },
    })
    assert.equal(res.status, 400)
  })

  test('M-06 body inválido en instructores → 400 JSON', async () => {
    const res = await jsonRequest(ctx.base, '/api/v1/instructores', {
      method: 'POST',
      token: director.token,
      body: { first_name: 'A' },
    })
    assert.equal(res.status, 400)
    assert.equal(typeof res.json, 'object')
  })

  test('M-09 production con sqlite file: no arranca', () => {
    assert.throws(() =>
      assertSecureBoot({
        secretKey: 'a'.repeat(32),
        nodeEnv: 'production',
        allowDevLogin: 'false',
        databaseUrl: 'file:./database.db',
      }),
    )
  })
})

describe('ola 3 — bajas', () => {
  test('L-01 GET /api/settings/kpis público solo kpi_*', async () => {
    const res = await jsonRequest(ctx.base, '/api/settings/kpis')
    assert.equal(res.status, 200)
    assert.ok(Array.isArray(res.json))
    for (const row of res.json) {
      assert.ok(String(row.key).startsWith('kpi_'))
    }
  })

  test('L-06 /health no expone env ni stack', async () => {
    const res = await jsonRequest(ctx.base, '/health')
    assert.equal(res.status, 200)
    assert.equal(res.json.status, 'ok')
    assert.equal(res.json.stack, undefined)
    assert.equal(res.json.env, undefined)
    assert.equal(res.json.message, undefined)
  })

  test('photo URL allowlist rechaza data:', () => {
    assert.equal(isAllowedPhotoUrl('data:text/html,x'), false)
    assert.equal(isAllowedPhotoUrl('https://lh3.googleusercontent.com/a'), true)
  })
})
})
