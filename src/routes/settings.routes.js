import { Router } from 'express'
import { authenticateToken, authorizeRoles } from '../middlewares/auth.middlewares.js'
import { getKpis, getAllSettings, updateSetting, deleteSetting } from '../controllers/settings.controllers.js'

const SettingsRouter = Router()

// Roles con acceso a la configuración del sistema
const CONFIG_ROLES = ['GOD', 'DIRECTOR', 'REGENTE', 'DIRECTIVO']

// Público: solo claves kpi_* (textos institucionales).
SettingsRouter.get('/api/settings/kpis', getKpis)

// Protegido: todos los settings (para el módulo Configuración)
SettingsRouter.get(
  '/api/v1/settings',
  authenticateToken,
  authorizeRoles(CONFIG_ROLES),
  getAllSettings,
)

// Protegido: crear un nuevo setting
SettingsRouter.post(
  '/api/v1/settings',
  authenticateToken,
  authorizeRoles(CONFIG_ROLES),
  updateSetting,
)

// Protegido: actualizar un setting por clave
SettingsRouter.patch(
  '/api/v1/settings/:key',
  authenticateToken,
  authorizeRoles(CONFIG_ROLES),
  updateSetting,
)

// Protegido: eliminar un setting por clave
SettingsRouter.delete(
  '/api/v1/settings/:key',
  authenticateToken,
  authorizeRoles(CONFIG_ROLES),
  deleteSetting,
)

export default SettingsRouter
