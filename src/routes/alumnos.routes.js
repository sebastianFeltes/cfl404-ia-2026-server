import { Router } from 'express'
import { validateSchema } from '../middlewares/validateSchema.js'
import { createAlumnoSchema, updateAlumnoSchema } from '../schemas/alumnos.schema.js'
import { authenticateToken, requireAdmin, requireStaff, requireSelfOrStaff } from '../middlewares/auth.middlewares.js'
import {
  getAlumnos,
  getAlumnoById,
  createAlumno,
  updateAlumno,
  deleteAlumno,
} from '../controllers/alumnos.controllers.js'

const router = Router()

const ALUMNOS_READ = [authenticateToken, requireStaff]
const ALUMNOS_WRITE = [authenticateToken, requireAdmin]

router.get('/alumnos', ...ALUMNOS_READ, getAlumnos)
router.get('/alumnos/:id', ...ALUMNOS_READ, requireSelfOrStaff('id'), getAlumnoById)
router.post('/alumnos', ...ALUMNOS_WRITE, validateSchema(createAlumnoSchema), createAlumno)
router.put('/alumnos/:id', ...ALUMNOS_WRITE, validateSchema(updateAlumnoSchema), updateAlumno)
router.delete('/alumnos/:id', ...ALUMNOS_WRITE, deleteAlumno)

export default router
