import prisma from '../lib/prisma.js'
import { buildAttendanceTokenFromUserId } from '../lib/attendance-token.js'
import { getPayments } from './cooperadora.controllers.js'
import {
    DEFAULT_ACERCA,
    DEFAULT_AYUDA,
    DEFAULT_BENEFICIOS,
    DEFAULT_CONTACTO,
    DEFAULT_COOPERADORA,
    MOBILE_SETTING_KEYS,
    readMobileSetting,
} from '../lib/mobile-content.js'

const ABSENCE_CODE_NAMES = new Set(['ausente', 'media falta'])
const LATE_CODE_NAMES = new Set(['tarde'])
const MONTH_LABELS = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

const enrollmentInclude = {
    attendances: { include: { attendanceCode: true }, orderBy: { createdAt: 'desc' } },
    course: {
        include: {
            status: true,
            instructor: { select: { firstName: true, lastName: true, email: true, profilePhotoUrl: true } },
            courseDetail: true,
            courseDays: { include: { day: true }, orderBy: { dayId: 'asc' } },
            classroomCourses: { include: { classroom: true } },
            courseSponsors: { include: { sponsor: true }, orderBy: { createdAt: 'asc' } },
        },
    },
}

function summarizeAttendance(attendances = []) {
    const summary = { present: 0, absent: 0, late: 0 }
    for (const row of attendances) {
        const name = String(row.attendanceCode?.name || '').toLowerCase()
        if (ABSENCE_CODE_NAMES.has(name)) summary.absent += 1
        else if (LATE_CODE_NAMES.has(name)) summary.late += 1
        else if (name) summary.present += 1
    }
    return summary
}

function serializeHistory(attendances = []) {
    return attendances.map((row) => {
        const codeName = String(row.attendanceCode?.name || '').toLowerCase()
        return {
            id: row.id,
            date: row.createdAt,
            codeId: row.idCode,
            codeName,
            countsAsAbsence: ABSENCE_CODE_NAMES.has(codeName),
        }
    })
}

function absenceNotice(summary, course) {
    const limit = course?.maxAbsences ?? 0
    const remaining = limit - summary.absent
    if (limit <= 0) return null
    if (remaining <= 0) return 'Alcanzaste el límite de faltas. Podés solicitar la reincorporación.'
    if (remaining <= 2) return `Te quedan ${remaining} falta${remaining === 1 ? '' : 's'} antes del límite.`
    return null
}

function serializeEnrollment(enrollment, { history = false } = {}) {
    const course = enrollment.course
    const summary = summarizeAttendance(enrollment.attendances)
    const days = (course?.courseDays || []).map((item) => item.day?.name).filter(Boolean)
    const classroomName = course?.classroomCourses?.[0]?.classroom?.name || null
    const sponsor = course?.courseSponsors?.[0]?.sponsor || null

    const payload = {
        userCourseId: enrollment.id,
        enrollmentDate: enrollment.createdAt,
        absenceCount: summary.absent,
        absenceLimit: course?.maxAbsences ?? 0,
        attendanceSummary: summary,
        days,
        classroom: classroomName,
        notification: absenceNotice(summary, course),
        course: {
            id: course?.id,
            name: course?.name || 'Curso',
            statusId: course?.statusId,
            status: { name: String(course?.status?.name || 'activo').toLowerCase() },
            startDate: course?.startDate || null,
            endDate: course?.endDate || null,
            startTime: course?.startTime || null,
            endTime: course?.endTime || null,
            isAnnual: Boolean(course?.isAnnual),
            maxAbsences: course?.maxAbsences ?? 0,
            preEnrollmentDate: course?.preEnrollmentDate || null,
            instructorId: course?.instructorId,
            instructor: {
                firstName: course?.instructor?.firstName || 'Sin docente',
                lastName: course?.instructor?.lastName || '',
                email: course?.instructor?.email || null,
                profilePhotoUrl: course?.instructor?.profilePhotoUrl || null,
            },
            courseDetail: {
                description: course?.courseDetail?.description || null,
                hourQuantity: course?.courseDetail?.hourQuantity ?? 0,
                classesQuantity: course?.courseDetail?.classesQuantity ?? 0,
                quota: course?.courseDetail?.quota ?? null,
                titleRequired: Boolean(course?.courseDetail?.titleRequired),
                endorsementBy: course?.courseDetail?.endorsementBy || null,
                sponsorName: sponsor?.name || null,
                sponsorLogo: sponsor?.logoUrl || null,
            },
            whatsappGroupUrl: course?.courseDetail?.whatsappGroupUrl || null,
            resourcesUrl: course?.courseDetail?.resourcesUrl || null,
            cycleLabel: String(new Date().getFullYear()),
        },
    }

    if (history) payload.attendanceHistory = serializeHistory(enrollment.attendances)
    return payload
}

