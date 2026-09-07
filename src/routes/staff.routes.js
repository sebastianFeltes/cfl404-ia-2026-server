import { Router } from 'express'
import { authenticateToken, requireAdmin, requireStaff } from '../middlewares/auth.middlewares.js'
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

StaffRouter.get(
    '/api/v1/roles',
    authenticateToken,
    requireAdmin,
    getAllRoles
)

StaffRouter.get(
    '/api/v1/instructores',
    authenticateToken,
    requireStaff,
    getAllStaff
)

StaffRouter.get(
    '/api/v1/instructores/:id',
    authenticateToken,
    requireStaff,
    validate(idParamSchema, 'params'),
    getStaffById
)

StaffRouter.post(
    '/api/v1/instructores',
    authenticateToken,
    requireAdmin,
    validate(createStaffSchema, 'body'),
    createStaff
)

StaffRouter.put(
    '/api/v1/instructores/:id',
    authenticateToken,
    requireAdmin,
    validate(idParamSchema, 'params'),
    validate(updateStaffSchema, 'body'),
    updateStaff
)

export default StaffRouter
