import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import rateLimit from 'express-rate-limit'
import authRouter from './routes/auth.routes.js'
import CourseRouter from './routes/course.routes.js'
import StaffRouter from './routes/staff.routes.js'
import AlumnosRouter from './routes/alumnos.routes.js'
import CooperadoraRouter from './routes/cooperadora.routes.js'
import SettingsRouter from './routes/settings.routes.js'
import SponsorsRouter from './routes/sponsors.routes.js'
import attendanceRouter from './routes/attendance.routes.js'
import mobileRouter from './routes/mobile.routes.js'
import PreinscripcionRouter from './routes/preinscripcion.routes.js'
import AvisoRouter from './routes/aviso.routes.js'
import { globalErrorHandler } from './middlewares/errorHandler.middlewares.js'

const app = express()
const isProduction = process.env.NODE_ENV === 'production'

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
/* cors inseguro a proposito para live test */
contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      "connect-src": [
        "'self'", 
        "http://192.168.33.104:4000", 
        "http://192.168.33.104:5173", 
        "http://192.168.33.104:5174", 
        "ws://192.168.33.104:5173", 
        "wss://192.168.33.104:5173", 
        "https://accounts.google.com"
      ],
      "script-src": ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://accounts.google.com"],
      "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      "font-src": ["'self'", "https://fonts.gstatic.com"],
      "frame-src": ["'self'", "https://maps.google.com", "https://*.google.com"],
    },
  },
/* ----- */

}))
app.use(morgan(isProduction ? 'tiny' : 'dev'))
app.use((req, _res, next) => {
  req.cookies = {}
  const header = req.headers.cookie
  if (!header) return next()
  for (const part of header.split(';')) {
    const idx = part.indexOf('=')
    if (idx === -1) continue
    const key = part.slice(0, idx).trim()
    try {
      req.cookies[key] = decodeURIComponent(part.slice(idx + 1).trim())
    } catch {
      req.cookies[key] = part.slice(idx + 1).trim()
    }
  }
  next()
})

export function shouldSkipGlobalRateLimit(req) {
  if (req.method === 'OPTIONS') return true
  const path = req.path || ''
  if (req.method === 'GET' && (path === '/courses' || path === '/api/courses' || path === '/api/v1/courses')) {
    return true
  }
  if (req.method === 'POST' && (path === '/api/v1/preinscripciones' || path === '/api/preinscripciones')) {
    return true
  }
  return false
}

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProduction ? 200 : 2000,
  message: { error: 'Demasiadas solicitudes desde esta IP, intente de nuevo más tarde' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: shouldSkipGlobalRateLimit,
})
app.use(limiter)

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProduction ? 20 : 1000,
  message: { error: 'Demasiados intentos de autenticación. Probá más tarde.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'OPTIONS' || !isProduction,
})
app.use('/api/auth', authLimiter)
app.use('/api/mobile/auth', authLimiter)

const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

app.use((req, res, next) => {
  cors({
    origin(origin, callback) {
      if (!origin) {
        if (isProduction && req.path !== '/health') {
          const error = new Error('Origen no permitido por CORS')
          error.statusCode = 403
          return callback(error)
        }
        return callback(null, true)
      }
      if (allowedOrigins.includes(origin)) return callback(null, true)
      const error = new Error(`Origen no permitido por CORS: ${origin}`)
      error.statusCode = 403
      callback(error)
    },
    credentials: true,
  })(req, res, next)
})
app.use(express.json({ limit: '32kb' }))
app.use(express.urlencoded({ extended: true, limit: '32kb' }))

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  })
})

app.use(authRouter)
app.use('/api/mobile', mobileRouter)
app.use(CourseRouter)
app.use(StaffRouter)
app.use('/api/v1', AlumnosRouter)
app.use('/api', AlumnosRouter)
app.use(CooperadoraRouter)
app.use(SettingsRouter)
app.use(SponsorsRouter)
app.use(PreinscripcionRouter)
app.use(AvisoRouter)
app.use('/api/v1', attendanceRouter)
app.use('/api', attendanceRouter)
app.use(attendanceRouter)

app.use(globalErrorHandler)

export default app
