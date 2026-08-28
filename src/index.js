import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import rateLimit from 'express-rate-limit'
import authRouter from './routes/auth.routes.js'
import AtendanceRouter from './routes/attendance.routes.js'
import CourseRouter from './routes/course.routes.js'
import StaffRouter from './routes/staff.routes.js'
import AlumnosRouter from './routes/alumnos.routes.js'
import { globalErrorHandler } from './middlewares/errorHandler.middlewares.js'

const app = express()
const PORT = process.env.PORT || 4000

// 1. Middlewares Globales de Seguridad y Monitoreo
app.use(helmet())
app.use(morgan('dev'))

// 2. Limitador de Peticiones (Anti fuerza bruta / DoS básico)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 200, // Límite de peticiones por IP
  message: { error: 'Demasiadas solicitudes desde esta IP, intente de nuevo más tarde' },
  standardHeaders: true,
  legacyHeaders: false,
})
app.use(limiter)

// 3. Middlewares de Parseo y CORS
// Solo se aceptan los orígenes declarados en CLIENT_URL (lista separada por comas).
// Las herramientas sin origen (curl, Postman, health checks) siguen permitidas.
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true)
      const error = new Error(`Origen no permitido por CORS: ${origin}`)
      error.statusCode = 403
      callback(error)
    },
    credentials: true,
  }),
)
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: new Date().toISOString(),
    timestamp: new Date().toISOString(),
  })
})

// 4. Conexión de Rutas Principales
app.use(authRouter)
app.use(AtendanceRouter)
app.use(CourseRouter)
app.use(StaffRouter)
app.use('/api', AlumnosRouter)

// 5. Manejador Global de Errores (Siempre al final)
app.use(globalErrorHandler)

app.listen(PORT, () => {
  console.log('Servidor escuchando en el puerto', PORT)
})
