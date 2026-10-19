import assert from 'node:assert/strict'
import { after, before, describe, test } from 'node:test'
import { jsonRequest, prisma, startTestServer, tokenForEmail } from './helpers.js'
import { hashPassword } from '../lib/password.js'

let ctx
let alumno
let director

describe('rutas /api/mobile', () => {
  before(async () => {
    ctx = await startTestServer()
    alumno = await tokenForEmail('alumno.test@cfl404.edu.ar')
    director = await tokenForEmail('directivo.test@cfl404.edu.ar')
    const alumnoHash = await hashPassword('Alumno404!')
    const directorHash = await hashPassword('Directivo404!')
    await prisma.user.update({
      where: { email: 'alumno.test@cfl404.edu.ar' },
      data: { passwordHash: alumnoHash },
    })
    await prisma.user.update({
      where: { email: 'directivo.test@cfl404.edu.ar' },
      data: { passwordHash: directorHash },
    })
  })

  after(async () => {
    await ctx.close()
  })

  test('sin token, las rutas del alumno responden 401', async () => {
    const courses = await jsonRequest(ctx.base, '/api/mobile/courses')
    const me = await jsonRequest(ctx.base, '/api/mobile/auth/me')
    assert.equal(courses.status, 401)
    assert.equal(me.status, 401)
  })

  test('un directivo no entra a la app', async () => {
    const res = await jsonRequest(ctx.base, '/api/mobile/courses', { token: director.token })
    assert.equal(res.status, 403)
  })

  test('el alumno lee su perfil, sus cursadas y la credencial', async () => {
    const me = await jsonRequest(ctx.base, '/api/mobile/auth/me', { token: alumno.token })
    const courses = await jsonRequest(ctx.base, '/api/mobile/courses', { token: alumno.token })
    const credential = await jsonRequest(ctx.base, '/api/mobile/credential', { token: alumno.token })

    assert.equal(me.status, 200)
    assert.equal(me.json.user.role, 'alumno')
    assert.equal(me.json.user.courses, undefined)

    assert.equal(courses.status, 200)
    assert.ok(Array.isArray(courses.json.courses))

    assert.equal(credential.status, 200)
    assert.match(credential.json.attendanceToken, /^CFL404-ATT-/)
  })

  test('el detalle de un curso ajeno no se entrega', async () => {
    const res = await jsonRequest(ctx.base, '/api/mobile/courses/curso-inexistente', {
      token: alumno.token,
    })
    assert.equal(res.status, 404)
  })

  test('el alumno lee avisos, beneficios, contacto, ayuda y su cooperadora', async () => {
    const headers = { token: alumno.token }
    const avisos = await jsonRequest(ctx.base, '/api/mobile/avisos', headers)
    const beneficios = await jsonRequest(ctx.base, '/api/mobile/beneficios', headers)
    const contacto = await jsonRequest(ctx.base, '/api/mobile/contacto', headers)
    const ayuda = await jsonRequest(ctx.base, '/api/mobile/ayuda', headers)
    const cooperadora = await jsonRequest(ctx.base, '/api/mobile/cooperadora', headers)
    const acerca = await jsonRequest(ctx.base, '/api/mobile/acerca', headers)

    assert.equal(avisos.status, 200)
    assert.ok(Array.isArray(avisos.json.avisos))

    assert.equal(beneficios.status, 200)
    assert.ok(beneficios.json.beneficios.length >= 1)
    assert.equal(typeof beneficios.json.beneficios[0].nombre, 'string')

    assert.equal(contacto.status, 200)
    assert.equal(contacto.json.email, 'cfp404berisso@abc.gob.ar')
    assert.equal(typeof contacto.json.social.whatsapp, 'string')

    assert.equal(ayuda.status, 200)
    assert.ok(ayuda.json.topics.some((topic) => topic.id === 'qr'))

    assert.equal(cooperadora.status, 200)
    assert.equal(cooperadora.json.bank.alias, 'coop.cfl.404')
    assert.equal(cooperadora.json.months.length, 12)
    assert.ok(cooperadora.json.months.every((month) => typeof month.paid === 'boolean'))

    assert.equal(acerca.status, 200)
    assert.equal(acerca.json.appName, 'CFL 404')
    assert.equal(acerca.json.support.email, 'cfp404berisso@abc.gob.ar')
    assert.ok(Array.isArray(acerca.json.creators))
    assert.ok(acerca.json.creators.length >= 1)
  })

  test('el detalle de una cursada propia incluye el historial y no el de otro alumno', async () => {
    const course = await prisma.course.findFirst({ select: { id: true } })
    assert.ok(course?.id, 'hace falta al menos un curso en la base')

    const where = { userId_courseId: { userId: alumno.user.id, courseId: course.id } }
    const existing = await prisma.userCourse.findUnique({ where })
    if (!existing) {
      await prisma.userCourse.create({ data: { userId: alumno.user.id, courseId: course.id } })
    }

    try {
      const detail = await jsonRequest(ctx.base, `/api/mobile/courses/${course.id}`, {
        token: alumno.token,
      })
      assert.equal(detail.status, 200)
      assert.equal(detail.json.course.id, course.id)
      assert.ok(Array.isArray(detail.json.attendanceHistory))
      assert.equal(typeof detail.json.absenceCount, 'number')

      const foreign = await jsonRequest(ctx.base, `/api/mobile/courses/${course.id}`, {
        token: director.token,
      })
      assert.equal(foreign.status, 403)
    } finally {
      if (!existing) {
        await prisma.userCourse.delete({ where })
      }
    }
  })

  test('sin token, el resto de la app también responde 401', async () => {
    for (const path of ['/api/mobile/avisos', '/api/mobile/beneficios', '/api/mobile/contacto', '/api/mobile/cooperadora', '/api/mobile/acerca']) {
      const res = await jsonRequest(ctx.base, path)
      assert.equal(res.status, 401, path)
    }
  })

  test('el fallback mobile rechaza un mail que no es alumno', async () => {
    const previousEnv = process.env.NODE_ENV
    const previousFlag = process.env.ALLOW_DEV_LOGIN
    process.env.NODE_ENV = 'development'
    process.env.ALLOW_DEV_LOGIN = 'true'
    try {
      const staff = await jsonRequest(ctx.base, '/api/mobile/auth/dev-login', {
        method: 'POST',
        body: { email: 'directivo.test@cfl404.edu.ar' },
      })
      const unknown = await jsonRequest(ctx.base, '/api/mobile/auth/dev-login', {
        method: 'POST',
        body: { email: 'nadie@cfl404.edu.ar' },
      })
      assert.equal(staff.status, 403)
      assert.equal(staff.json.error, 'No sos alumno del centro')
      assert.equal(unknown.status, 403)
      assert.equal(unknown.json.error, 'No sos alumno del centro')
    } finally {
      process.env.NODE_ENV = previousEnv
      process.env.ALLOW_DEV_LOGIN = previousFlag
    }
  })

  test('el login con DNI usa la misma regla de alumno en la app', async () => {
    const weak = await jsonRequest(ctx.base, '/api/mobile/auth/login', {
      method: 'POST',
      body: { dni: '40123456', password: 'corta' },
    })
    const wrong = await jsonRequest(ctx.base, '/api/mobile/auth/login', {
      method: 'POST',
      body: { dni: alumno.user.dni, password: 'OtraClave1!' },
    })
    const loggedAlumno = await jsonRequest(ctx.base, '/api/mobile/auth/login', {
      method: 'POST',
      body: { dni: alumno.user.dni, password: 'Alumno404!' },
    })
    const staff = await jsonRequest(ctx.base, '/api/mobile/auth/login', {
      method: 'POST',
      body: { dni: director.user.dni, password: 'Directivo404!' },
    })
    const webStaff = await jsonRequest(ctx.base, '/api/auth/login', {
      method: 'POST',
      body: { dni: director.user.dni, password: 'Directivo404!' },
    })

    assert.equal(weak.status, 400)
    assert.equal(wrong.status, 401)
    assert.equal(loggedAlumno.status, 200)
    assert.equal(loggedAlumno.json.user.role, 'alumno')
    assert.equal(loggedAlumno.json.user.passwordHash, undefined)
    assert.equal(staff.status, 403)
    assert.equal(staff.json.error, 'No sos alumno del centro')
    assert.equal(webStaff.status, 200)
    assert.equal(webStaff.json.user.role, 'director')
  })
})
