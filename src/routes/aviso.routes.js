import { Router } from 'express'
import { authenticateToken, authorizeRoles } from '../middlewares/auth.middlewares.js'
import { validate } from '../middlewares/validate.middlewares.js'
import { archiveAviso, createAviso, listAvisos, updateAviso } from '../controllers/aviso.controllers.js'
import { createAvisoSchema, updateAvisoSchema } from '../schemas/aviso.schema.js'

const AvisoRouter = Router()
const AVISO_ROLES = ['god', 'director', 'regente']

AvisoRouter.get('/api/v1/avisos', authenticateToken, authorizeRoles(AVISO_ROLES), listAvisos)
AvisoRouter.post(
  '/api/v1/avisos',
  authenticateToken,
  authorizeRoles(AVISO_ROLES),
  validate(createAvisoSchema),
  createAviso,
)
AvisoRouter.patch(
  '/api/v1/avisos/:id',
  authenticateToken,
  authorizeRoles(AVISO_ROLES),
  validate(updateAvisoSchema),
  updateAviso,
)
AvisoRouter.delete('/api/v1/avisos/:id', authenticateToken, authorizeRoles(AVISO_ROLES), archiveAviso)

export default AvisoRouter
