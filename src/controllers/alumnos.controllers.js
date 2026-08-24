// Archivo: src/controllers/alumnos.controllers.js
import prisma from '../db.js'

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

/**
 * Helper para obtener o crear un curso por nombre
 */
async function getOrCreateCourse(courseName) {
  if (!courseName) return null

  let course = await prisma.course.findFirst({
    where: { name: courseName },
  })

  if (!course) {
    let defaultStaff = await prisma.staff.findFirst()
    if (!defaultStaff) {
      let instructorRole = await prisma.role.findFirst({ where: { name: 'Instructor' } })
      if (!instructorRole) {
        instructorRole = await prisma.role.create({ data: { name: 'Instructor' } })
      }
      defaultStaff = await prisma.staff.create({
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
        staffId: defaultStaff.id,
        maxAbsences: 5,
      },
    })
  }

  return course
}

/**
 * Obtener listado completo de alumnos con sus cursos y detalles
 */
export const getAlumnos = async (req, res, next) => {
  try {
    const students = await prisma.student.findMany({
      include: {
        studentDetail: true,
        studentCourses: {
          include: {
            course: true,
          },
        },
        role: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    const formattedStudents = students.map((s) => {
      const activeCourse = s.studentCourses?.[0]?.course?.name || 'Sin curso asignado'
      const statusText = STATUS_MAP[s.statusId] || 'Activo'
      const isAspirante = s.statusId === 3 || s.role?.name === 'Aspirante'

      return {
        id: s.id,
        first_name: s.firstName,
        last_name: s.lastName,
        dni: s.dni,
        email: s.email,
        phone: s.studentDetail?.phone || '',
        extra_phone: s.studentDetail?.extraPhone || '',
        extra_email: s.studentDetail?.extraEmail || '',
        address: s.studentDetail?.address || '',
        dob: s.studentDetail?.dob ? new Date(s.studentDetail.dob).toLocaleDateString('es-AR') : '',
        gender: s.studentDetail?.gender || '',
        nacionality: s.studentDetail?.nacionality || 'Argentina',
        academic_level: s.studentDetail?.academicLevel || 'Secundario',
        course_name: activeCourse,
        course: activeCourse,
        enrollment_date: new Date(s.createdAt).toLocaleDateString('es-AR'),
        status_id: s.statusId,
        status: statusText,
        is_present: s.statusId === 1,
        is_aspirante: isAspirante,
        role_name: s.role?.name || (isAspirante ? 'Aspirante' : 'Alumno'),
        profile_photo_url: s.profilePhotoUrl,
        dni_copy: true,
        form_copy: true,
        title_copy: true,
        studentDetail: s.studentDetail,
        studentCourses: s.studentCourses,
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

    const student = await prisma.student.findUnique({
      where: { id },
      include: {
        studentDetail: true,
        studentCourses: {
          include: {
            course: true,
          },
        },
        role: true,
      },
    })

    if (!student) {
      return res.status(404).json({
        error: 'Alumno no encontrado',
      })
    }

    const activeCourse = student.studentCourses?.[0]?.course?.name || 'Sin curso asignado'
    const statusText = STATUS_MAP[student.statusId] || 'Activo'
    const isAspirante = student.statusId === 3 || student.role?.name === 'Aspirante'

    const formattedStudent = {
      id: student.id,
      first_name: student.firstName,
      last_name: student.lastName,
      dni: student.dni,
      email: student.email,
      phone: student.studentDetail?.phone || '',
      extra_phone: student.studentDetail?.extraPhone || '',
      extra_email: student.studentDetail?.extraEmail || '',
      address: student.studentDetail?.address || '',
      dob: student.studentDetail?.dob ? new Date(student.studentDetail.dob).toLocaleDateString('es-AR') : '',
      gender: student.studentDetail?.gender || '',
      nacionality: student.studentDetail?.nacionality || 'Argentina',
      academic_level: student.studentDetail?.academicLevel || 'Secundario',
      course_name: activeCourse,
      course: activeCourse,
      enrollment_date: new Date(student.createdAt).toLocaleDateString('es-AR'),
      status_id: student.statusId,
      status: statusText,
      is_present: student.statusId === 1,
      is_aspirante: isAspirante,
      role_name: student.role?.name || 'Alumno',
      profile_photo_url: student.profilePhotoUrl,
      dni_copy: true,
      form_copy: true,
      title_copy: true,
      studentDetail: student.studentDetail,
      studentCourses: student.studentCourses,
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
    } = req.body

    // 1. Verificar unicidad de DNI y Email
    const existingStudent = await prisma.student.findFirst({
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
    const targetRoleName = role_name === 'Aspirante' ? 'Aspirante' : 'Alumno'
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
    } else if (role_name === 'Aspirante') {
      finalStatusId = 3
    }

    // 3. Crear estudiante y su detalle
    const newStudent = await prisma.student.create({
      data: {
        firstName: first_name,
        lastName: last_name,
        dni,
        email,
        statusId: finalStatusId,
        roleId: alumnoRole.id,
        profilePhotoUrl: profile_photo_url || null,
        studentDetail: {
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
        studentDetail: true,
        role: true,
      },
    })

    // 4. Vincular con el curso
    const selectedCourseName = course_name || course
    if (selectedCourseName) {
      const targetCourse = await getOrCreateCourse(selectedCourseName)
      if (targetCourse) {
        await prisma.studentCourse.create({
          data: {
            studentId: newStudent.id,
            courseId: targetCourse.id,
          },
        })
      }
    }

    const isAspirante = newStudent.statusId === 3 || targetRoleName === 'Aspirante'

    return res.status(201).json({
      status: 'success',
      message: 'Alumno registrado exitosamente en la base de datos',
      data: {
        id: newStudent.id,
        first_name: newStudent.firstName,
        last_name: newStudent.lastName,
        dni: newStudent.dni,
        email: newStudent.email,
        phone: newStudent.studentDetail?.phone || '',
        address: newStudent.studentDetail?.address || '',
        academic_level: newStudent.studentDetail?.academicLevel || 'Secundario',
        course_name: selectedCourseName || 'Sin curso asignado',
        course: selectedCourseName || 'Sin curso asignado',
        enrollment_date: new Date(newStudent.createdAt).toLocaleDateString('es-AR'),
        status_id: newStudent.statusId,
        status: STATUS_MAP[newStudent.statusId] || 'Activo',
        is_present: newStudent.statusId === 1,
        is_aspirante: isAspirante,
        role_name: targetRoleName,
        profile_photo_url: newStudent.profilePhotoUrl,
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
    } = req.body

    const studentExists = await prisma.student.findUnique({
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

    // 1. Actualizar datos base del alumno
    const updatedStudent = await prisma.student.update({
      where: { id },
      data: {
        ...(first_name && { firstName: first_name }),
        ...(last_name && { lastName: last_name }),
        ...(dni && { dni }),
        ...(email && { email }),
        ...(finalStatusId !== undefined && { statusId: finalStatusId }),
        ...(profile_photo_url !== undefined && { profilePhotoUrl: profile_photo_url }),
        studentDetail: {
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
        studentDetail: true,
        studentCourses: { include: { course: true } },
      },
    })

    // 2. Actualizar vínculo de Curso
    const selectedCourseName = course_name || course
    if (selectedCourseName !== undefined) {
      const targetCourse = await getOrCreateCourse(selectedCourseName)
      if (targetCourse) {
        await prisma.studentCourse.deleteMany({
          where: { studentId: id },
        })
        await prisma.studentCourse.create({
          data: {
            studentId: id,
            courseId: targetCourse.id,
          },
        })
      }
    }

    const currentCourseName = selectedCourseName || updatedStudent.studentCourses?.[0]?.course?.name || 'Sin curso asignado'

    return res.status(200).json({
      status: 'success',
      message: 'Alumno actualizado exitosamente',
      data: {
        id: updatedStudent.id,
        first_name: updatedStudent.firstName,
        last_name: updatedStudent.lastName,
        dni: updatedStudent.dni,
        email: updatedStudent.email,
        phone: updatedStudent.studentDetail?.phone,
        course_name: currentCourseName,
        course: currentCourseName,
        status_id: updatedStudent.statusId,
        status: STATUS_MAP[updatedStudent.statusId] || 'Activo',
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

    const studentExists = await prisma.student.findUnique({
      where: { id },
    })

    if (!studentExists) {
      return res.status(404).json({
        error: 'Alumno no encontrado para eliminar',
      })
    }

    await prisma.studentCourse.deleteMany({
      where: { studentId: id },
    })

    await prisma.studentDetail.deleteMany({
      where: { studentId: id },
    })

    await prisma.student.delete({
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
