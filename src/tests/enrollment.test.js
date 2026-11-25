import assert from 'node:assert/strict'
import { after, describe, test } from 'node:test'
import prisma from '../lib/prisma.js'
import { databaseDriver } from '../lib/prisma.js'
import { shouldSkipGlobalRateLimit } from '../app.js'
import { countOccupiedSeats, liberarCupo, releaseUnconfirmedOrders, syncCourseEnrollmentStatus } from '../lib/enrollment.js'
import { ensureStatusCatalog } from '../lib/status-catalog.js'

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

describe('matricula', () => {
  test('el catalogo distingue persona, curso e inscripcion', async () => {
    await ensureStatusCatalog()
    const baja = await prisma.status.findUnique({ where: { name: 'baja_requisito' } })
    const persona = await prisma.status.findUnique({ where: { name: 'activo' } })
    const curso = await prisma.status.findUnique({ where: { name: 'inscripcion_abierta' } })
    assert.equal(baja.context, 'inscripcion')
    assert.equal(persona.context, 'persona')
    assert.equal(curso.context, 'curso')
  })

  test('desvincular el unico curso devuelve a la persona a postulante', async () => {
    await ensureStatusCatalog()
    const course = await makeCourse({ quota: 2 })
    const user = await makeUser('activo')
    await enroll(user.id, course.id, true)
    const result = await liberarCupo({ userId: user.id, courseId: course.id, revertToPostulante: true })
    assert.equal(result.released, 1)
    const stored = await prisma.user.findUnique({
      where: { id: user.id },
      include: { role: true, userCourses: { include: { status: true } } },
    })
    assert.equal(stored.role.name, 'postulante')
    assert.equal(stored.userCourses[0].occupiesQuota, false)
    assert.equal(stored.userCourses[0].status.name, 'baja_manual')
  })

  test('liberar un cupo al cambiar de curso no baja el rol', async () => {
    await ensureStatusCatalog()
    const course = await makeCourse({ quota: 2 })
    const user = await makeUser('activo')
    await enroll(user.id, course.id, true)
    await liberarCupo({ userId: user.id, courseId: course.id })
    const stored = await prisma.user.findUnique({
      where: { id: user.id },
      include: { role: true },
    })
    assert.equal(stored.role.name, 'alumno')
  })

  test('el dia de inicio baja la primera orden y llama a la siguiente', async () => {
    await ensureStatusCatalog()
    const now = new Date()
    const course = await prisma.course.create({
      data: {
        name: `Orden test ${Date.now()}-${Math.random().toString(16).slice(2)}`,
        statusId: await statusId('inscripcion_abierta'),
        instructorId: await instructorId(),
        maxAbsences: 4,
        startDate: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12),
        courseDetail: { create: { quota: 1, hourQuantity: 1, classesQuantity: 1 } },
      },
    })
    createdCourseIds.push(course.id)
    const first = await makeUser('pendiente')
    const postulante = await prisma.role.findFirst({ where: { name: 'postulante' } })
    assert.ok(postulante, 'falta el rol postulante')
    await prisma.user.update({ where: { id: first.id }, data: { roleId: postulante.id } })
    const second = await makeUser('pendiente')
    await prisma.userCourse.create({
      data: { userId: first.id, courseId: course.id, occupiesQuota: true, position: 1 },
    })
    await prisma.userCourse.create({
      data: { userId: second.id, courseId: course.id, occupiesQuota: false, position: 2 },
    })
    const result = await releaseUnconfirmedOrders(now)
    assert.equal(result.released, 1)
    const rows = await prisma.userCourse.findMany({
      where: { courseId: course.id },
      include: { status: true },
      orderBy: { position: 'asc' },
    })
    assert.equal(rows[0].occupiesQuota, false)
    assert.equal(rows[0].status.name, 'baja_requisito')
    assert.equal(rows[1].occupiesQuota, true)
  })
})
