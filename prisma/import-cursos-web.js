import prisma from '../src/lib/prisma.js'
import {
  CURSOS_WEB_2026,
  LEGACY_COURSE_NAMES,
  PLACEHOLDER_INSTRUCTOR_EMAIL,
} from './cursos-web-2026.js'

const ENDORSEMENT = 'Ministerio de Educación y Trabajo de la Provincia de Buenos Aires'

function dateOnly(value) {
  return new Date(`${value}T12:00:00.000Z`)
}

async function placeholderInstructor() {
  const existing = await prisma.user.findUnique({ where: { email: PLACEHOLDER_INSTRUCTOR_EMAIL } })
  if (existing) return existing

  const role = await prisma.role.findFirst({
    where: { name: { in: ['INSTRUCTOR', 'instructor'] } },
  })
  if (!role) throw new Error('No existe el rol INSTRUCTOR')

  return prisma.user.create({
    data: {
      firstName: 'Sin',
      lastName: 'asignar',
      email: PLACEHOLDER_INSTRUCTOR_EMAIL,
      statusId: 1,
      roleId: role.id,
    },
  })
}

async function familyId(name) {
  const family = await prisma.family.findFirst({ where: { name } })
  if (!family) throw new Error(`No existe la familia ${name}`)
  return family.id
}

async function dayId(name) {
  const day = await prisma.day.findFirst({ where: { name } })
  if (!day) throw new Error(`No existe el día ${name}`)
  return day.id
}

async function findCourse(item) {
  const names = [item.name, ...(item.aliases || [])]
  for (const name of names) {
    const course = await prisma.course.findFirst({ where: { name } })
    if (course) return course
  }
  return null
}

async function main() {
  const instructor = await placeholderInstructor()
  const realNames = new Set(CURSOS_WEB_2026.map((item) => item.name))

  for (const item of CURSOS_WEB_2026) {
    const data = {
      name: item.name,
      statusId: item.statusId,
      instructorId: instructor.id,
      familyId: await familyId(item.family),
      maxAbsences: item.maxAbsences,
      isAnnual: item.isAnnual,
      startDate: dateOnly(item.startDate),
      endDate: dateOnly(item.endDate),
      startTime: item.startTime,
      endTime: item.endTime,
      preEnrollmentDate: dateOnly(item.preEnrollmentDate),
    }

    const current = await findCourse(item)
    const course = current
      ? await prisma.course.update({ where: { id: current.id }, data })
      : await prisma.course.create({ data })

    await prisma.courseDetail.upsert({
      where: { courseId: course.id },
      update: {
        description: item.description,
        quota: item.quota,
        hourQuantity: item.hourQuantity,
        classesQuantity: item.classesQuantity,
        titleRequired: item.titleRequired,
        endorsementBy: ENDORSEMENT,
      },
      create: {
        courseId: course.id,
        description: item.description,
        quota: item.quota,
        hourQuantity: item.hourQuantity,
        classesQuantity: item.classesQuantity,
        titleRequired: item.titleRequired,
        endorsementBy: ENDORSEMENT,
      },
    })

    await prisma.courseSponsor.deleteMany({ where: { courseId: course.id } })
    await prisma.courseDay.deleteMany({ where: { courseId: course.id } })
    for (const name of item.days) {
      await prisma.courseDay.create({
        data: { courseId: course.id, dayId: await dayId(name) },
      })
    }

    const action = current ? (current.name === item.name ? 'actualizado' : `renombrado desde "${current.name}"`) : 'creado'
    console.log(`✅ ${item.name} (${action})`)
  }

  for (const name of LEGACY_COURSE_NAMES) {
    if (realNames.has(name)) continue
    const legacy = await prisma.course.findFirst({ where: { name } })
    if (!legacy || legacy.statusId === 2) continue
    await prisma.course.update({ where: { id: legacy.id }, data: { statusId: 2 } })
    console.log(`⏸️ Inactivo: ${name}`)
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
