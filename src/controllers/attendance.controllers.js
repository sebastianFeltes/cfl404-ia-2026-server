import prisma from '../lib/prisma.js'

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