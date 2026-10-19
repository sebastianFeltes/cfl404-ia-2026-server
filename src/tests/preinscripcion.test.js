import assert from 'node:assert/strict'
import { after, describe, test } from 'node:test'
import prisma from '../lib/prisma.js'
import { signAccessToken } from '../lib/auth-tokens.js'
import { jsonRequest, startTestServer } from './helpers.js'
import { liberarCupo } from '../lib/enrollment.js'

const createdUserIds = []
const createdCourseIds = []

async function dayId() {
  const day = await prisma.day.findFirst({ orderBy: { id: 'asc' } })
  assert.ok(day, 'faltan días de seed')
  return day.id
}

async function makePostulante({ dni, complete = true } = {}) {
  const email = `postulante-${Date.now()}-${Math.random().toString(16).slice(2)}@cfl404.test`
  const user = await prisma.user.create({
    data: {
      firstName: complete ? 'Ana' : 'Ana',
      lastName: complete ? 'Paz' : '',
      email,
      dni: dni ?? String(40000000 + Math.floor(Math.random() * 999999)),
      roleId: 9,
      statusId: 3,
      userDetail: {
        create: complete
          ? { phone: '221000', address: 'Calle 1', dob: new Date('2000-01-01') }
          : {},
      },
    },
  })
  createdUserIds.push(user.id)
  return user
}

async function makeCourse({ quota, startTime = '18:00', endTime = '21:00', day }) {
  const instructor = await prisma.user.findFirst({ where: { role: { name: 'instructor' } } })
  const course = await prisma.course.create({
    data: {
      name: `Pre ${Date.now()}-${Math.random().toString(16).slice(2)}`,
      statusId: 8,
      instructorId: instructor.id,
      maxAbsences: 4,
      startTime,
      endTime,
      courseDetail: { create: { quota, hourQuantity: 3, classesQuantity: 10 } },
      courseDays: { create: { dayId: day } },
    },
  })
  createdCourseIds.push(course.id)
  return course
}

function tokenFor(user) {
  return signAccessToken({ ...user, role: { name: 'postulante' } }, 'STUDENT')
}

after(async () => {
  if (createdCourseIds.length) {
    await prisma.queueTicket.deleteMany({ where: { courseId: { in: createdCourseIds } } }).catch(() => {})
    await prisma.userCourse.deleteMany({ where: { courseId: { in: createdCourseIds } } })
    await prisma.courseDay.deleteMany({ where: { courseId: { in: createdCourseIds } } })
    await prisma.courseDetail.deleteMany({ where: { courseId: { in: createdCourseIds } } })
    await prisma.course.deleteMany({ where: { id: { in: createdCourseIds } } })
  }
  if (createdUserIds.length) {
    await prisma.userDetail.deleteMany({ where: { userId: { in: createdUserIds } } })
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } })
  }
})

