import { Router } from 'express'
import { authenticateToken } from '../middlewares/auth.middlewares.js'
import { preinscripcionUserLimiter } from '../lib/preinscripcion-limit.js'
import {
  createPreinscripcion,
  getPreinscripcionTurno,
  handlePreinscripcionWebhook,
} from '../controllers/preinscripcion.controllers.js'

const PreinscripcionRouter = Router()

PreinscripcionRouter.get(
  '/api/v1/preinscripciones/turno',
  authenticateToken,
  getPreinscripcionTurno,
)
PreinscripcionRouter.post(
  '/api/v1/preinscripciones',
  authenticateToken,
  preinscripcionUserLimiter,
  createPreinscripcion,
)
PreinscripcionRouter.post('/api/webhooks/preinscripcion', handlePreinscripcionWebhook)

export default PreinscripcionRouter
