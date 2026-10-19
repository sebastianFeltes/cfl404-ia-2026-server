import prisma from './prisma.js'
import { parseStartTimeMinutes } from './attendance-time.js'

export class EnrollmentError extends Error {
  constructor(statusCode, message, details = {}) {
    super(message)
    this.statusCode = statusCode
    this.details = details
  }
}

const OCCUPYING_STATUS_NAMES = ['activo', 'pendiente']

const ENROLLMENT_STATUS_NAMES = {
  open: 'inscripcion_abierta',
  last: 'ultimos_cupos',
  full: 'cupo_completo',
  finished: 'curso_finalizado',
}

function client(db) {
  return db || prisma
}

export async function countOccupiedSeats(courseId, db = prisma) {
  return client(db).userCourse.count({
    where: {
      courseId,
      occupiesQuota: true,
      user: { status: { name: { in: OCCUPYING_STATUS_NAMES } } },
    },
  })
}

async function statusIdByName(name, db) {
  const status = await client(db).status.findUnique({ where: { name } })
  if (!status) {
    const error = new Error(`No existe el status ${name}`)
    error.statusCode = 500
    throw error
  }
  return status.id
}

export async function syncCourseEnrollmentStatus(courseId, db = prisma) {
  const store = client(db)
  const course = await store.course.findUnique({
    where: { id: courseId },
    include: { status: true, courseDetail: true },
  })
  if (!course) return null

  const current = String(course.status?.name || '').toLowerCase()
  const end = course.endDate ? new Date(course.endDate) : null
  const expired = Boolean(end && !Number.isNaN(end.getTime()) && end.getTime() < Date.now())
  if (current === ENROLLMENT_STATUS_NAMES.finished || expired) {
    if (current !== ENROLLMENT_STATUS_NAMES.finished) {
      await store.course.update({
        where: { id: courseId },
        data: { statusId: await statusIdByName(ENROLLMENT_STATUS_NAMES.finished, store) },
      })
    }
    return ENROLLMENT_STATUS_NAMES.finished
  }

  const quota = course.courseDetail?.quota ?? 0
  const occupied = await countOccupiedSeats(courseId, store)
  const available = Math.max(0, quota - occupied)
  let next = ENROLLMENT_STATUS_NAMES.open
  if (quota > 0 && available <= 0) next = ENROLLMENT_STATUS_NAMES.full
  else if (quota > 0 && available <= 3) next = ENROLLMENT_STATUS_NAMES.last

  if (current !== next) {
    await store.course.update({
      where: { id: courseId },
      data: { statusId: await statusIdByName(next, store) },
    })
  }
  return next
}

export async function assignApplicantNumber(userId, db = prisma) {
  const store = client(db)
  const user = await store.user.findUnique({
    where: { id: userId },
    select: { applicantNumber: true },
  })
  if (!user) return null
  if (user.applicantNumber != null) return user.applicantNumber

  const agg = await store.user.aggregate({ _max: { applicantNumber: true } })
  const next = (agg._max.applicantNumber ?? 0) + 1
  const updated = await store.user.update({
    where: { id: userId },
    data: { applicantNumber: next },
    select: { applicantNumber: true },
  })
  return updated.applicantNumber
}

export async function backfillApplicantNumbers(db = prisma) {
  const store = client(db)
  const people = await store.user.findMany({
    where: {
      applicantNumber: null,
      role: { name: { in: ['alumno', 'postulante'] } },
    },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })
  for (const person of people) {
    await assignApplicantNumber(person.id, store)
  }
  return people.length
}

const COURSE_SCHEDULE = {
  include: {
    status: true,
    courseDetail: true,
    courseDays: { select: { dayId: true } },
  },
}

export function profileIsComplete(user) {
  const detail = user?.userDetail || user?.detail || {}
  return Boolean(
    String(user?.firstName || user?.nombres || '').trim()
    && String(user?.lastName || user?.apellidos || '').trim()
    && String(user?.dni || '').trim()
    && String(detail.phone || '').trim()
    && String(detail.address || '').trim()
    && detail.dob,
  )
}

