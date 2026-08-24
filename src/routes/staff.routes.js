import { Router } from 'express'
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

// ── Roles (para el select del formulario) ──────────────────
StaffRouter.get('/api/v1/roles', getAllRoles)

// ── Instructores CRUD ──────────────────────────────────────
StaffRouter.get('/api/v1/instructores', getAllStaff)

StaffRouter.get(
    '/api/v1/instructores/:id',
    validate(idParamSchema, 'params'),
    getStaffById
)

StaffRouter.post(
    '/api/v1/instructores',
    validate(createStaffSchema, 'body'),
    createStaff
)

StaffRouter.put(
    '/api/v1/instructores/:id',
    validate(idParamSchema, 'params'),
    validate(updateStaffSchema, 'body'),
    updateStaff
)

export default StaffRouter
