import prisma from '../lib/prisma.js'
import { getCourseStageFromDates, formatCourseSchedule, validateCourseStageDates } from '../lib/courseStage.js'
import { parsePagination } from '../lib/pagination.js'
import { assertAllowedPhotoUrl } from '../lib/photo-url.js'

const COURSE_STATUS_UI = {
  ACTIVO: {
    label: 'Activo',
    color: 'bg-emerald-500/10 text-emerald-700 border-emerald-300 dark:text-emerald-400',
    badgeColor: 'bg-emerald-500',
  },
  INACTIVO: {
    label: 'Inactivo',
    color: 'bg-slate-500/10 text-slate-700 border-slate-300 dark:text-slate-400',
    badgeColor: 'bg-slate-500',
  },
  PENDIENTE: {
    label: 'Pendiente',
    color: 'bg-amber-500/10 text-amber-700 border-amber-300 dark:text-amber-400',
    badgeColor: 'bg-amber-500',
  },
  EGRESADO: {
    label: 'Finalizado',
    color: 'bg-gray-500/10 text-gray-700 border-gray-300 dark:text-gray-400',
    badgeColor: 'bg-gray-500',
  },
}

const PUBLIC_INSTRUCTOR_SELECT = {
    id: true,
    firstName: true,
    lastName: true,
    role: { select: { id: true, name: true } },
    status: { select: { id: true, name: true } },
}

const COURSE_INCLUDE = {
  courseDetail: true,
  instructor: {
    select: PUBLIC_INSTRUCTOR_SELECT,
  },
  status: true,
  family: true,
  courseDays: {
    include: { day: true },
    orderBy: { dayId: 'asc' },
  },
  _count: {
    select: { userCourses: true },
  },
}

function toIsoDate(value) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString().slice(0, 10)
}

export function toClientCourse(course) {
  if (!course) return course

  const stage = getCourseStageFromDates({
    startDate: course.startDate,
    endDate: course.endDate,
    isAnnual: course.isAnnual,
  })
  const statusName = course.status?.name || 'ACTIVO'
  const statusUi = COURSE_STATUS_UI[statusName] || COURSE_STATUS_UI.ACTIVO
  const quota = course.courseDetail?.quota ?? 0
  const enrolledCount = course._count?.userCourses ?? 0
  const availableQuota = Math.max(0, quota - enrolledCount)
  const instructorName = course.instructor
    ? `${course.instructor.firstName} ${course.instructor.lastName}`.trim()
    : null
  const schedule = formatCourseSchedule({
    startTime: course.startTime,
    endTime: course.endTime,
    courseDays: course.courseDays,
  })
  const familyName = course.family?.name || null

  return {
    id: course.id,
    name: course.name,
    startDate: course.startDate,
    endDate: course.endDate,
    startTime: course.startTime,
    endTime: course.endTime,
    preEnrollmentDate: course.preEnrollmentDate,
    isAnnual: course.isAnnual,
    statusId: course.statusId,
    instructorId: course.instructorId,
    familyId: course.familyId,
    maxAbsences: course.maxAbsences,
    createdAt: course.createdAt,
    updatedAt: course.updatedAt,
    family: course.family,
    instructor: course.instructor,
    status: {
      id: course.statusId,
      name: statusName,
      label: statusUi.label,
      color: statusUi.color,
      badgeColor: statusUi.badgeColor,
    },
    courseDetail: course.courseDetail,
    courseDays: course.courseDays || [],
    dayIds: (course.courseDays || []).map((item) => item.dayId),
    enrolledCount,
    availableQuota,
    quota,
    category: familyName,
    stage: stage?.label || 'Sin etapa asignada',
    stageKey: stage?.key || null,
    start_date: toIsoDate(course.startDate),
    end_time: toIsoDate(course.endDate),
    preenrollment_date: toIsoDate(course.preEnrollmentDate),
    is_annual: course.isAnnual,
    schedule,
    max_absences: course.maxAbsences,
    staff: instructorName || 'Sin instructor asignado',
    staffId: course.instructorId,
    instructorName,
    sponsor: course.courseDetail?.sponsorName
      ? {
          name: course.courseDetail.sponsorName,
          logo: course.courseDetail.sponsorLogo,
          mention: `Patrocinado por ${course.courseDetail.sponsorName}`,
          badge: course.courseDetail.sponsorName,
        }
      : null,
    detail: {
      description: course.courseDetail?.description || '',
      quota,
      total_quota: quota,
      hour_quantity: course.courseDetail?.hourQuantity ?? 0,
      classes_quantity: course.courseDetail?.classesQuantity ?? 0,
      title_required: course.courseDetail?.titleRequired ? 'Secundario Completo' : 'Primario Completo',
      titleRequired: Boolean(course.courseDetail?.titleRequired),
      endorsement_by: course.courseDetail?.endorsementBy || 'CFP N°404 Berisso',
    },
  }
}

