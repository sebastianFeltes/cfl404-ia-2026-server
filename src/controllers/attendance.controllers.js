import prisma from '../lib/prisma.js'
import { normalizeAttendanceToken, extractUserIdFromAttendanceToken, buildAttendanceTokenFromUserId } from '../lib/attendance-token.js'
import {
  abbreviateAttendanceCode,
  getArgentinaDateKey,
  getArgentinaDayBoundsUtc,
  getArgentinaDayNumber,
  getArgentinaMinutes,
  getArgentinaMonthYear,
  parseStartTimeMinutes,
  resolveAttendanceCodeName,
} from '../lib/attendance-time.js'

export const getAttendance = async (req, res) => {
  res.json({
    message: 'obteniendo asistencia'
  })
}

export const verifyAndRegisterAttendance = async (req, res, next) => {
  try {
    const { token, course_id, id_code } = req.body

    if (!token || !String(token).trim()) {
      return res.status(400).json({ error: 'Token de asistencia requerido' })
    }

    const cleanToken = String(token).trim()

    // 1. Búsqueda directa indexada por attendanceToken
    let student = await prisma.user.findFirst({
      where: { attendanceToken: cleanToken },
      include: {
        userCourses: {
          where: course_id ? { courseId: course_id } : undefined,
          include: { course: true },
        },
      },
    })

    // 2. Fallback resiliente: extraer ID si el token tiene formato CFL404-ATT-{id}
    if (!student) {
      const uuidMatch = cleanToken.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i)
      const targetId = uuidMatch ? uuidMatch[1] : (cleanToken.startsWith('CFL404-ATT-') ? cleanToken.slice(11) : cleanToken)

      student = await prisma.user.findFirst({
        where: { id: targetId },
        include: {
          userCourses: {
            where: course_id ? { courseId: course_id } : undefined,
            include: { course: true },
          },
        },
      })

      // Sincronizar automáticamente el token en la base de datos si fue encontrado por ID
      if (student) {
        await prisma.user.update({
          where: { id: student.id },
          data: { attendanceToken: `CFL404-ATT-${student.id}` },
        }).catch(() => {})
      }
    }

    if (!student) {
      return res.status(404).json({ error: 'Código QR / Token no válido o no asignado a ningún alumno' })
    }

    const userCourse = student.userCourses?.[0]
    if (!userCourse) {
      return res.status(400).json({
        error: `El alumno ${student.firstName} ${student.lastName} no se encuentra inscripto en este curso`,
      })
    }

    // Verificar si ya se registró la asistencia hoy para evitar duplicados
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date()
    todayEnd.setHours(23, 59, 59, 999)

    const existingAttendance = await prisma.attendance.findFirst({
      where: {
        userCourseId: userCourse.id,
        createdAt: {
          gte: todayStart,
          lte: todayEnd,
        },
      },
      include: { attendanceCode: true },
    })

    if (existingAttendance) {
      return res.status(200).json({
        status: 'success',
        already_registered: true,
        message: `La asistencia de ${student.firstName} ${student.lastName} ya fue registrada hoy (${existingAttendance.attendanceCode?.name || 'Presente'})`,
        data: {
          student: {
            id: student.id,
            first_name: student.firstName,
            last_name: student.lastName,
            email: student.email,
            course: userCourse.course.name,
          },
          attendance_id: existingAttendance.id,
          registered_at: existingAttendance.createdAt,
        },
      })
    }

    const targetCode = Number(id_code) || 1 // 1 = Presente

    const attendance = await prisma.attendance.create({
      data: {
        userCourseId: userCourse.id,
        idCode: targetCode,
      },
      include: { attendanceCode: true },
    })

    return res.status(201).json({
      status: 'success',
      already_registered: false,
      message: `¡Asistencia confirmada para ${student.firstName} ${student.lastName}!`,
      data: {
        student: {
          id: student.id,
          first_name: student.firstName,
          last_name: student.lastName,
          email: student.email,
          course: userCourse.course.name,
        },
        attendance_id: attendance.id,
        status: attendance.attendanceCode?.name || 'presente',
        registered_at: attendance.createdAt,
      },
    })
  } catch (error) {
    next(error)
  }
}

const ABSENCE_CODE_NAMES = ['ausente', 'media falta']

