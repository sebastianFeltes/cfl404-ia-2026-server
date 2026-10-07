import { randomUUID } from 'node:crypto'
import prisma from '../lib/prisma.js'
import { parsePagination } from '../lib/pagination.js'
import { assertAllowedPhotoUrl } from '../lib/photo-url.js'
import { parseAcceptedTerms } from '../lib/accepted-terms.js'
import { ensureAttendanceToken, buildAttendanceTokenFromUserId } from '../lib/attendance-token.js'

const STATUS_MAP = {
  1: 'activo',
  2: 'inactivo',
  3: 'pendiente',
  4: 'egresado',
}

const STATUS_TO_ID = {
  activo: 1,
  inactivo: 2,
  pendiente: 3,
  egresado: 4,
}

const VALID_STATUS_IDS = new Set([1, 2, 3, 4])
const STUDENT_ROLE_NAMES = ['alumno', 'postulante']
const STAFF_ROLE_IDS = new Set([1, 2, 3, 4, 5, 6, 7])
const STATUS_INACTIVO = 2

async function resolveExistingCourse(courseName) {
  if (!courseName || !String(courseName).trim()) return null

  const value = String(courseName).trim()
  const byId = await prisma.course.findUnique({ where: { id: value } }).catch(() => null)
  if (byId) return byId

  const byName = await prisma.course.findFirst({ where: { name: value } })
  if (!byName) {
    const error = new Error('El curso indicado no existe')
    error.statusCode = 400
    throw error
  }
  return byName
}

async function findStudentById(id) {
  return prisma.user.findFirst({
    where: { id, role: { name: { in: STUDENT_ROLE_NAMES } } },
    include: studentInclude,
  })
}

function resolveStudentRoleName(roleName) {
  if (!roleName) return 'alumno'
  const normalized = String(roleName).trim().toLowerCase()
  if (['postulante', 'aspirante', 'aspirantes', 'postulantes'].includes(normalized)) {
    return 'postulante'
  }
  if (['alumno', 'estudiante', 'estudiantes', 'student', 'students', 'alumnos'].includes(normalized)) {
    return 'alumno'
  }
  const error = new Error('El rol del alumno solo puede ser alumno o postulante')
  error.statusCode = 400
  throw error
}

const studentInclude = {
  userDetail: true,
  userCourses: {
    include: {
      course: {
        include: {
          instructor: true,
          classroomCourses: {
            include: {
              classroom: true,
            },
          },
          courseDays: {
            include: {
              day: true,
            },
          },
        },
      },
    },
  },
  role: true,
  status: true,
}

function formatStudent(s) {
  const primaryUserCourse = s.userCourses?.[0]
  const courseObj = primaryUserCourse?.course
  const activeCourse = courseObj?.name || 'Sin curso asignado'
  const statusText = STATUS_MAP[s.statusId] || String(s.status?.name || 'activo').toLowerCase()
  const roleName = String(s.role?.name || '').toLowerCase()
  const isAspirante = s.statusId === 3 || roleName === 'postulante'

  const instructorName = courseObj?.instructor
    ? `Prof. ${courseObj.instructor.firstName} ${courseObj.instructor.lastName}`.trim()
    : null
  const schedule = (courseObj?.startTime && courseObj?.endTime)
    ? `${courseObj.startTime} a ${courseObj.endTime} hs`
    : (courseObj?.startTime ? `${courseObj.startTime} hs` : null)
  const classroomName = courseObj?.classroomCourses?.[0]?.classroom?.name 
    ? (courseObj.classroomCourses[0].classroom.name.charAt(0).toUpperCase() + courseObj.classroomCourses[0].classroom.name.slice(1))
    : null
  const days = courseObj?.courseDays?.map(cd => cd.day?.name).filter(Boolean).join(', ') || null
  const maxAbsences = courseObj?.maxAbsences ?? null

  return {
    id: s.id,
    first_name: s.firstName,
    last_name: s.lastName,
    dni: s.dni,
    email: s.email,
    phone: s.userDetail?.phone || '',
    extra_phone: s.userDetail?.extraPhone || '',
    extra_email: s.userDetail?.extraEmail || '',
    address: s.userDetail?.address || '',
    dob: s.userDetail?.dob ? new Date(s.userDetail.dob).toLocaleDateString('es-AR') : '',
    gender: s.userDetail?.gender || '',
    nacionality: s.userDetail?.nacionality || 'Argentina',
    academic_level: s.userDetail?.academicLevel || 'Secundario',
    course_name: activeCourse,
    course: activeCourse,
    instructor_name: instructorName,
    course_schedule: schedule,
    classroom_name: classroomName,
    course_days: days,
    max_absences: maxAbsences,
    enrollment_date: new Date(s.createdAt).toLocaleDateString('es-AR'),
    status_id: s.statusId,
    status: statusText,
    is_present: s.statusId === 1,
    is_aspirante: isAspirante,
    role_name: roleName || (isAspirante ? 'postulante' : 'alumno'),
    attendance_token: s.attendanceToken || (roleName === 'alumno' && s.id ? buildAttendanceTokenFromUserId(s.id) : null),
    profile_photo_url: s.profilePhotoUrl,
    accepted_terms: Boolean(s.acceptedTerms),
    acceptedTerms: Boolean(s.acceptedTerms),
    dni_copy: true,
    form_copy: true,
    title_copy: true,
    studentDetail: s.userDetail,
    studentCourses: s.userCourses,
    createdAt: s.createdAt,
  }
}