async function loadEnrollments(userId) {
    return prisma.userCourse.findMany({
        where: { userId },
        include: enrollmentInclude,
        orderBy: { createdAt: 'asc' },
    })
}

function invokeController(handler, req) {
    return new Promise((resolve, reject) => {
        let statusCode = 200
        const res = {
            status(code) {
                statusCode = code
                return this
            },
            json(payload) {
                resolve({ statusCode, payload })
            },
        }
        Promise.resolve(handler(req, res, (error) => reject(error))).catch(reject)
    })
}

export const getMobileCourses = async (req, res, next) => {
    try {
        const enrollments = await loadEnrollments(req.user.id)
        return res.json({ courses: enrollments.map((item) => serializeEnrollment(item)) })
    } catch (error) {
        next(error)
    }
}

export const getMobileCourseById = async (req, res, next) => {
    try {
        const enrollment = await prisma.userCourse.findUnique({
            where: {
                userId_courseId: {
                    userId: req.user.id,
                    courseId: req.params.id,
                },
            },
            include: enrollmentInclude,
        })

        if (!enrollment) {
            return res.status(404).json({ error: 'No estás inscripto en este curso' })
        }

        return res.json(serializeEnrollment(enrollment, { history: true }))
    } catch (error) {
        next(error)
    }
}

export const getMobileCredential = async (req, res, next) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                dni: true,
                attendanceToken: true,
                profilePhotoUrl: true,
                role: { select: { name: true } },
                status: { select: { name: true } },
            },
        })

        if (!user) {
            return res.status(404).json({ error: 'Alumno no encontrado' })
        }

        const enrollment = await prisma.userCourse.findFirst({
            where: { userId: user.id },
            include: { course: { select: { id: true, name: true } } },
            orderBy: { createdAt: 'asc' },
        })

        return res.json({
            studentId: user.id,
            attendanceToken: user.attendanceToken || buildAttendanceTokenFromUserId(user.id),
            firstName: user.firstName,
            lastName: user.lastName,
            dni: user.dni,
            profilePhotoUrl: user.profilePhotoUrl,
            role: user.role?.name || 'alumno',
            status: user.status?.name || null,
            courseId: enrollment?.course?.id || null,
            courseName: enrollment?.course?.name || null,
            cycleLabel: String(new Date().getFullYear()),
            institution: 'CFL N°404 Berisso',
        })
    } catch (error) {
        next(error)
    }
}