async function loadAttendanceCodesMap() {
  const codes = await prisma.attendanceCode.findMany()
  const byName = new Map()
  for (const code of codes) {
    byName.set(code.name.toLowerCase(), code)
  }
  return byName
}

async function findTodayAttendance(userCourseId, referenceDate = new Date()) {
  const { startUtc, endUtc } = getArgentinaDayBoundsUtc(referenceDate)
  return prisma.attendance.findFirst({
    where: {
      userCourseId,
      createdAt: { gte: startUtc, lte: endUtc },
    },
    include: { attendanceCode: true },
  })
}

async function countUsedAbsences(userCourseId) {
  return prisma.attendance.count({
    where: {
      userCourseId,
      attendanceCode: { name: { in: ABSENCE_CODE_NAMES } },
    },
  })
}

async function hasCooperadoraPayment(userId, referenceDate = new Date()) {
  const { month, year } = getArgentinaMonthYear(referenceDate)
  const payment = await prisma.cooperadoraPayment.findUnique({
    where: {
      userId_month_year: { userId, month, year },
    },
  })
  return Boolean(payment)
}

async function buildCourseScanResult(enrollment, userId, now, codesMap) {
  const startMinutes = parseStartTimeMinutes(enrollment.course.startTime)
  if (startMinutes === null) {
    return {
      course_id: enrollment.course.id,
      course_name: enrollment.course.name,
      error: 'El curso no tiene horario de inicio configurado',
    }
  }

  const currentMinutes = getArgentinaMinutes(now)
  const minutesFromStart = currentMinutes - startMinutes
  const resolved = resolveAttendanceCodeName(minutesFromStart)
  if (resolved.error) {
    return {
      course_id: enrollment.course.id,
      course_name: enrollment.course.name,
      error: resolved.error,
    }
  }

  const codeRecord = codesMap.get(resolved.codeName)
  if (!codeRecord) {
    const error = new Error(`Código de asistencia "${resolved.codeName}" no configurado`)
    error.statusCode = 500
    throw error
  }

  const existing = await findTodayAttendance(enrollment.id, now)
  let attendance

  if (existing) {
    attendance = await prisma.attendance.update({
      where: { id: existing.id },
      data: { idCode: codeRecord.id },
      include: { attendanceCode: true },
    })
  } else {
    attendance = await prisma.attendance.create({
      data: {
        userCourseId: enrollment.id,
        idCode: codeRecord.id,
      },
      include: { attendanceCode: true },
    })
  }

  const usedAbsences = await countUsedAbsences(enrollment.id)
  const cooperadoraPaid = await hasCooperadoraPayment(userId, now)
  const { month, year } = getArgentinaMonthYear(now)

  return {
    course_id: enrollment.course.id,
    course_name: enrollment.course.name,
    attendance_id: attendance.id,
    code: abbreviateAttendanceCode(attendance.attendanceCode.name),
    code_name: attendance.attendanceCode.name,
    date: getArgentinaDateKey(now),
    updated: Boolean(existing),
    max_absences: enrollment.course.maxAbsences,
    used_absences: usedAbsences,
    remaining_absences: Math.max(0, enrollment.course.maxAbsences - usedAbsences),
    cooperadora_paid: cooperadoraPaid,
    cooperadora_month: month,
    cooperadora_year: year,
  }
}

