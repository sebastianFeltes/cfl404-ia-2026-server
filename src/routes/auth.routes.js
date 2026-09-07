import { Router } from 'express'
import {
    loginWithGoogle,
    devLoginFallback,
    getMyProfile,
    updateMyProfile,
    logout,
    refreshSession,
} from '../controllers/auth.controllers.js'
import { authenticateToken } from '../middlewares/auth.middlewares.js'
import { isDevLoginEnabled } from '../lib/dev-login.js'

const authRouter = Router()

authRouter.post('/api/auth/google', loginWithGoogle)

if (isDevLoginEnabled()) {
    authRouter.post('/api/auth/dev-login', devLoginFallback)
}

authRouter.post('/api/auth/logout', logout)
authRouter.post('/api/auth/refresh', refreshSession)

authRouter.get('/api/auth/me', authenticateToken, getMyProfile)
authRouter.patch('/api/auth/me', authenticateToken, updateMyProfile)

export default authRouter
