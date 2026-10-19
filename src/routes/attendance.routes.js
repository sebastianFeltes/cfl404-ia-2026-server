import { Router } from 'express'
import { authenticateToken, authorizeRoles, requireQrScanner } from '../middlewares/auth.middlewares.js'
import {
  getAttendanceByCourse,
  getAttendanceCourses,
  markAttendance,
  scanAttendance,
} from '../controllers/attendance.controllers.js'

const attendanceRouter = Router()
const ATTENDANCE_READ_ROLES = [
  'god', 'admin', 'director', 'regente', 'directivo',
  'secretaria', 'preceptoria', 'instructor',
]

attendanceRouter.post(
  '/attendance/scan',
  authenticateToken,
  requireQrScanner,
  scanAttendance,
)

attendanceRouter.get(
  '/attendance/courses',
  authenticateToken,
  authorizeRoles(ATTENDANCE_READ_ROLES),
  getAttendanceCourses,
)

attendanceRouter.patch(
  '/attendance/course/:courseId/mark',
  authenticateToken,
  authorizeRoles(['god', 'director', 'regente', 'secretaria', 'preceptoria']),
  markAttendance,
)

attendanceRouter.get(
  '/attendance/course/:courseId',
  authenticateToken,
  authorizeRoles(ATTENDANCE_READ_ROLES),
  getAttendanceByCourse,
)

export default attendanceRouter
