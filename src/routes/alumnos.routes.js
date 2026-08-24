// Archivo: src/routes/alumnos.routes.js
import { Router } from 'express'
import { validateSchema } from '../middlewares/validateSchema.js'
import { createAlumnoSchema, updateAlumnoSchema } from '../schemas/alumnos.schema.js'
import {
  getAlumnos,
  getAlumnoById,
  createAlumno,
  updateAlumno,
  deleteAlumno,
} from '../controllers/alumnos.controllers.js'

const router = Router()

/**
 * Rutas de Gestión de Alumnos
 * Flujo: Endpoint -> Middleware Zod (en POST/PUT) -> Controlador
 */

// GET /api/alumnos - Listado de alumnos
router.get('/alumnos', getAlumnos)

// GET /api/alumnos/:id - Detalle de un alumno
router.get('/alumnos/:id', getAlumnoById)

// POST /api/alumnos - Crear nuevo alumno (Valida cuerpo con Zod)
router.post('/alumnos', validateSchema(createAlumnoSchema), createAlumno)

// PUT /api/alumnos/:id - Actualizar datos de un alumno (Valida cuerpo con Zod)
router.put('/alumnos/:id', validateSchema(updateAlumnoSchema), updateAlumno)

// DELETE /api/alumnos/:id - Eliminar alumno
router.delete('/alumnos/:id', deleteAlumno)

export default router
