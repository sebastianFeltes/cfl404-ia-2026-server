import prisma from '../lib/prisma.js'
import { parsePagination } from '../lib/pagination.js'
import { assertAllowedPhotoUrl } from '../lib/photo-url.js'
import { parseAcceptedTerms } from '../lib/accepted-terms.js'

const STATUS_MAP = {
  1: 'Activo',
  2: 'Inactivo',
  3: 'Pendiente',
  4: 'Egresado',
}

const STATUS_TO_ID = {
  Activo: 1,
  Inactivo: 2,
  Pendiente: 3,
  Egresado: 4,
}

const VALID_STATUS_IDS = new Set([1, 2, 3, 4])
const STUDENT_ROLE_NAMES = ['ALUMNO', 'POSTULANTE']
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
  if (!roleName) return 'ALUMNO'
  const normalized = String(roleName).trim().toUpperCase()
  if (['POSTULANTE', 'ASPIRANTE', 'POSTULANTE'].includes(normalized) || normalized === 'POSTULANTE') {
    return 'POSTULANTE'
  }
  if (normalized === 'ALUMNO' || normalized === 'ESTUDIANTE' || normalized === 'ALUMNO') {
    return 'ALUMNO'
  }
  if (roleName === 'Aspirante' || roleName === 'Postulante') return 'POSTULANTE'
  if (roleName === 'Alumno') return 'ALUMNO'
  const error = new Error('El rol del alumno solo puede ser ALUMNO o POSTULANTE')
  error.statusCode = 400
  throw error
}

const studentInclude = {
  userDetail: true,
  userCourses: {
    include: {
      course: true,
    },
  },
  role: true,
  status: true,
}

function formatStudent(s) {
  const activeCourse = s.userCourses?.[0]?.course?.name || 'Sin curso asignado'
  const statusText = STATUS_MAP[s.statusId] || s.status?.name || 'Activo'
  const isAspirante = s.statusId === 3 || s.role?.name === 'POSTULANTE'

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
    enrollment_date: new Date(s.createdAt).toLocaleDateString('es-AR'),
    status_id: s.statusId,
    status: statusText,
    is_present: s.statusId === 1,
    is_aspirante: isAspirante,
    role_name: s.role?.name || (isAspirante ? 'POSTULANTE' : 'ALUMNO'),
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
      address,
      course_name,
      course,
      academic_level,
      status,
      status_id,
      role_name,
      profile_photo_url,
      accepted_terms,
      acceptedTerms,
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
      finalStatusId = STATUS_TO_ID[status] || 1
    } else if (targetRoleName === 'POSTULANTE') {
      finalStatusId = 3
    }

    const newStudent = await prisma.user.create({
      data: {
        firstName: first_name,
        lastName: last_name,
        dni,
        email,
        statusId: finalStatusId,
        roleId: alumnoRole.id,
        profilePhotoUrl: profile_photo_url || null,
        acceptedTerms: parsedTerms === true,
        userDetail: {
          create: {
            phone: phone || null,
            address: address || null,
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

    const isAspirante = newStudent.statusId === 3 || targetRoleName === 'POSTULANTE'

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
        status: STATUS_MAP[newStudent.statusId] || 'Activo',
        is_present: newStudent.statusId === 1,
        is_aspirante: isAspirante,
        role_name: targetRoleName,
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
      address,
      course_name,
      course,
      academic_level,
      status,
      status_id,
      role_name,
      profile_photo_url,
      accepted_terms,
      acceptedTerms,
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
      finalStatusId = STATUS_TO_ID[status]
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
        ...(parsedTerms !== undefined && { acceptedTerms: parsedTerms }),
        userDetail: {
          upsert: {
            create: {
              phone: phone || null,
              address: address || null,
              academicLevel: academic_level || 'Secundario',
            },
            update: {
              ...(phone !== undefined && { phone }),
              ...(address !== undefined && { address }),
              ...(academic_level !== undefined && { academicLevel: academic_level }),
            },
          },
        },
      },
      include: {
        role: true,
        status: true,
        userDetail: true,
        userCourses: { include: { course: true } },
      },
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

    const currentCourseName = selectedCourseName || updatedStudent.userCourses?.[0]?.course?.name || 'Sin curso asignado'

    return res.status(200).json({
      status: 'success',
      message: 'Alumno actualizado exitosamente',
      data: {
        id: updatedStudent.id,
        first_name: updatedStudent.firstName,
        last_name: updatedStudent.lastName,
        dni: updatedStudent.dni,
        email: updatedStudent.email,
        phone: updatedStudent.userDetail?.phone,
        course_name: currentCourseName,
        course: currentCourseName,
        status_id: updatedStudent.statusId,
        status: STATUS_MAP[updatedStudent.statusId] || 'Activo',
        accepted_terms: Boolean(updatedStudent.acceptedTerms),
        acceptedTerms: Boolean(updatedStudent.acceptedTerms),
        updatedAt: updatedStudent.updatedAt,
      },
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
