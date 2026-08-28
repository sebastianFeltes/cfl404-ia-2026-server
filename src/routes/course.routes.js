import { Router } from 'express'
import {
  getCourses,
  getCourseById,
  createCourse,
  updateCourse,
  deleteCourse
} from '../controllers/course.controllers.js'
import { authenticateToken, authorizeRoles } from '../middlewares/auth.middlewares.js'
import { validateSchema } from '../middlewares/validate.middlewares.js'
import { createCourseSchema, updateCourseSchema } from '../validators/course.schema.js'

const CourseRouter = Router()

// Endpoints de Cursos para la plataforma (Pública y Administrativa)
CourseRouter.get('/courses', getCourses)
CourseRouter.get('/courses/:id', getCourseById)

// Operaciones de escritura protegidas por rol administrativo y validadas con esquemas Zod
CourseRouter.post(
  '/courses', 
  authenticateToken,
  authorizeRoles('ADMIN', 'DIRECTIVO'), 
  validateSchema(createCourseSchema), 
  createCourse
)

CourseRouter.put(
  '/courses/:id', 
  authenticateToken,
  authorizeRoles('ADMIN', 'DIRECTIVO'), 
  validateSchema(updateCourseSchema), 
  updateCourse
)

CourseRouter.delete(
  '/courses/:id', 
  authenticateToken,
  authorizeRoles('ADMIN', 'DIRECTIVO'), 
  deleteCourse
)

export default CourseRouter
