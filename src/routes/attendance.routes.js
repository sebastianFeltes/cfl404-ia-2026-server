import { Router } from 'express'
import { getAttendance, verifyAndRegisterAttendance } from '../controllers/attendance.controllers.js'
import { authenticateToken, requireStaff } from '../middlewares/auth.middlewares.js'

const attendanceRouter = Router()

attendanceRouter.get('/attendance', authenticateToken, requireStaff, getAttendance)
attendanceRouter.post('/attendance/verify', authenticateToken, requireStaff, verifyAndRegisterAttendance)

export default attendanceRouter