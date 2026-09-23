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
import QueueRouter from './routes/queue.routes.js'
import { globalErrorHandler } from './middlewares/errorHandler.middlewares.js'

const app = express()
const isProduction = process.env.NODE_ENV === 'production'

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
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

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProduction ? 200 : 2000,
  message: { error: 'Demasiadas solicitudes desde esta IP, intente de nuevo más tarde' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'OPTIONS',
})
app.use(limiter)

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Demasiados intentos de autenticación. Probá más tarde.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'OPTIONS' || process.env.NODE_ENV === 'test',
})
app.use('/api/auth', authLimiter)

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
app.use(CourseRouter)
app.use(StaffRouter)
app.use('/api/v1', AlumnosRouter)
app.use('/api', AlumnosRouter)
app.use(CooperadoraRouter)
app.use(SettingsRouter)
app.use(SponsorsRouter)
app.use(QueueRouter)

app.use(globalErrorHandler)

export default app
