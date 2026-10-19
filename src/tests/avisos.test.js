import assert from 'node:assert/strict'
import { after, describe, test } from 'node:test'
import prisma from '../lib/prisma.js'
import { signAccessToken } from '../lib/auth-tokens.js'
import { jsonRequest, startTestServer } from './helpers.js'

const createdUserIds = []
const createdCourseIds = []
const createdAvisoIds = []

function tokenFor(user, roleName) {
  return signAccessToken({ ...user, role: { name: roleName }, roleId: user.roleId }, roleName === 'alumno' ? 'STUDENT' : 'STAFF')
}

async function makeUser(roleId) {
  const email = `aviso-${Date.now()}-${Math.random().toString(16).slice(2)}@cfl404.test`
  const user = await prisma.user.create({
    data: {
      firstName: 'Nora',
      lastName: 'Avisos',
      email,
      dni: String(50000000 + Math.floor(Math.random() * 999999)),
      roleId,
      statusId: 1,
    },
  })
  createdUserIds.push(user.id)
  return user
}

async function makeCourse() {
  const instructor = await prisma.user.findFirst({ where: { role: { name: 'instructor' } } })
  const course = await prisma.course.create({
    data: {
      name: `Aviso ${Date.now()}`,
      statusId: 8,
      instructorId: instructor.id,
      maxAbsences: 4,
      startTime: '18:00',
      endTime: '20:00',
      courseDetail: { create: { quota: 20, hourQuantity: 2, classesQuantity: 8 } },
    },
  })
  createdCourseIds.push(course.id)
  return course
}

after(async () => {
  if (createdAvisoIds.length) await prisma.aviso.deleteMany({ where: { id: { in: createdAvisoIds } } })
  if (createdCourseIds.length) {
    await prisma.userCourse.deleteMany({ where: { courseId: { in: createdCourseIds } } })
    await prisma.courseDetail.deleteMany({ where: { courseId: { in: createdCourseIds } } })
    await prisma.course.deleteMany({ where: { id: { in: createdCourseIds } } })
  }
  if (createdUserIds.length) await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } })
})

describe('avisos', () => {
  test('borrador, curso y archivo no se mezclan con los derivados', async () => {
    const ctx = await startTestServer()
    try {
      const director = await makeUser(3)
      const enrolled = await makeUser(8)
      const outsider = await makeUser(8)
      const course = await makeCourse()
      await prisma.userCourse.create({ data: { userId: enrolled.id, courseId: course.id, occupiesQuota: true, position: 1 } })
      const draft = await jsonRequest(ctx.base, '/api/v1/avisos', {
        method: 'POST',
        token: tokenFor(director, 'director'),
        body: {
          title: 'Borrador',
          body: 'No sale',
          type: 'academico',
          audience: 'alumnos',
          publication: 'borrador',
          courseId: course.id,
        },
      })
      const published = await jsonRequest(ctx.base, '/api/v1/avisos', {
        method: 'POST',
        token: tokenFor(director, 'director'),
        body: {
          title: 'Clase movida',
          body: 'El jueves no hay clase',
          type: 'academico',
          audience: 'alumnos',
          publication: 'publicado',
          courseId: course.id,
          priority: 5,
        },
      })
      assert.equal(draft.status, 201)
      assert.equal(published.status, 201)
      createdAvisoIds.push(draft.json.aviso.id, published.json.aviso.id)

      const seen = await jsonRequest(ctx.base, '/api/mobile/avisos', { token: tokenFor(enrolled, 'alumno') })
      const hidden = await jsonRequest(ctx.base, '/api/mobile/avisos', { token: tokenFor(outsider, 'alumno') })
      assert.equal(seen.status, 200)
      assert.ok(seen.json.avisos.some((item) => item.id === published.json.aviso.id && item.type === 'academico' && item.message === 'El jueves no hay clase'))
      assert.equal(seen.json.avisos.some((item) => item.id === draft.json.aviso.id), false)
      assert.equal(hidden.json.avisos.some((item) => item.id === published.json.aviso.id), false)

      const archived = await jsonRequest(ctx.base, `/api/v1/avisos/${published.json.aviso.id}`, {
        method: 'DELETE',
        token: tokenFor(director, 'director'),
      })
      assert.equal(archived.status, 200)
      const row = await prisma.aviso.findUnique({ where: { id: published.json.aviso.id } })
      assert.equal(row.publication, 'archivado')
      const afterArchive = await jsonRequest(ctx.base, '/api/mobile/avisos', { token: tokenFor(enrolled, 'alumno') })
      assert.equal(afterArchive.json.avisos.some((item) => item.id === published.json.aviso.id), false)
      assert.ok(afterArchive.json.avisos.some((item) => String(item.id).startsWith('cooperadora-')))
    } finally {
      await ctx.close()
    }
  })
})
