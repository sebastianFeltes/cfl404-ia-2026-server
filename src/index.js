import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import rateLimit from 'express-rate-limit'
import prisma from './db.js'
import AtendanceRouter from './routes/attendance.routes.js'
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
app.use(cors())
app.use(express.json())

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  })
})

// 4. Conexión de Rutas Principales
app.use(AtendanceRouter)
app.use('/api', AlumnosRouter)

// 5. Manejador Global de Errores (Siempre al final)
app.use(globalErrorHandler)

app.listen(PORT, () => {
  console.log('Servidor escuchando en el puerto', PORT)
})