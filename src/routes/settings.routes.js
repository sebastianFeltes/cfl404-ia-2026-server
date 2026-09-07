import { Router } from 'express'
import { getKpis } from '../controllers/settings.controllers.js'

const SettingsRouter = Router()

// Público: solo claves kpi_* (textos institucionales). Si Setting crece a secretos, autenticar.
SettingsRouter.get('/settings/kpis', getKpis)

export default SettingsRouter
