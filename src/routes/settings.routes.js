import { Router } from 'express'
import { getKpis } from '../controllers/settings.controllers.js'

const SettingsRouter = Router()

// Público — sin autenticación
SettingsRouter.get('/settings/kpis', getKpis)

export default SettingsRouter
