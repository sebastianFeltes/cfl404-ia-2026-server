import { Router } from 'express'
import { authenticateToken, authorizeRoles, requireAdmin } from '../middlewares/auth.middlewares.js'
import { validateSchema } from '../middlewares/validateSchema.js'
import { savePaymentSchema, createBuffetSchema, createCooperadoraMovementSchema } from '../schemas/cooperadora.schema.js'
import {
  getPayments,
  savePayment,
  deletePayment,
  getBuffetMovements,
  createBuffetMovement,
  deleteBuffetMovement,
  getCooperadoraMovements,
  createCooperadoraMovement,
  deleteCooperadoraMovement,
  getBalanceReport,
} from '../controllers/cooperadora.controllers.js'

const CooperadoraRouter = Router()

// Roles con permisos para operar en el módulo de Cooperadora y Buffet
const COOPERADORA_ROLES = ['GOD', 'ADMIN', 'DIRECTOR', 'REGENTE', 'DIRECTIVO', 'SECRETARIA', 'PRECEPTORIA']

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
  requireAdmin,
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
  requireAdmin,
  deleteBuffetMovement
)

// ── Rutas de Movimientos Generales de Cooperadora (Gastos, Donaciones, etc.) ──
CooperadoraRouter.get(
  '/api/v1/cooperadora/movimientos',
  authenticateToken,
  authorizeRoles(COOPERADORA_ROLES),
  getCooperadoraMovements
)

CooperadoraRouter.post(
  '/api/v1/cooperadora/movimientos',
  authenticateToken,
  authorizeRoles(COOPERADORA_ROLES),
  validateSchema(createCooperadoraMovementSchema),
  createCooperadoraMovement
)

CooperadoraRouter.delete(
  '/api/v1/cooperadora/movimientos/:id',
  authenticateToken,
  requireAdmin,
  deleteCooperadoraMovement
)

// ── Ruta de Balance Contable Consolidado y Dinámico ───────────────────────────
CooperadoraRouter.get(
  '/api/v1/cooperadora/balance',
  authenticateToken,
  authorizeRoles(COOPERADORA_ROLES),
  getBalanceReport
)

export default CooperadoraRouter
