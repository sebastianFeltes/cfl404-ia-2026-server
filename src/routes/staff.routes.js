import { Router } from 'express'
import { authenticateToken, authorizeRoles } from '../middlewares/auth.middlewares.js'
import { validate } from '../middlewares/validate.middlewares.js'
import { createStaffSchema, updateStaffSchema, idParamSchema } from '../schemas/staff.schemas.js'
import {
    getAllStaff,
    getStaffById,
    createStaff,
    updateStaff,
    getAllRoles,
} from '../controllers/staff.controllers.js'

const StaffRouter = Router()

/**
 * Roles permitidos en la sección Instructores
 *
 * CRUD completo : GOD · ADMIN · DIRECTOR · REGENTE · DIRECTIVO (backward compat)
 * Solo lectura  : SECRETARIA · PRECEPTORIA
 * Sin acceso    : INSTRUCTOR · ALUMNO · POSTULANTE
 */
const INSTRUCTORES_CRUD = ['GOD', 'ADMIN', 'DIRECTOR', 'REGENTE', 'DIRECTIVO']
const INSTRUCTORES_READ = [...INSTRUCTORES_CRUD, 'SECRETARIA', 'PRECEPTORIA']

// ── Roles (para el select del formulario) ───────────────────
// Solo los roles con acceso CRUD pueden cargar el formulario
StaffRouter.get(
    '/api/v1/roles',
    authenticateToken,
    authorizeRoles(...INSTRUCTORES_CRUD),
    getAllRoles
)

// ── Instructores — Lectura ───────────────────────────────────
StaffRouter.get(
    '/api/v1/instructores',
    authenticateToken,
    authorizeRoles(...INSTRUCTORES_READ),
    getAllStaff
)

StaffRouter.get(
    '/api/v1/instructores/:id',
    authenticateToken,
    authorizeRoles(...INSTRUCTORES_READ),
    validate(idParamSchema, 'params'),
    getStaffById
)

// ── Instructores — Creación (solo CRUD) ──────────────────────
StaffRouter.post(
    '/api/v1/instructores',
    authenticateToken,
    authorizeRoles(...INSTRUCTORES_CRUD),
    validate(createStaffSchema, 'body'),
    createStaff
)

// ── Instructores — Actualización / Baja (solo CRUD) ──────────
StaffRouter.put(
    '/api/v1/instructores/:id',
    authenticateToken,
    authorizeRoles(...INSTRUCTORES_CRUD),
    validate(idParamSchema, 'params'),
    validate(updateStaffSchema, 'body'),
    updateStaff
)

export default StaffRouter