function rangesOverlap(left, right) {
  const leftDays = new Set((left.courseDays || []).map((day) => day.dayId))
  const sharesDay = (right.courseDays || []).some((day) => leftDays.has(day.dayId))
  if (!sharesDay) return false
  const leftStart = parseStartTimeMinutes(left.startTime)
  const leftEnd = parseStartTimeMinutes(left.endTime)
  const rightStart = parseStartTimeMinutes(right.startTime)
  const rightEnd = parseStartTimeMinutes(right.endTime)
  if ([leftStart, leftEnd, rightStart, rightEnd].some((value) => value == null)) return true
  return leftStart < rightEnd && rightStart < leftEnd
}

async function nextPosition(courseId, db) {
  const agg = await client(db).userCourse.aggregate({
    where: { courseId },
    _max: { position: true },
  })
  return (agg._max.position ?? 0) + 1
}

export async function preinscribir({ userId, courseId, requireProfile = true }, db = prisma) {
  const store = client(db)
  return store.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      include: { role: true, status: true, userDetail: true },
    })
    if (!user) throw new EnrollmentError(404, 'Persona no encontrada')

    const roleName = String(user.role?.name || '').toLowerCase()
    if (requireProfile && roleName === 'postulante' && !profileIsComplete(user)) {
      throw new EnrollmentError(403, 'Completá nombre, apellido, DNI, teléfono, dirección y fecha de nacimiento para preinscribirte')
    }

    const course = await tx.course.findUnique({ where: { id: courseId }, ...COURSE_SCHEDULE })
    if (!course) throw new EnrollmentError(404, 'Curso no encontrado')
    if (!parseStartTimeMinutes(course.endTime)) {
      throw new EnrollmentError(400, 'El curso no tiene horario de fin y no acepta preinscripción')
    }

    const currentStatus = String(course.status?.name || '').toLowerCase()
    const end = course.endDate ? new Date(course.endDate) : null
    const expired = Boolean(end && !Number.isNaN(end.getTime()) && end.getTime() < Date.now())
    if (currentStatus === 'curso_finalizado' || expired) {
      throw new EnrollmentError(409, 'El curso está finalizado')
    }

    const existing = await tx.userCourse.findUnique({
      where: { userId_courseId: { userId, courseId } },
    })
    if (existing?.occupiesQuota) {
      throw new EnrollmentError(409, 'Ya estás preinscripto en este curso')
    }

    const others = await tx.userCourse.findMany({
      where: { userId, occupiesQuota: true, NOT: { courseId } },
      include: { course: COURSE_SCHEDULE },
    })
    const clash = others.find((row) => rangesOverlap(course, row.course))
    if (clash) {
      throw new EnrollmentError(409, `Choque de horario con ${clash.course.name}`, { courseName: clash.course.name })
    }

    const quota = course.courseDetail?.quota ?? 0
    const occupied = await countOccupiedSeats(courseId, tx)
    if (!(quota > 0) || occupied >= quota) {
      throw new EnrollmentError(409, 'No hay vacantes en este curso', { code: 'FULL' })
    }

    const position = await nextPosition(courseId, tx)
    const enrollment = existing
      ? await tx.userCourse.update({
        where: { id: existing.id },
        data: { occupiesQuota: true, position },
      })
      : await tx.userCourse.create({
        data: { userId, courseId, occupiesQuota: true, position },
      })

    const enrollmentStatus = await syncCourseEnrollmentStatus(courseId, tx)
    const applicantNumber = roleName === 'postulante' || roleName === 'alumno'
      ? await assignApplicantNumber(userId, tx)
      : user.applicantNumber

    return {
      applicantNumber,
      courseId,
      position: enrollment.position,
      enrollmentStatus,
      userCourseId: enrollment.id,
    }
  })
}

export async function asignarCurso(args, db = prisma) {
  return preinscribir({ ...args, requireProfile: false }, db)
}

export async function liberarCupo({ userId, courseId } = {}, db = prisma) {
  const store = client(db)
  const where = { userId, occupiesQuota: true }
  if (courseId) where.courseId = courseId
  const rows = await store.userCourse.findMany({
    where,
    select: { id: true, courseId: true, position: true },
  })
  if (!rows.length) return { released: 0, positions: [] }

  await store.userCourse.updateMany({
    where: { id: { in: rows.map((row) => row.id) } },
    data: { occupiesQuota: false },
  })

  const courseIds = [...new Set(rows.map((row) => row.courseId))]
  for (const id of courseIds) {
    await syncCourseEnrollmentStatus(id, store)
    await promoteWaiting(id, store)
  }
  return { released: rows.length, positions: rows.map((row) => row.position) }
}