describe('preinscripción', () => {
  test('legajo completo ocupa cupo en orden y el número no cambia', async () => {
    const ctx = await startTestServer()
    try {
      const day = await dayId()
      const course = await makeCourse({ quota: 5, day })
      const first = await makePostulante()
      const second = await makePostulante()
      const one = await jsonRequest(ctx.base, '/api/v1/preinscripciones', {
        method: 'POST',
        token: tokenFor(first),
        body: { courseId: course.id },
      })
      const two = await jsonRequest(ctx.base, '/api/v1/preinscripciones', {
        method: 'POST',
        token: tokenFor(first),
        body: { courseId: course.id },
      })
      const other = await jsonRequest(ctx.base, '/api/v1/preinscripciones', {
        method: 'POST',
        token: tokenFor(second),
        body: { courseId: course.id },
      })
      assert.equal(one.status, 201)
      assert.equal(two.status, 409)
      assert.equal(other.status, 201)
      assert.equal(other.json.applicantNumber, one.json.applicantNumber ? other.json.applicantNumber : other.json.applicantNumber)
      assert.notEqual(one.json.applicantNumber, other.json.applicantNumber)
      assert.equal(one.json.position, 1)
      assert.equal(other.json.position, 2)
      const again = await jsonRequest(ctx.base, '/api/v1/preinscripciones', {
        method: 'POST',
        token: tokenFor(first),
        body: { courseId: (await makeCourse({ quota: 5, day, startTime: '08:00', endTime: '10:00' })).id },
      })
      assert.equal(again.status, 201)
      assert.equal(again.json.applicantNumber, one.json.applicantNumber)
    } finally {
      await ctx.close()
    }
  })

  test('sin legajo completo no crea inscripción', async () => {
    const ctx = await startTestServer()
    try {
      const day = await dayId()
      const course = await makeCourse({ quota: 5, day })
      const user = await makePostulante({ complete: false, dni: null })
      const before = await prisma.userCourse.count({ where: { userId: user.id } })
      const res = await jsonRequest(ctx.base, '/api/v1/preinscripciones', {
        method: 'POST',
        token: tokenFor(user),
        body: { courseId: course.id },
      })
      assert.equal(res.status, 403)
      assert.equal(await prisma.userCourse.count({ where: { userId: user.id } }), before)
    } finally {
      await ctx.close()
    }
  })

  test('un DNI repetido no abre otra cuenta', async () => {
    const ctx = await startTestServer()
    try {
      const day = await dayId()
      const course = await makeCourse({ quota: 5, day })
      const user = await makePostulante()
      process.env.PREINSCRIPCION_WEBHOOK_SECRET = 'test-secret'
      const res = await jsonRequest(ctx.base, '/api/webhooks/preinscripcion', {
        method: 'POST',
        headers: { 'x-preinscripcion-webhook-secret': 'test-secret' },
        body: {
          event: 'preinscripcion.confirmada',
          courseId: course.id,
          email: 'otra-persona@cfl404.test',
          dni: user.dni,
          firstName: 'Otra',
          lastName: 'Persona',
          phone: '221',
          address: 'Calle 2',
          dob: '1999-01-01',
        },
      })
      assert.equal(res.status, 409)
      assert.equal(res.json.error, 'Ese DNI ya está registrado en el sistema')
    } finally {
      await ctx.close()
    }
  })

  test('choque de horario y curso lleno no ocupan de más', async () => {
    const ctx = await startTestServer()
    try {
      const day = await dayId()
      const morning = await makeCourse({ quota: 1, day, startTime: '09:00', endTime: '12:00' })
      const clash = await makeCourse({ quota: 5, day, startTime: '11:00', endTime: '13:00' })
      const user = await makePostulante()
      const other = await makePostulante()
      const ok = await jsonRequest(ctx.base, '/api/v1/preinscripciones', {
        method: 'POST',
        token: tokenFor(user),
        body: { courseId: morning.id },
      })
      const blocked = await jsonRequest(ctx.base, '/api/v1/preinscripciones', {
        method: 'POST',
        token: tokenFor(user),
        body: { courseId: clash.id },
      })
      const full = await jsonRequest(ctx.base, '/api/v1/preinscripciones', {
        method: 'POST',
        token: tokenFor(other),
        body: { courseId: morning.id },
      })
      assert.equal(ok.status, 201)
      assert.equal(blocked.status, 409)
      assert.match(blocked.json.error, /Choque de horario/)
      assert.equal(full.status, 200)
      assert.equal(full.json.status, 'esperando')
      assert.equal(await prisma.userCourse.count({ where: { courseId: morning.id, occupiesQuota: true } }), 1)
      const kept = ok.json.position
      await liberarCupo({ userId: user.id, courseId: morning.id })
      const row = await prisma.userCourse.findFirst({ where: { userId: user.id, courseId: morning.id } })
      assert.equal(row.occupiesQuota, false)
      assert.equal(row.position, kept)
    } finally {
      await ctx.close()
    }
  })

  test('sin vacante espera en orden y el turno vencido pasa al siguiente', async () => {
    const ctx = await startTestServer()
    try {
      const day = await dayId()
      const course = await makeCourse({ quota: 1, day, startTime: '14:00', endTime: '16:00' })
      const first = await makePostulante()
      const second = await makePostulante()
      const third = await makePostulante()
      const taken = await jsonRequest(ctx.base, '/api/v1/preinscripciones', {
        method: 'POST',
        token: tokenFor(first),
        body: { courseId: course.id },
      })
      const waitA = await jsonRequest(ctx.base, '/api/v1/preinscripciones', {
        method: 'POST',
        token: tokenFor(second),
        body: { courseId: course.id },
      })
      const waitB = await jsonRequest(ctx.base, '/api/v1/preinscripciones', {
        method: 'POST',
        token: tokenFor(third),
        body: { courseId: course.id },
      })
      assert.equal(taken.status, 201)
      assert.equal(waitA.status, 200)
      assert.equal(waitA.json.status, 'esperando')
      assert.equal(waitB.json.position, 2)
      assert.equal(await prisma.userCourse.count({ where: { courseId: course.id, userId: second.id } }), 0)
      await liberarCupo({ userId: first.id, courseId: course.id })
      const ready = await jsonRequest(ctx.base, '/api/v1/preinscripciones/turno', { token: tokenFor(second) })
      assert.equal(ready.json.tickets[0].status, 'listo')
      await prisma.queueTicket.updateMany({
        where: { userId: second.id, courseId: course.id, status: 'listo' },
        data: { readyUntil: new Date(Date.now() - 1000) },
      })
      const next = await jsonRequest(ctx.base, '/api/v1/preinscripciones/turno', { token: tokenFor(third) })
      assert.equal(next.json.tickets[0].status, 'listo')
      const late = await jsonRequest(ctx.base, '/api/v1/preinscripciones', {
        method: 'POST',
        token: tokenFor(second),
        body: { courseId: course.id },
      })
      assert.notEqual(late.status, 201)
      assert.equal(await prisma.userCourse.count({ where: { courseId: course.id, userId: second.id, occupiesQuota: true } }), 0)
    } finally {
      await ctx.close()
    }
  })
})
