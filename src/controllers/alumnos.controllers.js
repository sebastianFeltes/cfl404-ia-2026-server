// Archivo: src/controllers/alumnos.controllers.js
import prisma from '../lib/prisma.js'

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

const STUDENT_ROLE_NAMES = ['ALUMNO', 'POSTULANTE']

/**
 * Helper para obtener o crear un curso por nombre
 */
async function getOrCreateCourse(courseName) {
  if (!courseName) return null

  let course = await prisma.course.findFirst({
    where: { name: courseName },
  })

  if (!course) {
    let defaultInstructor = await prisma.user.findFirst({
      where: { role: { name: 'INSTRUCTOR' } },
    })
    if (!defaultInstructor) {
      let instructorRole = await prisma.role.findFirst({ where: { name: 'INSTRUCTOR' } })
      if (!instructorRole) {
        instructorRole = await prisma.role.create({ data: { name: 'INSTRUCTOR' } })
      }
      defaultInstructor = await prisma.user.create({
        data: {
          firstName: 'Docente',
          lastName: 'CFL 404',
          email: 'docente@cfl404.edu.ar',
          dni: '20000001',
          statusId: 1,
          roleId: instructorRole.id,
        },
      })
    }

    course = await prisma.course.create({
      data: {
        name: courseName,
        statusId: 1,
        instructorId: defaultInstructor.id,
        maxAbsences: 5,
      },
    })
  }

  return course
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

/**
 * Obtener listado completo de alumnos con sus cursos y detalles
 */
export const getAlumnos = async (req, res, next) => {
  try {
    const students = await prisma.user.findMany({
      where: { role: { name: { in: STUDENT_ROLE_NAMES } } },
      include: studentInclude,
      orderBy: {
        createdAt: 'desc',
      },
    })

    const formattedStudents = students.map((s) => {
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
    })

    return res.status(200).json({
      status: 'success',
      count: formattedStudents.length,
      data: formattedStudents,
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Obtener detalle de un alumno por ID
 */
export const getAlumnoById = async (req, res, next) => {
  try {
    const { id } = req.params

    const student = await prisma.user.findUnique({
      where: { id },
      include: studentInclude,
    })

    if (!student) {
      return res.status(404).json({
        error: 'Alumno no encontrado',
      })
    }

    const activeCourse = student.userCourses?.[0]?.course?.name || 'Sin curso asignado'
    const statusText = STATUS_MAP[student.statusId] || student.status?.name || 'Activo'
    const isAspirante = student.statusId === 3 || student.role?.name === 'POSTULANTE'

    const formattedStudent = {
      id: student.id,
      first_name: student.firstName,
      last_name: student.lastName,
      dni: student.dni,
      email: student.email,
      phone: student.userDetail?.phone || '',
      extra_phone: student.userDetail?.extraPhone || '',
      extra_email: student.userDetail?.extraEmail || '',
      address: student.userDetail?.address || '',
      dob: student.userDetail?.dob ? new Date(student.userDetail.dob).toLocaleDateString('es-AR') : '',
      gender: student.userDetail?.gender || '',
      nacionality: student.userDetail?.nacionality || 'Argentina',
      academic_level: student.userDetail?.academicLevel || 'Secundario',
      course_name: activeCourse,
      course: activeCourse,
      enrollment_date: new Date(student.createdAt).toLocaleDateString('es-AR'),
      status_id: student.statusId,
      status: statusText,
      is_present: student.statusId === 1,
      is_aspirante: isAspirante,
      role_name: student.role?.name || 'ALUMNO',
      profile_photo_url: student.profilePhotoUrl,
      accepted_terms: Boolean(student.acceptedTerms),
      acceptedTerms: Boolean(student.acceptedTerms),
      dni_copy: true,
      form_copy: true,
      title_copy: true,
      studentDetail: student.userDetail,
      studentCourses: student.userCourses,
      createdAt: student.createdAt,
    }

    return res.status(200).json({
      status: 'success',
      data: formattedStudent,
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Crear un nuevo alumno en la base de datos
 */
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

    const rawAcceptedTerms = accepted_terms ?? acceptedTerms

    // 1. Verificar unicidad de DNI y Email
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

    // 2. Obtener o crear rol
    const isPostulant = role_name === 'Aspirante' || role_name === 'POSTULANTE'
    const targetRoleName = isPostulant ? 'POSTULANTE' : 'ALUMNO'
    let alumnoRole = await prisma.role.findFirst({
      where: { name: targetRoleName },
    })

    if (!alumnoRole) {
      alumnoRole = await prisma.role.create({
        data: { name: targetRoleName },
      })
    }

    let finalStatusId = 1
    if (status_id) {
      finalStatusId = status_id
    } else if (status) {
      finalStatusId = STATUS_TO_ID[status] || 1
    } else if (role_name === 'Aspirante' || role_name === 'POSTULANTE') {
      finalStatusId = 3
    }

    // 3. Crear estudiante y su detalle
    const newStudent = await prisma.user.create({
      data: {
        firstName: first_name,
        lastName: last_name,
        dni,
        email,
        statusId: finalStatusId,
        roleId: alumnoRole.id,
        profilePhotoUrl: profile_photo_url || null,
        acceptedTerms: Boolean(rawAcceptedTerms ?? false),
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

    // 4. Vincular con el curso
    const selectedCourseName = course_name || course
    if (selectedCourseName) {
      const targetCourse = await getOrCreateCourse(selectedCourseName)
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

/**
 * Actualizar datos de un alumno (incluyendo curso)
 */
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

    const studentExists = await prisma.user.findUnique({
      where: { id },
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

    const rawAcceptedTerms = accepted_terms ?? acceptedTerms

    // 1. Actualizar datos base del alumno
    const updatedStudent = await prisma.user.update({
      where: { id },
      data: {
        ...(first_name && { firstName: first_name }),
        ...(last_name && { lastName: last_name }),
        ...(dni && { dni }),
        ...(email && { email }),
        ...(finalStatusId !== undefined && { statusId: finalStatusId }),
        ...(profile_photo_url !== undefined && { profilePhotoUrl: profile_photo_url }),
        ...(rawAcceptedTerms !== undefined && { acceptedTerms: Boolean(rawAcceptedTerms) }),
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
        userDetail: true,
        userCourses: { include: { course: true } },
      },
    })

    // 2. Actualizar vínculo de Curso
    const selectedCourseName = course_name || course
    if (selectedCourseName !== undefined) {
      const targetCourse = await getOrCreateCourse(selectedCourseName)
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

/**
 * Eliminar un alumno
 */
export const deleteAlumno = async (req, res, next) => {
  try {
    const { id } = req.params

    const studentExists = await prisma.user.findUnique({
      where: { id },
    })

    if (!studentExists) {
      return res.status(404).json({
        error: 'Alumno no encontrado para eliminar',
      })
    }

    await prisma.userCourse.deleteMany({
      where: { userId: id },
    })

    await prisma.userDetail.deleteMany({
      where: { userId: id },
    })

    await prisma.user.delete({
      where: { id },
    })

    return res.status(200).json({
      status: 'success',
      message: `Alumno ${id} eliminado exitosamente de la base de datos`,
    })
  } catch (error) {
    next(error)
  }
}
