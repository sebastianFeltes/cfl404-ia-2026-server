import assert from 'node:assert/strict'
import { after, before, describe, test } from 'node:test'
import { jsonRequest, prisma, startTestServer, tokenForEmail } from './helpers.js'
import { ensureAttendanceToken } from '../lib/attendance-token.js'

let ctx
let director
let contralor
let alumno
let studentWithToken

describe('API de asistencia', () => {
  before(async () => {
    ctx = await startTestServer()
    director = await tokenForEmail('directivo.test@cfl404.edu.ar')
    alumno = await tokenForEmail('alumno.test@cfl404.edu.ar')

    let contralorUser = await prisma.user.findUnique({
      where: { email: 'contralor.test@cfl404.edu.ar' },
      include: { role: true, status: true },
    })

    let contralorRole = await prisma.role.findFirst({ where: { name: 'contralor' } })
    if (!contralorRole) {
      contralorRole = await prisma.role.create({ data: { id: 10, name: 'contralor' } })
    }

    if (!contralorUser) {
      contralorUser = await prisma.user.create({
        data: {
          firstName: 'Roberto',
          lastName: 'Contralor',
          email: 'contralor.test@cfl404.edu.ar',
          dni: '28444555',
          statusId: 1,
          roleId: contralorRole.id,
          acceptedTerms: true,
        },
        include: { role: true, status: true },
      })
    }

    const { signAccessToken } = await import('../lib/auth-tokens.js')
    contralor = {
      token: signAccessToken(contralorUser, 'STAFF'),
      user: contralorUser,
    }

    studentWithToken = await prisma.user.findFirst({
      where: { role: { name: 'alumno' }, status: { name: 'activo' } },
      include: {
        userCourses: { include: { course: { include: { courseDays: true } } } },
      },
    })

    if (studentWithToken) {
      try {
        await ensureAttendanceToken(studentWithToken.id)
      } catch {
        // Columna attendance_token aún no migrada en la DB local
      }
      studentWithToken = await prisma.user.findUnique({
        where: { id: studentWithToken.id },
        include: {
          userCourses: { include: { course: { include: { courseDays: true } } } },
        },
      })
    }
  })

  after(async () => {
    await ctx.close()
    await prisma.$disconnect()
  })

  test('GET /api/attendance/courses sin token → 401', async () => {
    const res = await jsonRequest(ctx.base, '/api/attendance/courses')
    assert.equal(res.status, 401)
  })

  test('GET /api/attendance/courses con DIRECTOR → 200', async () => {
    const res = await jsonRequest(ctx.base, '/api/attendance/courses', { token: director.token })
    assert.equal(res.status, 200)
    assert.ok(Array.isArray(res.json.data))
  })

  test('POST /api/attendance/scan sin token → 401', async () => {
    const res = await jsonRequest(ctx.base, '/api/attendance/scan', {
      method: 'POST',
      body: { attendance_token: 'fake' },
    })
    assert.equal(res.status, 401)
  })

  test('POST /api/attendance/scan con DIRECTOR → 403', async () => {
    const res = await jsonRequest(ctx.base, '/api/attendance/scan', {
      method: 'POST',
      token: director.token,
      body: { attendance_token: 'fake' },
    })
    assert.equal(res.status, 403)
  })

  test('POST /api/attendance/scan con god autorizado → no 403 por rol', async () => {
    const godUser = await prisma.user.findFirst({
      where: { role: { name: 'god' } },
      include: { role: true, status: true },
    })
    assert.ok(godUser, 'debe existir un usuario god en seed')

    const { signAccessToken } = await import('../lib/auth-tokens.js')
    const token = signAccessToken(godUser, 'STAFF')

    const res = await jsonRequest(ctx.base, '/api/attendance/scan', {
      method: 'POST',
      token,
      body: { attendance_token: 'fake' },
    })
    assert.notEqual(res.status, 403)
    assert.equal(res.status, 400)
  })

  test('POST /api/attendance/scan con token inválido → 400', async () => {
    const res = await jsonRequest(ctx.base, '/api/attendance/scan', {
      method: 'POST',
      token: contralor.token,
      body: { attendance_token: 'token-inventado-no-valido' },
    })
    assert.equal(res.status, 400)
    assert.match(String(res.json.error), /inválido|generado/i)
  })

  test('POST /api/attendance/scan con alumno → 403', async () => {
    const res = await jsonRequest(ctx.base, '/api/attendance/scan', {
      method: 'POST',
      token: alumno.token,
      body: { attendance_token: 'x' },
    })
    assert.equal(res.status, 403)
  })

  test('GET /api/attendance/course/:id con curso inexistente → 404', async () => {
    const res = await jsonRequest(ctx.base, '/api/attendance/course/00000000-0000-0000-0000-000000000000', {
      token: director.token,
    })
    assert.equal(res.status, 404)
  })

  test('GET /api/attendance/course/:id devuelve grilla', async () => {
    const course = await prisma.course.findFirst({
      where: { status: { name: 'activo' } },
      select: { id: true },
    })
    assert.ok(course?.id)

    const res = await jsonRequest(ctx.base, `/api/attendance/course/${course.id}`, {
      token: director.token,
    })
    assert.equal(res.status, 200)
    assert.equal(res.json.status, 'success')
    assert.ok(Array.isArray(res.json.dates))
    assert.ok(Array.isArray(res.json.students))
  })

  test('POST /api/attendance/scan con token válido responde según horario/día', async () => {
    if (!studentWithToken?.attendanceToken) {
      return // Requiere db:push + db:seed con columna attendance_token
    }

    const res = await jsonRequest(ctx.base, '/api/attendance/scan', {
      method: 'POST',
      token: contralor.token,
      body: { attendance_token: studentWithToken.attendanceToken },
    })

    assert.ok([200, 400, 404].includes(res.status), `status inesperado: ${res.status}`)
    if (res.status === 200) {
      assert.equal(res.json.status, 'success')
      assert.ok(res.json.student?.id)
      assert.ok(Array.isArray(res.json.results))
    }
  })

  test('promoción a alumno genera attendance_token', async () => {
    const postulanteRole = await prisma.role.findFirst({ where: { name: 'postulante' } })
    const unique = Date.now()
    const created = await prisma.user.create({
      data: {
        firstName: 'Test',
        lastName: 'Postulante',
        email: `postulante.${unique}@example.com`,
        dni: String(50_000_000 + (unique % 9_000_000)).slice(0, 8),
        statusId: 3,
        roleId: postulanteRole.id,
        acceptedTerms: true,
      },
    })

    const res = await jsonRequest(ctx.base, `/api/v1/alumnos/${created.id}`, {
      method: 'PUT',
      token: director.token,
      body: { role_name: 'alumno', status_id: 1 },
    })
    assert.equal(res.status, 200)
    if (res.json?.data?.attendance_token) {
      assert.match(res.json.data.attendance_token, /CFL404-ATT-/)
    }

    const updated = await prisma.user.findUnique({ where: { id: created.id } })
    if ('attendanceToken' in (updated || {})) {
      assert.ok(updated.attendanceToken)
      assert.match(updated.attendanceToken, /CFL404-ATT-/)
    }
  })
})