async function resolveInstructorId(instructorId) {
  if (instructorId) {
    const instructor = await prisma.user.findFirst({
      where: {
        id: instructorId,
        role: { name: 'INSTRUCTOR' },
      },
      select: { id: true },
    })
    if (!instructor) {
      const error = new Error('El instructor seleccionado no existe o no tiene rol INSTRUCTOR')
      error.statusCode = 400
      throw error
    }
    return instructor.id
  }

  const fallback = await prisma.user.findFirst({
    where: { role: { name: 'INSTRUCTOR' }, statusId: 1 },
    select: { id: true },
  })
  if (!fallback) {
    const error = new Error('No hay instructores activos para asignar al curso')
    error.statusCode = 400
    throw error
  }
  return fallback.id
}

async function syncCourseDays(tx, courseId, dayIds) {
  await tx.courseDay.deleteMany({ where: { courseId } })
  if (!Array.isArray(dayIds) || dayIds.length === 0) return
  const uniqueIds = [...new Set(dayIds.map(Number).filter(Boolean))]
  if (uniqueIds.length === 0) return
  await tx.courseDay.createMany({
    data: uniqueIds.map((dayId) => ({ courseId, dayId })),
  })
}

export const getCourses = async (req, res, next) => {
  try {
    const { take, skip } = parsePagination(req.query, { defaultTake: 100, maxTake: 100 })
    const courses = await prisma.course.findMany({
      include: COURSE_INCLUDE,
      orderBy: { createdAt: 'desc' },
      take,
      skip,
    })
    res.json(courses.map(toClientCourse))
  } catch (error) {
    next(error)
  }
}

export const getCourseById = async (req, res, next) => {
  try {
    const { id } = req.params
    const course = await prisma.course.findUnique({
      where: { id },
      include: COURSE_INCLUDE,
    })
    if (!course) {
      return res.status(404).json({ message: 'Curso no encontrado' })
    }
    res.json(toClientCourse(course))
  } catch (error) {
    next(error)
  }
}

export const getFamilies = async (req, res, next) => {
  try {
    const families = await prisma.family.findMany({
      orderBy: { name: 'asc' },
    })
    res.json(families)
  } catch (error) {
    next(error)
  }
}

export const getDays = async (req, res, next) => {
  try {
    const days = await prisma.day.findMany({
      orderBy: { id: 'asc' },
    })
    res.json(days)
  } catch (error) {
    next(error)
  }
}

export const createCourse = async (req, res, next) => {
  try {
    const {
      name,
      startDate,
      endDate,
      startTime,
      endTime,
      preEnrollmentDate,
      isAnnual = false,
      statusId = 1,
      instructorId,
      familyId,
      maxAbsences = 4,
      description,
      quota = 25,
      hourQuantity = 120,
      classesQuantity = 32,
      titleRequired = false,
      endorsementBy = 'Ministerio de Educación y Trabajo de la Provincia de Buenos Aires',
      sponsorName,
      sponsorLogo,
      dayIds = [],
    } = req.body

    if (sponsorLogo) assertAllowedPhotoUrl(sponsorLogo)

    const dateError = validateCourseStageDates({ startDate, endDate, isAnnual })
    if (dateError) {
      return res.status(400).json({ message: dateError })
    }

    const targetInstructorId = await resolveInstructorId(instructorId)

    const newCourse = await prisma.$transaction(async (tx) => {
      const created = await tx.course.create({
        data: {
          name,
          statusId: Number(statusId),
          maxAbsences: Number(maxAbsences),
          startTime: startTime || null,
          endTime: endTime || null,
          isAnnual: Boolean(isAnnual),
          instructorId: targetInstructorId,
          familyId: familyId ? Number(familyId) : null,
          preEnrollmentDate: preEnrollmentDate ? new Date(preEnrollmentDate) : null,
          startDate: startDate ? new Date(startDate) : null,
          endDate: endDate ? new Date(endDate) : null,
          courseDetail: {
            create: {
              description: description || null,
              quota: Number(quota),
              hourQuantity: Number(hourQuantity),
              classesQuantity: Number(classesQuantity),
              titleRequired: Boolean(titleRequired),
              endorsementBy,
              sponsorName: sponsorName || null,
              sponsorLogo: sponsorLogo || null,
            },
          },
        },
      })

      await syncCourseDays(tx, created.id, dayIds)

      return tx.course.findUnique({
        where: { id: created.id },
        include: COURSE_INCLUDE,
      })
    })

    res.status(201).json(toClientCourse(newCourse))
  } catch (error) {
    next(error)
  }
}