export const scanAttendance = async (req, res, next) => {
  try {
    const rawInput = String(req.body?.attendance_token ?? req.body?.token ?? '').trim()
    if (!rawInput) {
      return res.status(400).json({ error: 'Se requiere attendance_token' })
    }

    const normalizedToken = normalizeAttendanceToken(rawInput)
    if (!normalizedToken) {
      return res.status(400).json({ error: 'Formato de credencial inválido' })
    }

    let userByToken = await prisma.user.findUnique({
      where: { attendanceToken: normalizedToken },
      include: { role: true, status: true },
    })

    if (!userByToken) {
      const userId = extractUserIdFromAttendanceToken(normalizedToken)
      if (userId) {
        userByToken = await prisma.user.findUnique({
          where: { id: userId },
          include: { role: true, status: true },
        })
        if (userByToken) {
          const syncedToken = buildAttendanceTokenFromUserId(userId)
          await prisma.user.update({
            where: { id: userId },
            data: { attendanceToken: syncedToken },
          }).catch(() => {})
        }
      }
    }

    if (!userByToken) {
      return res.status(400).json({ error: 'Token de asistencia inválido o no generado por el sistema' })
    }

    if (String(userByToken.role?.name || '').toLowerCase() !== 'alumno') {
      return res.status(400).json({ error: 'El token no corresponde a un alumno activo' })
    }

    if (String(userByToken.status?.name || '').toLowerCase() !== 'activo') {
      return res.status(400).json({ error: 'El alumno no está activo' })
    }

    const now = new Date()
    const dayNumber = getArgentinaDayNumber(now)
    const dateKey = getArgentinaDateKey(now)

    const userCourses = await prisma.userCourse.findMany({
      where: {
        userId: userByToken.id,
        course: {
          status: { name: 'activo' },
          courseDays: { some: { dayId: dayNumber } },
        },
      },
      include: {
        course: {
          include: { courseDays: { include: { day: true } } },
        },
      },
    })

    if (userCourses.length === 0) {
      return res.status(404).json({
        error: 'No se encontraron cursos activos para este alumno en el día de hoy',
        student: {
          id: userByToken.id,
          first_name: userByToken.firstName,
          last_name: userByToken.lastName,
        },
      })
    }

    const codesMap = await loadAttendanceCodesMap()
    const results = []

    for (const enrollment of userCourses) {
      results.push(await buildCourseScanResult(enrollment, userByToken.id, now, codesMap))
    }

    const successful = results.filter((r) => r.attendance_id)
    if (successful.length === 0) {
      return res.status(400).json({
        error: 'No se pudo registrar asistencia en ningún curso',
        student: {
          id: userByToken.id,
          first_name: userByToken.firstName,
          last_name: userByToken.lastName,
        },
        results,
      })
    }

    return res.status(200).json({
      status: 'success',
      message: successful.length === 1
        ? 'Asistencia registrada correctamente'
        : `Asistencia registrada en ${successful.length} cursos`,
      student: {
        id: userByToken.id,
        first_name: userByToken.firstName,
        last_name: userByToken.lastName,
      },
      date: dateKey,
      results: successful,
    })
  } catch (error) {
    next(error)
  }
}

export const getAttendanceByCourse = async (req, res, next) => {
  try {
    const { courseId } = req.params

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, name: true },
    })

    if (!course) {
      return res.status(404).json({ error: 'Curso no encontrado' })
    }

    const enrollments = await prisma.userCourse.findMany({
      where: {
        courseId,
        user: { role: { name: 'alumno' } },
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, statusId: true } },
        attendances: {
          include: { attendanceCode: true },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: [{ user: { lastName: 'asc' } }, { user: { firstName: 'asc' } }],
    })

    const datesSet = new Set()
    const students = enrollments.map((enrollment) => {
      const records = {}
      for (const attendance of enrollment.attendances) {
        const dateKey = getArgentinaDateKey(attendance.createdAt)
        datesSet.add(dateKey)
        records[dateKey] = abbreviateAttendanceCode(attendance.attendanceCode.name)
      }
      return {
        id: enrollment.user.id,
        user_course_id: enrollment.id,
        first_name: enrollment.user.firstName,
        last_name: enrollment.user.lastName,
        status_id: enrollment.user.statusId,
        records,
      }
    })

    const dates = [...datesSet].sort()

    return res.status(200).json({
      status: 'success',
      course: {
        id: course.id,
        name: course.name,
      },
      dates,
      students,
    })
  } catch (error) {
    next(error)
  }
}

export const getAttendanceCourses = async (_req, res, next) => {
  try {
    const courses = await prisma.course.findMany({
      where: { status: { name: 'activo' } },
      select: {
        id: true,
        name: true,
        startTime: true,
        endTime: true,
        _count: {
          select: {
            userCourses: {
              where: { user: { role: { name: 'alumno' } } },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    })

    return res.status(200).json({
      status: 'success',
      data: courses.map((course) => ({
        id: course.id,
        name: course.name,
        start_time: course.startTime,
        end_time: course.endTime,
        student_count: course._count.userCourses,
      })),
    })
  } catch (error) {
    next(error)
  }
}
