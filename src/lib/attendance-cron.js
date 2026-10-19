import prisma from './prisma.js'
import {
  getArgentinaDateKey,
  getArgentinaDayBoundsUtc,
  getArgentinaDayNumber,
  getArgentinaMinutes,
  parseStartTimeMinutes,
} from './attendance-time.js'

const OPEN_COURSE_STATUSES = ['activo', 'inscripcion_abierta', 'ultimos_cupos', 'cupo_completo']

export async function markLateAbsences(now = new Date()) {
  const dayNumber = getArgentinaDayNumber(now)
  const dateKey = getArgentinaDateKey(now)
  const currentMinutes = getArgentinaMinutes(now)
  const { startUtc, endUtc } = getArgentinaDayBoundsUtc(now)
  const ausente = await prisma.attendanceCode.findFirst({ where: { name: 'ausente' } })
  if (!ausente) return { marked: 0 }

  const courses = await prisma.course.findMany({
    where: {
      status: { name: { in: OPEN_COURSE_STATUSES } },
      courseDays: { some: { dayId: dayNumber } },
    },
    select: {
      id: true,
      startTime: true,
      userCourses: {
        where: { occupiesQuota: true },
        select: { id: true },
      },
    },
  })

  let marked = 0
  for (const course of courses) {
    const start = parseStartTimeMinutes(course.startTime)
    if (start == null || currentMinutes - start < 46) continue
    const ids = course.userCourses.map((row) => row.id)
    if (!ids.length) continue
    const existing = await prisma.attendance.findMany({
      where: {
        userCourseId: { in: ids },
        OR: [
          { sessionDate: dateKey },
          { sessionDate: null, createdAt: { gte: startUtc, lte: endUtc } },
        ],
      },
      select: { userCourseId: true },
    })
    const have = new Set(existing.map((row) => row.userCourseId))
    const missing = ids.filter((id) => !have.has(id))
    if (!missing.length) continue
    const result = await prisma.attendance.createMany({
      data: missing.map((userCourseId) => ({
        userCourseId,
        idCode: ausente.id,
        sessionDate: dateKey,
      })),
    })
    marked += result.count
  }
  return { marked }
}

export function startAttendanceCron() {
  const tick = () => {
    markLateAbsences().catch((error) => {
      console.error('[attendance-cron]', error)
    })
  }
  tick()
  const timer = setInterval(tick, 60 * 1000)
  if (typeof timer.unref === 'function') timer.unref()
  return timer
}