export const updateCourse = async (req, res, next) => {
  try {
    const { id } = req.params
    const {
      name,
      startDate,
      endDate,
      startTime,
      endTime,
      preEnrollmentDate,
      isAnnual,
      statusId,
      instructorId,
      familyId,
      maxAbsences,
      description,
      quota,
      hourQuantity,
      classesQuantity,
      titleRequired,
      endorsementBy,
      sponsorName,
      sponsorLogo,
      dayIds,
    } = req.body

    const existing = await prisma.course.findUnique({
      where: { id },
      include: { courseDetail: true },
    })
    if (!existing) {
      return res.status(404).json({ message: 'Curso no encontrado' })
    }

    const nextDates = {
      startDate: startDate !== undefined ? startDate : existing.startDate,
      endDate: endDate !== undefined ? endDate : existing.endDate,
      isAnnual: isAnnual !== undefined ? Boolean(isAnnual) : existing.isAnnual,
    }
    const dateError = validateCourseStageDates(nextDates)
    if (dateError) {
      return res.status(400).json({ message: dateError })
    }

    let nextInstructorId
    if (instructorId !== undefined) {
      nextInstructorId = await resolveInstructorId(instructorId)
    }

    const updatedCourse = await prisma.$transaction(async (tx) => {
      const detailData = {
        ...(description !== undefined && { description }),
        ...(quota !== undefined && { quota: Number(quota) }),
        ...(hourQuantity !== undefined && { hourQuantity: Number(hourQuantity) }),
        ...(classesQuantity !== undefined && { classesQuantity: Number(classesQuantity) }),
        ...(titleRequired !== undefined && { titleRequired: Boolean(titleRequired) }),
        ...(endorsementBy !== undefined && { endorsementBy }),
        ...(sponsorName !== undefined && { sponsorName }),
        ...(sponsorLogo !== undefined && { sponsorLogo }),
      }

      await tx.course.update({
        where: { id },
        data: {
          ...(name && { name }),
          ...(statusId !== undefined && { statusId: Number(statusId) }),
          ...(maxAbsences !== undefined && { maxAbsences: Number(maxAbsences) }),
          ...(isAnnual !== undefined && { isAnnual: Boolean(isAnnual) }),
          ...(startTime !== undefined && { startTime: startTime || null }),
          ...(endTime !== undefined && { endTime: endTime || null }),
          ...(startDate !== undefined && { startDate: startDate ? new Date(startDate) : null }),
          ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
          ...(preEnrollmentDate !== undefined && {
            preEnrollmentDate: preEnrollmentDate ? new Date(preEnrollmentDate) : null,
          }),
          ...(nextInstructorId && { instructorId: nextInstructorId }),
          ...(familyId !== undefined && { familyId: familyId ? Number(familyId) : null }),
          ...(Object.keys(detailData).length > 0 && {
            courseDetail: existing.courseDetail
              ? { update: detailData }
              : {
                  create: {
                    description: description || null,
                    quota: Number(quota ?? 25),
                    hourQuantity: Number(hourQuantity ?? 120),
                    classesQuantity: Number(classesQuantity ?? 32),
                    titleRequired: Boolean(titleRequired),
                    endorsementBy: endorsementBy || 'Ministerio de Educación y Trabajo de la Provincia de Buenos Aires',
                    sponsorName: sponsorName || null,
                    sponsorLogo: sponsorLogo || null,
                  },
                },
          }),
        },
      })

      if (dayIds !== undefined) {
        await syncCourseDays(tx, id, dayIds)
      }

      return tx.course.findUnique({
        where: { id },
        include: COURSE_INCLUDE,
      })
    })

    res.json(toClientCourse(updatedCourse))
  } catch (error) {
    next(error)
  }
}

export const deleteCourse = async (req, res, next) => {
  try {
    const { id } = req.params

    const existing = await prisma.course.findUnique({ where: { id } })
    if (!existing) {
      return res.status(404).json({ message: 'Curso no encontrado' })
    }

    await prisma.$transaction(async (tx) => {
      const userCourses = await tx.userCourse.findMany({
        where: { courseId: id },
        select: { id: true },
      })
      const userCourseIds = userCourses.map((item) => item.id)
      if (userCourseIds.length > 0) {
        await tx.attendance.deleteMany({
          where: { userCourseId: { in: userCourseIds } },
        })
      }
      await tx.userCourse.deleteMany({ where: { courseId: id } })
      await tx.classroomCourse.deleteMany({ where: { courseId: id } })
      await tx.courseDay.deleteMany({ where: { courseId: id } })
      await tx.courseDetail.deleteMany({ where: { courseId: id } })
      await tx.course.delete({ where: { id } })
    })

    res.json({ message: 'Curso eliminado correctamente', id })
  } catch (error) {
    next(error)
  }
}