export const getMobileAvisos = async (req, res, next) => {
    try {
        const enrollments = await loadEnrollments(req.user.id)
        const avisos = []
        const now = new Date()
        const courseIds = enrollments.filter((row) => row.occupiesQuota).map((row) => row.courseId)
        const published = await prisma.aviso.findMany({
            where: {
                publication: 'publicado',
                audience: { in: ['todos', 'alumnos'] },
                AND: [
                    { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
                    { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
                    { OR: [{ courseId: null }, { courseId: { in: courseIds } }] },
                ],
            },
            orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
            include: { course: { select: { id: true, name: true } } },
        })
        for (const aviso of published) {
            avisos.push({
                id: aviso.id,
                courseId: aviso.courseId,
                courseName: aviso.course?.name || null,
                title: aviso.title,
                message: aviso.body,
                date: (aviso.startsAt || aviso.createdAt).toISOString(),
                type: aviso.type,
            })
        }

        for (const enrollment of enrollments) {
            const serialized = serializeEnrollment(enrollment)
            if (!serialized.notification) continue
            const remaining = serialized.absenceLimit - serialized.absenceCount
            avisos.push({
                id: `faltas-${serialized.course.id}`,
                courseId: serialized.course.id,
                courseName: serialized.course.name,
                title: remaining <= 0 ? 'Límite de faltas alcanzado' : 'Pocas faltas disponibles',
                message: serialized.notification,
                date: new Date().toISOString(),
                type: 'operativo',
            })
        }

        const year = new Date().getFullYear()
        const payments = await prisma.cooperadoraPayment.findMany({
            where: { userId: req.user.id, year },
            select: { month: true },
        })
        const paid = new Set(payments.map((row) => row.month))
        const currentMonth = new Date().getMonth() + 1
        const pending = []
        for (let month = 1; month <= currentMonth; month += 1) {
            if (!paid.has(month)) pending.push(MONTH_LABELS[month - 1])
        }
        if (pending.length > 0) {
            avisos.push({
                id: `cooperadora-${year}`,
                courseId: null,
                courseName: 'Cooperadora',
                title: 'Cuotas de cooperadora pendientes',
                message: `Todavía no figura el pago de ${pending.join(', ')} ${year}.`,
                date: new Date().toISOString(),
                type: 'informativo',
            })
        }

        return res.json({ avisos })
    } catch (error) {
        next(error)
    }
}

export const getMobileBeneficios = async (req, res, next) => {
    try {
        const beneficios = await readMobileSetting(MOBILE_SETTING_KEYS.beneficios, DEFAULT_BENEFICIOS)
        const list = Array.isArray(beneficios) ? beneficios : DEFAULT_BENEFICIOS
        return res.json({ beneficios: list })
    } catch (error) {
        next(error)
    }
}

export const getMobileContacto = async (req, res, next) => {
    try {
        const stored = await readMobileSetting(MOBILE_SETTING_KEYS.contacto, DEFAULT_CONTACTO)
        return res.json({ ...DEFAULT_CONTACTO, ...stored, social: { ...DEFAULT_CONTACTO.social, ...(stored.social || {}) } })
    } catch (error) {
        next(error)
    }
}

export const getMobileAyuda = async (req, res, next) => {
    try {
        const ayuda = await readMobileSetting(MOBILE_SETTING_KEYS.ayuda, DEFAULT_AYUDA)
        const topics = Array.isArray(ayuda) ? ayuda : DEFAULT_AYUDA
        return res.json({ topics })
    } catch (error) {
        next(error)
    }
}

export const getMobileAcerca = async (req, res, next) => {
    try {
        const stored = await readMobileSetting(MOBILE_SETTING_KEYS.acerca, DEFAULT_ACERCA)
        const creators = Array.isArray(stored.creators) && stored.creators.length
            ? stored.creators
            : DEFAULT_ACERCA.creators
        return res.json({
            ...DEFAULT_ACERCA,
            ...stored,
            creators,
            support: { ...DEFAULT_ACERCA.support, ...(stored.support || {}) },
            rate: { ...DEFAULT_ACERCA.rate, ...(stored.rate || {}) },
        })
    } catch (error) {
        next(error)
    }
}

export const getMobileCooperadoraPublica = async (_req, res, next) => {
    try {
        const stored = await readMobileSetting(MOBILE_SETTING_KEYS.cooperadora, DEFAULT_COOPERADORA)
        const bank = { ...DEFAULT_COOPERADORA, ...stored }
        return res.json({
            monthlyAmount: Number(bank.monthlyAmount) || DEFAULT_COOPERADORA.monthlyAmount,
            bank: {
                banco: bank.banco,
                alias: bank.alias,
                cbu: bank.cbu,
                cuit: bank.cuit,
                whatsappNumber: bank.whatsappNumber,
                whatsappMessage: bank.whatsappMessage,
            },
        })
    } catch (error) {
        next(error)
    }
}

export const getMobileCooperadora = async (req, res, next) => {
    try {
        const year = Number.parseInt(req.query.year, 10) || new Date().getFullYear()
        const scopedReq = {
            query: {
                year: String(year),
                studentId: req.user.id,
            },
        }
        const { payload } = await invokeController(getPayments, scopedReq)
        const payments = Array.isArray(payload?.data) ? payload.data : []
        const byMonth = new Map(payments.map((row) => [row.month, row]))
        const stored = await readMobileSetting(MOBILE_SETTING_KEYS.cooperadora, DEFAULT_COOPERADORA)
        const bank = { ...DEFAULT_COOPERADORA, ...stored }

        const months = MONTH_LABELS.map((label, index) => {
            const month = index + 1
            const row = byMonth.get(month)
            return {
                month,
                label,
                paid: Boolean(row),
                amount: row ? row.amount : null,
                paymentDate: row?.payment_date || null,
                notes: row?.notes || null,
            }
        })

        return res.json({
            year,
            monthlyAmount: Number(bank.monthlyAmount) || DEFAULT_COOPERADORA.monthlyAmount,
            bank: {
                banco: bank.banco,
                alias: bank.alias,
                cbu: bank.cbu,
                cuit: bank.cuit,
                whatsappNumber: bank.whatsappNumber,
                whatsappMessage: bank.whatsappMessage,
            },
            months,
        })
    } catch (error) {
        next(error)
    }
}
