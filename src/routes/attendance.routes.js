import { Router } from 'express'
import { authenticateToken, requireQrScanner, requireStaff } from '../middlewares/auth.middlewares.js'
import {
  getAttendance,
  getAttendanceByCourse,
  getAttendanceCourses,
  scanAttendance,
  verifyAndRegisterAttendance,
} from '../controllers/attendance.controllers.js'

const attendanceRouter = Router()

attendanceRouter.get('/attendance', authenticateToken, requireStaff, getAttendance)
attendanceRouter.post('/attendance/verify', authenticateToken, requireStaff, verifyAndRegisterAttendance)

attendanceRouter.post(
  '/attendance/scan',
  authenticateToken,
  requireQrScanner,
  scanAttendance,
)

attendanceRouter.get(
  '/attendance/courses',
  authenticateToken,
  requireStaff,
  getAttendanceCourses,
)

attendanceRouter.get(
  '/attendance/course/:courseId',
  authenticateToken,
  requireStaff,
  getAttendanceByCourse,
)

export default attendanceRouter
