import { Router } from 'express'
import { devLoginFallback, getMyProfile, loginWithGoogle, loginWithPassword, logout } from '../controllers/auth.controllers.js'
import {
    getMobileAcerca,
    getMobileAvisos,
    getMobileAyuda,
    getMobileBeneficios,
    getMobileContacto,
    getMobileCooperadora,
    getMobileCooperadoraPublica,
    getMobileCourseById,
    getMobileCourses,
    getMobileCredential,
} from '../controllers/mobile.controllers.js'
import { authenticateToken } from '../middlewares/auth.middlewares.js'
import { markMobileAlumnoLogin, requireMobileAlumno, trackMobileRequest } from '../middlewares/mobile.middlewares.js'

const mobileRouter = Router()

mobileRouter.use(trackMobileRequest)

mobileRouter.post('/auth/google', loginWithGoogle)
mobileRouter.post('/auth/login', markMobileAlumnoLogin, loginWithPassword)
mobileRouter.post('/auth/logout', logout)
mobileRouter.post('/auth/dev-login', markMobileAlumnoLogin, devLoginFallback)

const alumnoApp = [authenticateToken, requireMobileAlumno]

mobileRouter.get('/auth/me', ...alumnoApp, getMyProfile)
mobileRouter.get('/courses', ...alumnoApp, getMobileCourses)
mobileRouter.get('/courses/:id', ...alumnoApp, getMobileCourseById)
mobileRouter.get('/credential', ...alumnoApp, getMobileCredential)
mobileRouter.get('/avisos', ...alumnoApp, getMobileAvisos)
mobileRouter.get('/beneficios', ...alumnoApp, getMobileBeneficios)
mobileRouter.get('/beneficios-publicos', getMobileBeneficios)
mobileRouter.get('/contacto', ...alumnoApp, getMobileContacto)
mobileRouter.get('/contacto-publico', getMobileContacto)
mobileRouter.get('/ayuda', ...alumnoApp, getMobileAyuda)
mobileRouter.get('/ayuda-publica', getMobileAyuda)
mobileRouter.get('/acerca', ...alumnoApp, getMobileAcerca)
mobileRouter.get('/cooperadora', ...alumnoApp, getMobileCooperadora)
mobileRouter.get('/cooperadora-publica', getMobileCooperadoraPublica)

export default mobileRouter