const READY_WINDOW_MS = 10 * 60 * 1000

async function waitingPosition(ticket, db = prisma) {
  const ahead = await client(db).queueTicket.count({
    where: {
      courseId: ticket.courseId,
      status: 'esperando',
      createdAt: { lt: ticket.createdAt },
    },
  })
  return ahead + 1
}

export async function promoteWaiting(courseId, db = prisma) {
  const store = client(db)
  const course = await store.course.findUnique({
    where: { id: courseId },
    include: { courseDetail: true },
  })
  if (!course) return null
  const quota = course.courseDetail?.quota ?? 0
  const occupied = await countOccupiedSeats(courseId, store)
  const available = Math.max(0, quota - occupied)
  const ready = await store.queueTicket.count({
    where: { courseId, status: 'listo', readyUntil: { gt: new Date() } },
  })
  if (available <= ready) return null
  const next = await store.queueTicket.findFirst({
    where: { courseId, status: 'esperando' },
    orderBy: { createdAt: 'asc' },
  })
  if (!next) return null
  return store.queueTicket.update({
    where: { id: next.id },
    data: { status: 'listo', readyUntil: new Date(Date.now() + READY_WINDOW_MS) },
  })
}

export async function expireReadyTickets(courseId, db = prisma) {
  const store = client(db)
  const now = new Date()
  const expired = await store.queueTicket.findMany({
    where: {
      status: 'listo',
      readyUntil: { lt: now },
      ...(courseId ? { courseId } : {}),
    },
    select: { id: true, courseId: true },
  })
  if (!expired.length) return
  await store.queueTicket.updateMany({
    where: { id: { in: expired.map((row) => row.id) } },
    data: { status: 'vencido' },
  })
  const courseIds = [...new Set(expired.map((row) => row.courseId))]
  for (const id of courseIds) {
    await promoteWaiting(id, store)
  }
}

export async function requestPreinscripcion({ userId, courseId }) {
  await expireReadyTickets(courseId)
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { role: true, userDetail: true },
  })
  if (!user) throw new EnrollmentError(404, 'Persona no encontrada')
  if (String(user.role?.name || '').toLowerCase() === 'postulante' && !profileIsComplete(user)) {
    throw new EnrollmentError(403, 'Completá nombre, apellido, DNI, teléfono, dirección y fecha de nacimiento para preinscribirte')
  }

  const active = await prisma.queueTicket.findFirst({
    where: { userId, courseId, status: { in: ['esperando', 'listo'] } },
    orderBy: { createdAt: 'desc' },
  })

  if (active?.status === 'listo' && active.readyUntil && active.readyUntil > new Date()) {
    const result = await preinscribir({ userId, courseId })
    await prisma.queueTicket.update({ where: { id: active.id }, data: { status: 'confirmado' } })
    await promoteWaiting(courseId)
    return { status: 'confirmado', ...result }
  }

  if (active?.status === 'esperando') {
    return {
      status: 'esperando',
      position: await waitingPosition(active),
      applicantNumber: await assignApplicantNumber(userId),
    }
  }

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: { courseDetail: true },
  })
  if (!course) throw new EnrollmentError(404, 'Curso no encontrado')
  const waiting = await prisma.queueTicket.count({ where: { courseId, status: 'esperando' } })
  const ready = await prisma.queueTicket.count({
    where: { courseId, status: 'listo', readyUntil: { gt: new Date() } },
  })
  const occupied = await countOccupiedSeats(courseId)
  const quota = course.courseDetail?.quota ?? 0
  if (waiting > 0 || ready > 0 || !(quota > 0) || occupied + ready >= quota) {
    const ticket = await prisma.queueTicket.create({
      data: { userId, courseId, status: 'esperando' },
    })
    return {
      status: 'esperando',
      position: await waitingPosition(ticket),
      applicantNumber: await assignApplicantNumber(userId),
    }
  }

  const result = await preinscribir({ userId, courseId })
  return { status: 'confirmado', ...result }
}
