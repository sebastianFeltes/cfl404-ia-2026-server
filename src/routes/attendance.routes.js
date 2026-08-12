import { Router } from "express";
import { getAttendance } from "../controllers/attendance.controllers.js";

const AtendanceRouter = Router()

AtendanceRouter.get('/attendance' ,getAttendance)

export default AtendanceRouter