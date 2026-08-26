import { Router } from 'express'
import {
    loginWithGoogle,
    devLoginFallback,
    getMyProfile,
    updateMyProfile,
} from '../controllers/auth.controllers.js'
import { authenticateToken } from '../middlewares/auth.middlewares.js'

const authRouter = Router()

// Rutas públicas de autenticación
authRouter.post('/api/auth/google', loginWithGoogle)
authRouter.post('/api/auth/dev-login', devLoginFallback)

// Rutas protegidas
authRouter.get('/api/auth/me', authenticateToken, getMyProfile)
authRouter.patch('/api/auth/me', authenticateToken, updateMyProfile)

export default authRouter
