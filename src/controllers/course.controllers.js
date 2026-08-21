import { PrismaClient } from '@prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'

const adapter = new PrismaBetterSqlite3({
  url: 'file:./database.db'
})
const prisma = new PrismaClient({ adapter })

// GET /courses - Obtener lista de cursos con detalles
export const getCourses = async (req, res, next) => {
  try {
    const courses = await prisma.course.findMany({
      include: {
        courseDetail: true,
        staff: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })
    res.json(courses)
  } catch (error) {
    next(error)
  }
}

// GET /courses/:id - Obtener curso por ID
export const getCourseById = async (req, res, next) => {
  try {
    const { id } = req.params
    const course = await prisma.course.findUnique({
      where: { id },
      include: {
        courseDetail: true,
        staff: true
      }
    })
    if (!course) {
      return res.status(404).json({ message: 'Curso no encontrado' })
    }
    res.json(course)
  } catch (error) {
    next(error)
  }
}

// POST /courses - Crear nuevo curso
export const createCourse = async (req, res, next) => {
  try {
    const {
      name,
      startDate,
      endDate,
      startTime,
      endTime,
      statusId = 1,
      staffId,
      maxAbsences = 4,
      description,
      quota = 25,
      hourQuantity = 120,
      classesQuantity = 32,
      titleRequired = false,
      endorsementBy = 'CFP N°404 Berisso'
    } = req.body

    // Buscar o usar staff id default si no viene especificado
    let targetStaffId = staffId
    if (!targetStaffId) {
      const firstStaff = await prisma.staff.findFirst()
      if (firstStaff) {
        targetStaffId = firstStaff.id
      }
    }

    const courseData = {
      name,
      statusId: Number(statusId),
      maxAbsences: Number(maxAbsences),
      startTime,
      endTime,
      ...(startDate && { startDate: new Date(startDate) }),
      ...(endDate && { endDate: new Date(endDate) }),
      ...(targetStaffId && { staffId: targetStaffId }),
      courseDetail: {
        create: {
          description,
          quota: Number(quota),
          hourQuantity: Number(hourQuantity),
          classesQuantity: Number(classesQuantity),
          titleRequired: Boolean(titleRequired),
          endorsementBy
        }
      }
    }

    const newCourse = await prisma.course.create({
      data: courseData,
      include: {
        courseDetail: true,
        staff: true
      }
    })

    res.status(201).json(newCourse)
  } catch (error) {
    next(error)
  }
}

// PUT /courses/:id - Actualizar curso existente
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
      classesQuantity
    } = req.body

    const updatedCourse = await prisma.course.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(statusId !== undefined && { statusId: Number(statusId) }),
        ...(maxAbsences !== undefined && { maxAbsences: Number(maxAbsences) }),
        courseDetail: {
          update: {
            ...(description !== undefined && { description }),
            ...(quota !== undefined && { quota: Number(quota) }),
            ...(hourQuantity !== undefined && { hourQuantity: Number(hourQuantity) }),
            ...(classesQuantity !== undefined && { classesQuantity: Number(classesQuantity) })
          }
        }
      },
      include: {
        courseDetail: true,
        staff: true
      }
    })

    res.json(updatedCourse)
  } catch (error) {
    next(error)
  }
}

// DELETE /courses/:id - Eliminar un curso
export const deleteCourse = async (req, res, next) => {
  try {
    const { id } = req.params

    // Eliminar courseDetail si existe y luego el course
    await prisma.courseDetail.deleteMany({
      where: { courseId: id }
    })

    await prisma.course.delete({
      where: { id }
    })

    res.json({ message: 'Curso eliminado correctamente', id })
  } catch (error) {
    next(error)
  }
}
