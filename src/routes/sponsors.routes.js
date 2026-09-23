import { Router } from 'express'
import { authenticateToken, authorizeRoles } from '../middlewares/auth.middlewares.js'
import {
  getSponsors,
  createSponsor,
  updateSponsor,
  deleteSponsor,
  assignSponsorToCourse,
} from '../controllers/sponsors.controllers.js'

const SponsorsRouter = Router()

// Roles con acceso a gestión de patrocinadores y configuración
const CONFIG_ROLES = ['GOD', 'DIRECTOR', 'REGENTE', 'DIRECTIVO']

// ── Patrocinadores ─────────────────────────────────────────────────────────────
SponsorsRouter.get(
  '/api/v1/sponsors',
  authenticateToken,
  authorizeRoles(CONFIG_ROLES),
  getSponsors,
)

SponsorsRouter.post(
  '/api/v1/sponsors',
  authenticateToken,
  authorizeRoles(CONFIG_ROLES),
  createSponsor,
)

SponsorsRouter.patch(
  '/api/v1/sponsors/:id',
  authenticateToken,
  authorizeRoles(CONFIG_ROLES),
  updateSponsor,
)

SponsorsRouter.delete(
  '/api/v1/sponsors/:id',
  authenticateToken,
  authorizeRoles(CONFIG_ROLES),
  deleteSponsor,
)

// ── Asignación de sponsor a curso ─────────────────────────────────────────────
SponsorsRouter.patch(
  '/api/v1/courses/:courseId/sponsor',
  authenticateToken,
  authorizeRoles(CONFIG_ROLES),
  assignSponsorToCourse,
)

export default SponsorsRouter