export const getAlumnos = async (req, res, next) => {
  try {
    const { take, skip, page } = parsePagination(req.query)

    const where = { role: { name: { in: STUDENT_ROLE_NAMES } } }
    const [students, total] = await Promise.all([
      prisma.user.findMany({
        where,
        include: studentInclude,
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      prisma.user.count({ where }),
    ])

    const formattedStudents = students.map(formatStudent)

    return res.status(200).json({
      status: 'success',
      count: formattedStudents.length,
      total,
      page,
      data: formattedStudents,
    })
  } catch (error) {
    next(error)
  }
}

export const getAlumnoById = async (req, res, next) => {
  try {
    const { id } = req.params
    const student = await findStudentById(id)

    if (!student) {
      return res.status(404).json({
        error: 'Alumno no encontrado',
      })
    }

    return res.status(200).json({
      status: 'success',
      data: formatStudent(student),
    })
  } catch (error) {
    next(error)
  }
}

export const createAlumno = async (req, res, next) => {
  try {
    const {
      first_name,
      last_name,
      dni,
      email,
      phone,
      extra_phone,
      extra_email,
      address,
      dob,
      gender,
      nacionality,
      course_name,
      course,
      academic_level,
      status,
      status_id,
      role_name,
      profile_photo_url,
      accepted_terms,
      acceptedTerms,
      attendance_token,
    } = req.body

    if (req.body.role_id !== undefined) {
      return res.status(400).json({ error: 'No se admite role_id en alumnos' })
    }

    if (status_id !== undefined && !VALID_STATUS_IDS.has(status_id)) {
      return res.status(400).json({ error: 'status_id inválido' })
    }

    assertAllowedPhotoUrl(profile_photo_url)
    const parsedTerms = parseAcceptedTerms(accepted_terms ?? acceptedTerms)

    const existingStudent = await prisma.user.findFirst({
      where: {
        OR: [{ dni }, { email }],
      },
    })

    if (existingStudent) {
      const conflictField = existingStudent.dni === dni ? 'DNI' : 'Email'
      return res.status(409).json({
        error: `Ya existe un alumno registrado con ese ${conflictField}`,
      })
    }

    const targetRoleName = resolveStudentRoleName(role_name)
    const alumnoRole = await prisma.role.findFirst({
      where: { name: targetRoleName },
    })

    if (!alumnoRole) {
      return res.status(500).json({ error: 'Rol de alumno no configurado en el sistema' })
    }

    let finalStatusId = 1
    if (status_id) {
      finalStatusId = status_id
    } else if (status) {
      finalStatusId = STATUS_TO_ID[String(status).toLowerCase()] || 1
    } else if (targetRoleName === 'postulante') {
      finalStatusId = 3
    }

    const studentId = randomUUID()
    const computedToken = attendance_token || `CFL404-ATT-${studentId}`

    const newStudent = await prisma.user.create({
      data: {
        id: studentId,
        firstName: first_name,
        lastName: last_name,
        dni,
        email,
        statusId: finalStatusId,
        roleId: alumnoRole.id,
        profilePhotoUrl: profile_photo_url || null,
        acceptedTerms: parsedTerms === true,
        attendanceToken: computedToken,
        userDetail: {
          create: {
            phone: phone || null,
            extraPhone: extra_phone || null,
            extraEmail: extra_email || null,
            address: address || null,
            dob: dob ? new Date(dob) : null,
            gender: gender || null,
            nacionality: nacionality || 'Argentina',
            academicLevel: academic_level || 'Secundario',
            dniCopy: 'true',
            formCopy: 'true',
            titleCopy: 'true',
          },
        },
      },
      include: {
        userDetail: true,
        role: true,
      },
    })

    const selectedCourseName = course_name || course
    if (selectedCourseName) {
      const targetCourse = await resolveExistingCourse(selectedCourseName)
      if (targetCourse) {
        await prisma.userCourse.create({
          data: {
            userId: newStudent.id,
            courseId: targetCourse.id,
          },
        })
      }
    }

    const isAspirante = newStudent.statusId === 3 || targetRoleName === 'postulante'

    let attendanceToken = null
    if (targetRoleName === 'alumno') {
      attendanceToken = attendance_token || buildAttendanceTokenFromUserId(newStudent.id)
      await prisma.user.update({
        where: { id: newStudent.id },
        data: { attendanceToken },
      })
    }

    return res.status(201).json({
      status: 'success',
      message: 'Alumno registrado exitosamente en la base de datos',
      data: {
        id: newStudent.id,
        first_name: newStudent.firstName,
        last_name: newStudent.lastName,
        dni: newStudent.dni,
        email: newStudent.email,
        phone: newStudent.userDetail?.phone || '',
        address: newStudent.userDetail?.address || '',
        academic_level: newStudent.userDetail?.academicLevel || 'Secundario',
        course_name: selectedCourseName || 'Sin curso asignado',
        course: selectedCourseName || 'Sin curso asignado',
        enrollment_date: new Date(newStudent.createdAt).toLocaleDateString('es-AR'),
        status_id: newStudent.statusId,
        status: STATUS_MAP[newStudent.statusId] || 'activo',
        is_present: newStudent.statusId === 1,
        is_aspirante: isAspirante,
        role_name: targetRoleName,
        attendance_token: attendanceToken || newStudent.attendanceToken || null,
        profile_photo_url: newStudent.profilePhotoUrl,
        accepted_terms: Boolean(newStudent.acceptedTerms),
        acceptedTerms: Boolean(newStudent.acceptedTerms),
        dni_copy: true,
        form_copy: true,
        title_copy: true,
        createdAt: newStudent.createdAt,
      },
    })
  } catch (error) {
    next(error)
  }
}

export const updateAlumno = async (req, res, next) => {
  try {
    const { id } = req.params
    const {
      first_name,
      last_name,
      dni,
      email,
      phone,
      extra_phone,
      extra_email,
      address,
      dob,
      gender,
      nacionality,
      course_name,
      course,
      academic_level,
      status,
      status_id,
      role_name,
      profile_photo_url,
      accepted_terms,
      acceptedTerms,
      attendance_token,
    } = req.body

    if (req.body.role_id !== undefined) {
      return res.status(400).json({ error: 'No se admite role_id en alumnos' })
    }

    if (status_id !== undefined && !VALID_STATUS_IDS.has(status_id)) {
      return res.status(400).json({ error: 'status_id inválido' })
    }

    if (profile_photo_url !== undefined) {
      assertAllowedPhotoUrl(profile_photo_url)
    }

    const studentExists = await prisma.user.findFirst({
      where: { id, role: { name: { in: STUDENT_ROLE_NAMES } } },
    })

    if (!studentExists) {
      return res.status(404).json({
        error: 'Alumno no encontrado para actualizar',
      })
    }

    let finalStatusId = undefined
    if (status_id !== undefined) {
      finalStatusId = status_id
    } else if (status) {
      finalStatusId = STATUS_TO_ID[String(status).toLowerCase()]
    }

    const parsedTerms = parseAcceptedTerms(accepted_terms ?? acceptedTerms)

    let targetRoleId = undefined
    if (role_name) {
      const targetRoleName = resolveStudentRoleName(role_name)
      const roleRecord = await prisma.role.findFirst({
        where: { name: targetRoleName },
      })
      if (roleRecord) {
        targetRoleId = roleRecord.id
      }
    }

    const updatedStudent = await prisma.user.update({
      where: { id },
      data: {
        ...(first_name && { firstName: first_name }),
        ...(last_name && { lastName: last_name }),
        ...(dni && { dni }),
        ...(email && { email }),
        ...(finalStatusId !== undefined && { statusId: finalStatusId }),
        ...(targetRoleId !== undefined && { roleId: targetRoleId }),
        ...(profile_photo_url !== undefined && { profilePhotoUrl: profile_photo_url }),
        ...(attendance_token !== undefined
          ? { attendanceToken: attendance_token }
          : (!studentExists.attendanceToken ? { attendanceToken: buildAttendanceTokenFromUserId(id) } : {})),
        ...(parsedTerms !== undefined && { acceptedTerms: parsedTerms }),
        userDetail: {
          upsert: {
            create: {
              phone: phone || null,
              extraPhone: extra_phone || null,
              extraEmail: extra_email || null,
              address: address || null,
              dob: dob ? new Date(dob) : null,
              gender: gender || null,
              nacionality: nacionality || 'Argentina',
              academicLevel: academic_level || 'Secundario',
            },
            update: {
              ...(phone !== undefined && { phone }),
              ...(extra_phone !== undefined && { extraPhone: extra_phone }),
              ...(extra_email !== undefined && { extraEmail: extra_email }),
              ...(address !== undefined && { address }),
              ...(dob !== undefined && { dob: dob ? new Date(dob) : null }),
              ...(gender !== undefined && { gender }),
              ...(nacionality !== undefined && { nacionality }),
              ...(academic_level !== undefined && { academicLevel: academic_level }),
            },
          },
        },
      },
      include: studentInclude,
    })

    const selectedCourseName = course_name || course
    if (selectedCourseName !== undefined && selectedCourseName !== null && selectedCourseName !== '') {
      const targetCourse = await resolveExistingCourse(selectedCourseName)
      if (targetCourse) {
        await prisma.userCourse.deleteMany({
          where: { userId: id },
        })
        await prisma.userCourse.create({
          data: {
            userId: id,
            courseId: targetCourse.id,
          },
        })
      }
    }

    const refreshedStudent = await findStudentById(id)

    const finalRoleName = String(updatedStudent.role?.name || '').toLowerCase()
    const isAspirante = updatedStudent.statusId === 3 || finalRoleName === 'postulante'
    let attendanceToken = null
    if (finalRoleName === 'alumno') {
      attendanceToken = await ensureAttendanceToken(updatedStudent.id)
    }

    return res.status(200).json({
      status: 'success',
      message: 'Alumno actualizado exitosamente',
      data: formatStudent(refreshedStudent || updatedStudent),
    })
  } catch (error) {
    next(error)
  }
}

export const deleteAlumno = async (req, res, next) => {
  try {
    const { id } = req.params

    const studentExists = await prisma.user.findFirst({
      where: { id, role: { name: { in: STUDENT_ROLE_NAMES } } },
    })

    if (!studentExists) {
      return res.status(404).json({
        error: 'Alumno no encontrado para eliminar',
      })
    }

    if (STAFF_ROLE_IDS.has(studentExists.roleId)) {
      return res.status(404).json({
        error: 'Alumno no encontrado para eliminar',
      })
    }

    await prisma.user.update({
      where: { id },
      data: { statusId: STATUS_INACTIVO },
    })

    return res.status(200).json({
      status: 'success',
      message: `Alumno ${id} desactivado exitosamente`,
    })
  } catch (error) {
    next(error)
  }
}
