import assert from 'node:assert/strict'
import { after, describe, test } from 'node:test'
import prisma from '../lib/prisma.js'
import { databaseDriver } from '../lib/prisma.js'
import { shouldSkipGlobalRateLimit } from '../app.js'
import { countOccupiedSeats, syncCourseEnrollmentStatus } from '../lib/enrollment.js'

const createdUserIds = []
const createdCourseIds = []

async function statusId(name) {
  const status = await prisma.status.findUnique({ where: { name } })
  assert.ok(status, `falta el status ${name}`)
  return status.id
}

async function instructorId() {
  const instructor = await prisma.user.findFirst({
    where: { role: { name: 'instructor' } },
    select: { id: true },
  })
  assert.ok(instructor, 'falta un instructor de seed')
  return instructor.id
}

async function makeUser(statusName) {
  const role = await prisma.role.findUnique({ where: { id: 8 } })
  const email = `cupo-${statusName}-${Date.now()}-${Math.random().toString(16).slice(2)}@cfl404.test`
  const user = await prisma.user.create({
    data: {
      firstName: 'Cupo',
      lastName: statusName,
      email,
      statusId: await statusId(statusName),
      roleId: role?.id ?? 8,
      userDetail: { create: {} },
    },
  })
  createdUserIds.push(user.id)
  return user
}

async function makeCourse({ quota, endDate, statusName = 'inscripcion_abierta' }) {
  const course = await prisma.course.create({
    data: {
      name: `Cupo test ${Date.now()}-${Math.random().toString(16).slice(2)}`,
      statusId: await statusId(statusName),
      instructorId: await instructorId(),
      maxAbsences: 4,
      endDate: endDate ?? null,
      courseDetail: { create: { quota, hourQuantity: 1, classesQuantity: 1 } },
    },
  })
  createdCourseIds.push(course.id)
  return course
}

async function enroll(userId, courseId, occupiesQuota = true) {
  return prisma.userCourse.create({
    data: { userId, courseId, occupiesQuota, position: 1 },
  })
}

after(async () => {
  if (createdCourseIds.length) {
    await prisma.userCourse.deleteMany({ where: { courseId: { in: createdCourseIds } } })
    await prisma.courseDetail.deleteMany({ where: { courseId: { in: createdCourseIds } } })
    await prisma.course.deleteMany({ where: { id: { in: createdCourseIds } } })
  }
  if (createdUserIds.length) {
    await prisma.userDetail.deleteMany({ where: { userId: { in: createdUserIds } } })
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } })
  }
})

describe('cupo', () => {
  test('un inactivo y una inscripción liberada no ocupan asiento', async () => {
    const course = await makeCourse({ quota: 10 })
    const active = await makeUser('activo')
    const inactive = await makeUser('inactivo')
    const released = await makeUser('pendiente')
    await enroll(active.id, course.id, true)
    await enroll(inactive.id, course.id, true)
    await enroll(released.id, course.id, false)

    assert.equal(await countOccupiedSeats(course.id), 1)
  })

  test('0 vacantes deja el curso en cupo completo', async () => {
    const course = await makeCourse({ quota: 1, statusName: 'activo' })
    const active = await makeUser('activo')
    await enroll(active.id, course.id)
    assert.equal(await syncCourseEnrollmentStatus(course.id), 'cupo_completo')
  })

  test('3 vacantes dejan el curso en últimos cupos', async () => {
    const course = await makeCourse({ quota: 4, statusName: 'activo' })
    const active = await makeUser('activo')
    await enroll(active.id, course.id)
    assert.equal(await syncCourseEnrollmentStatus(course.id), 'ultimos_cupos')
  })

  test('4 vacantes dejan el curso en inscripción abierta', async () => {
    const course = await makeCourse({ quota: 4, statusName: 'activo' })
    assert.equal(await syncCourseEnrollmentStatus(course.id), 'inscripcion_abierta')
  })

  test('un curso vencido no se reabre aunque haya vacantes', async () => {
    const course = await makeCourse({
      quota: 10,
      statusName: 'curso_finalizado',
      endDate: new Date('2000-01-01T00:00:00.000Z'),
    })
    assert.equal(await syncCourseEnrollmentStatus(course.id), 'curso_finalizado')
    const stored = await prisma.course.findUnique({
      where: { id: course.id },
      include: { status: true },
    })
    assert.equal(stored.status.name, 'curso_finalizado')
  })
})

describe('pico', () => {
  test('una URL postgres no usa el driver sqlite', () => {
    assert.equal(databaseDriver('postgresql://localhost/cfl'), 'postgres')
    assert.equal(databaseDriver('file:./database.db'), 'sqlite')
  })

  test('el catálogo y la preinscripción no entran al límite global por IP', () => {
    assert.equal(shouldSkipGlobalRateLimit({ method: 'GET', path: '/courses' }), true)
    assert.equal(shouldSkipGlobalRateLimit({ method: 'POST', path: '/api/v1/preinscripciones' }), true)
    assert.equal(shouldSkipGlobalRateLimit({ method: 'POST', path: '/api/v1/alumnos' }), false)
  })
})
