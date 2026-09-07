import { Router } from 'express'
import {
  getCourses,
  getCourseById,
  getFamilies,
  getDays,
  createCourse,
  updateCourse,
  deleteCourse
} from '../controllers/course.controllers.js'
import { authenticateToken, requireAdmin } from '../middlewares/auth.middlewares.js'
import { validate } from '../middlewares/validate.middlewares.js'
import { createCourseSchema, updateCourseSchema } from '../validators/course.schema.js'

const CourseRouter = Router()

CourseRouter.get('/courses', getCourses)
CourseRouter.get('/courses/:id', getCourseById)
CourseRouter.get('/families', getFamilies)
CourseRouter.get('/days', getDays)

CourseRouter.post(
  '/courses',
  authenticateToken,
  requireAdmin,
  validate(createCourseSchema, 'body'),
  createCourse
)

CourseRouter.put(
  '/courses/:id',
  authenticateToken,
  requireAdmin,
  validate(updateCourseSchema, 'body'),
  updateCourse
)

CourseRouter.delete(
  '/courses/:id',
  authenticateToken,
  requireAdmin,
  deleteCourse
)

export default CourseRouter
