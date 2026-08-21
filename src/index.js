import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { PrismaClient } from '@prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import AtendanceRouter from './routes/attendance.routes.js'
import CourseRouter from './routes/course.routes.js'
import { globalErrorHandler } from './middlewares/errorHandler.middlewares.js'

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

const adapter = new PrismaBetterSqlite3({
    url: 'file:./database.db'
})

const prisma = new PrismaClient({ adapter })

app.get('/health', (req,res)=>{      
       res.json({
        message: new Date().toISOString(),
    })
})

app.use(AtendanceRouter)
app.use(CourseRouter)

app.use(globalErrorHandler)
app.listen(PORT, ()=>{
    console.log('servidor escuchando en el puerto ', PORT);
})