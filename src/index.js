import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import rateLimit from 'express-rate-limit'
import authRouter from './routes/auth.routes.js'
import AtendanceRouter from './routes/attendance.routes.js'
import { globalErrorHandler } from './middlewares/errorHandler.middlewares.js'

const app = express()
const PORT = process.env.PORT || 3001

// Rate limiter: máximo 100 peticiones por ventana de 15 minutos por IP
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Demasiadas solicitudes desde esta IP, por favor intenta de nuevo más tarde.' }
})

// Middlewares globales de seguridad y logs
app.use(helmet())
app.use(morgan('dev'))
app.use(limiter)
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.get('/health', (req, res) => {      
    res.json({
        message: new Date().toISOString(),
    })
})

// Rutas de la API
app.use(authRouter)
app.use(AtendanceRouter)

// Manejo global de errores
app.use(globalErrorHandler)

app.listen(PORT, () => {
    console.log('servidor escuchando en el puerto ', PORT);
})
