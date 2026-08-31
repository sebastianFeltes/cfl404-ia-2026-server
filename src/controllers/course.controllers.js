import prisma from '../lib/prisma.js'

const COURSE_INCLUDE = {
  courseDetail: true,
  instructor: true,
  status: true,
}

function toClientCourse(course) {
  if (!course) return course
  return {
    ...course,
    staff: course.instructor,
    staffId: course.instructorId,
    sponsor: course.courseDetail?.sponsorName ? {
      name: course.courseDetail.sponsorName,
      logo: course.courseDetail.sponsorLogo,
      mention: `Patrocinado por ${course.courseDetail.sponsorName}`,
      badge: course.courseDetail.sponsorName
    } : null
  }
}

export const getCourses = async (req, res, next) => {
  try {
    const courses = await prisma.course.findMany({
      include: COURSE_INCLUDE,
      orderBy: {
        createdAt: 'desc',
      },
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
      staffId,
      instructorId,
      maxAbsences = 4,
      description,
      quota = 25,
      hourQuantity = 120,
      classesQuantity = 32,
      titleRequired = false,
      endorsementBy = 'Ministerio de Educación y Trabajo de la Provincia de Buenos Aires',
      sponsorName,
      sponsorLogo,
    } = req.body

    let targetInstructorId = instructorId || staffId
    if (!targetInstructorId) {
      const firstInstructor = await prisma.user.findFirst({
        where: { role: { name: 'INSTRUCTOR' } },
      })
      if (firstInstructor) {
        targetInstructorId = firstInstructor.id
      }
    }

    const courseData = {
      name,
      statusId: Number(statusId),
      maxAbsences: Number(maxAbsences),
      startTime,
      endTime,
      isAnnual: Boolean(isAnnual),
      ...(preEnrollmentDate && { preEnrollmentDate: new Date(preEnrollmentDate) }),
      ...(startDate && { startDate: new Date(startDate) }),
      ...(endDate && { endDate: new Date(endDate) }),
      ...(targetInstructorId && { instructorId: targetInstructorId }),
      courseDetail: {
        create: {
          description,
          quota: Number(quota),
          hourQuantity: Number(hourQuantity),
          classesQuantity: Number(classesQuantity),
          titleRequired: Boolean(titleRequired),
          endorsementBy,
          sponsorName,
          sponsorLogo,
        },
      },
    }

    const newCourse = await prisma.course.create({
      data: courseData,
      include: COURSE_INCLUDE,
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
      statusId,
      maxAbsences,
      description,
      quota,
      hourQuantity,
      classesQuantity,
      staffId,
      instructorId,
      preEnrollmentDate,
      isAnnual,
      sponsorName,
      sponsorLogo,
    } = req.body

    const updatedCourse = await prisma.course.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(statusId !== undefined && { statusId: Number(statusId) }),
        ...(maxAbsences !== undefined && { maxAbsences: Number(maxAbsences) }),
        ...(isAnnual !== undefined && { isAnnual: Boolean(isAnnual) }),
        ...(preEnrollmentDate !== undefined && { preEnrollmentDate: preEnrollmentDate ? new Date(preEnrollmentDate) : null }),
        ...((instructorId || staffId) && { instructorId: instructorId || staffId }),
        courseDetail: {
          update: {
            ...(description !== undefined && { description }),
            ...(quota !== undefined && { quota: Number(quota) }),
            ...(hourQuantity !== undefined && { hourQuantity: Number(hourQuantity) }),
            ...(classesQuantity !== undefined && { classesQuantity: Number(classesQuantity) }),
            ...(sponsorName !== undefined && { sponsorName }),
            ...(sponsorLogo !== undefined && { sponsorLogo }),
          },
        },
      },
      include: COURSE_INCLUDE,
    })

    res.json(toClientCourse(updatedCourse))
  } catch (error) {
    next(error)
  }
}

export const deleteCourse = async (req, res, next) => {
  try {
    const { id } = req.params

    await prisma.courseDetail.deleteMany({
      where: { courseId: id },
    })

    await prisma.course.delete({
      where: { id },
    })

    res.json({ message: 'Curso eliminado correctamente', id })
  } catch (error) {
    next(error)
  }
}
