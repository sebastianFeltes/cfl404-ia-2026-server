import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import AtendanceRouter from './routes/attendance.routes.js'
import StaffRouter from './routes/staff.routes.js'
import { globalErrorHandler } from './middlewares/errorHandler.middlewares.js'

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

app.get('/health', (req,res)=>{      
       res.json({
        message: new Date().toISOString(),
    })
})

app.use(AtendanceRouter)
app.use(StaffRouter)

app.use(globalErrorHandler)
app.listen(PORT, ()=>{
    console.log('servidor escuchando en el puerto ', PORT);
})