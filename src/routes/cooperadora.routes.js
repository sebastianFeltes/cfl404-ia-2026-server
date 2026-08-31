import { Router } from 'express'
import { authenticateToken, authorizeRoles } from '../middlewares/auth.middlewares.js'
import { validateSchema } from '../middlewares/validateSchema.js'
import { savePaymentSchema, createBuffetSchema } from '../schemas/cooperadora.schema.js'
import {
  getPayments,
  savePayment,
  deletePayment,
  getBuffetMovements,
  createBuffetMovement,
  deleteBuffetMovement,
} from '../controllers/cooperadora.controllers.js'

const CooperadoraRouter = Router()

// Roles con permisos para operar en el módulo de Cooperadora y Buffet
const COOPERADORA_ROLES = ['ADMIN', 'DIRECTIVO', 'SECRETARIA', 'PRECEPTORIA', 'GOD']

// ── Rutas de Pagos de Cooperadora (Cuotas de Alumnos) ──────────────────────────
CooperadoraRouter.get(
  '/api/v1/cooperadora/pagos',
  authenticateToken,
  authorizeRoles(COOPERADORA_ROLES),
  getPayments
)

CooperadoraRouter.post(
  '/api/v1/cooperadora/pagos',
  authenticateToken,
  authorizeRoles(COOPERADORA_ROLES),
  validateSchema(savePaymentSchema),
  savePayment
)

CooperadoraRouter.delete(
  '/api/v1/cooperadora/pagos/:id',
  authenticateToken,
  authorizeRoles(COOPERADORA_ROLES),
  deletePayment
)

// ── Rutas de Movimientos de Buffet (Cantina) ──────────────────────────────────
CooperadoraRouter.get(
  '/api/v1/cooperadora/buffet',
  authenticateToken,
  authorizeRoles(COOPERADORA_ROLES),
  getBuffetMovements
)

CooperadoraRouter.post(
  '/api/v1/cooperadora/buffet',
  authenticateToken,
  authorizeRoles(COOPERADORA_ROLES),
  validateSchema(createBuffetSchema),
  createBuffetMovement
)

CooperadoraRouter.delete(
  '/api/v1/cooperadora/buffet/:id',
  authenticateToken,
  authorizeRoles(COOPERADORA_ROLES),
  deleteBuffetMovement
)

export default CooperadoraRouter
