import { timingSafeEqual } from 'node:crypto'
import prisma from '../lib/prisma.js'
import {
  EnrollmentError,
  assignApplicantNumber,
  expireReadyTickets,
  liberarCupo,
  profileIsComplete,
  requestPreinscripcion,
} from '../lib/enrollment.js'

const DNI_TAKEN = 'Ese DNI ya está registrado en el sistema'

function secretsMatch(expected, provided) {
  if (!expected || !provided) return false
  const left = Buffer.from(String(expected))
  const right = Buffer.from(String(provided))
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

function sendEnrollmentError(res, error) {
  return res.status(error.statusCode || 500).json({
    error: error.message,
    ...error.details,
  })
}

export const getPreinscripcionTurno = async (req, res, next) => {
  try {
    await expireReadyTickets()
    const tickets = await prisma.queueTicket.findMany({
      where: { userId: req.user.id, status: { in: ['esperando', 'listo'] } },
      orderBy: { createdAt: 'asc' },
      include: { course: { select: { id: true, name: true } } },
    })
    const payload = []
    for (const ticket of tickets) {
      const ahead = ticket.status === 'esperando'
        ? await prisma.queueTicket.count({
          where: {
            courseId: ticket.courseId,
            status: 'esperando',
            createdAt: { lt: ticket.createdAt },
          },
        })
        : 0
      payload.push({
        courseId: ticket.courseId,
        courseName: ticket.course?.name || null,
        status: ticket.status,
        position: ticket.status === 'esperando' ? ahead + 1 : null,
        readyUntil: ticket.readyUntil,
      })
    }
    const rows = await prisma.userCourse.findMany({
      where: { userId: req.user.id, occupiesQuota: true },
      include: { course: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'asc' },
    })
    const enrollments = rows.map((row) => ({
      courseId: row.courseId,
      courseName: row.course?.name || null,
      status: 'inscripto',
      position: row.position,
    }))
    return res.json({ tickets: payload, enrollments })
  } catch (error) {
    next(error)
  }
}

export const createPreinscripcion = async (req, res, next) => {
  try {
    const roleName = String(req.user?.role || '').toLowerCase()
    if (roleName !== 'postulante') {
      return res.status(403).json({ error: 'Solo un postulante puede preinscribirse' })
    }
    const courseId = String(req.body?.courseId || '').trim()
    if (!courseId) return res.status(400).json({ error: 'Falta courseId' })

    const result = await requestPreinscripcion({ userId: req.user.id, courseId })
    return res.status(result.status === 'confirmado' ? 201 : 200).json(result)
  } catch (error) {
    if (error instanceof EnrollmentError) return sendEnrollmentError(res, error)
    next(error)
  }
}

async function findPerson({ email, dni, applicantNumber }) {
  if (applicantNumber != null && applicantNumber !== '') {
    const byNumber = await prisma.user.findUnique({
      where: { applicantNumber: Number(applicantNumber) },
      include: { userDetail: true, role: true },
    })
    if (byNumber) return byNumber
  }
  if (dni) {
    const byDni = await prisma.user.findUnique({
      where: { dni: String(dni).trim() },
      include: { userDetail: true, role: true },
    })
    if (byDni) return byDni
  }
  if (email) {
    return prisma.user.findUnique({
      where: { email: String(email).trim().toLowerCase() },
      include: { userDetail: true, role: true },
    })
  }
  return null
}

export const handlePreinscripcionWebhook = async (req, res, next) => {
  try {
    const provided = req.get('x-preinscripcion-webhook-secret')
    if (!secretsMatch(process.env.PREINSCRIPCION_WEBHOOK_SECRET, provided)) {
      return res.status(401).json({ error: 'Webhook no autorizado' })
    }

    const event = String(req.body?.event || '')
    const courseId = String(req.body?.courseId || '').trim()
    const email = req.body?.email ? String(req.body.email).trim().toLowerCase() : null
    const dni = req.body?.dni ? String(req.body.dni).trim() : null
    const applicantNumber = req.body?.applicantNumber

    if (!courseId) return res.status(400).json({ error: 'Falta courseId' })

    if (event === 'preinscripcion.rechazada' || event === 'preinscripcion.baja') {
      const person = await findPerson({ email, dni, applicantNumber })
      if (!person) return res.status(404).json({ error: 'Persona no encontrada' })
      await liberarCupo({ userId: person.id, courseId })
      return res.json({
        applicantNumber: person.applicantNumber,
        courseId,
        released: true,
      })
    }

    if (event !== 'preinscripcion.confirmada') {
      return res.status(400).json({ error: 'Evento no reconocido' })
    }

    if (dni) {
      const taken = await prisma.user.findUnique({ where: { dni } })
      if (taken && email && taken.email !== email) {
        return res.status(409).json({ error: DNI_TAKEN })
      }
    }

    let person = await findPerson({ email, dni, applicantNumber })
    if (person && dni && person.dni && person.dni !== dni) {
      return res.status(409).json({ error: DNI_TAKEN })
    }

    const payloadProfile = {
      firstName: req.body?.firstName || person?.firstName,
      lastName: req.body?.lastName || person?.lastName,
      dni: dni || person?.dni,
      userDetail: {
        phone: req.body?.phone || person?.userDetail?.phone,
        address: req.body?.address || person?.userDetail?.address,
        dob: req.body?.dob || person?.userDetail?.dob,
      },
    }

    if (!person) {
      if (!email) return res.status(400).json({ error: 'Falta email para crear el postulante' })
      if (!profileIsComplete(payloadProfile)) {
        return res.status(403).json({ error: 'El legajo está incompleto y no ocupa cupo' })
      }
      const role = await prisma.role.findFirst({ where: { name: 'postulante' } })
      person = await prisma.user.create({
        data: {
          firstName: String(payloadProfile.firstName).trim(),
          lastName: String(payloadProfile.lastName).trim(),
          email,
          dni: String(payloadProfile.dni).trim(),
          roleId: role?.id ?? 9,
          statusId: 3,
          userDetail: {
            create: {
              phone: String(payloadProfile.userDetail.phone).trim(),
              address: String(payloadProfile.userDetail.address).trim(),
              dob: new Date(payloadProfile.userDetail.dob),
            },
          },
        },
        include: { userDetail: true, role: true },
      })
      person.applicantNumber = await assignApplicantNumber(person.id)
    } else if (!profileIsComplete({ ...person, ...payloadProfile, userDetail: payloadProfile.userDetail })) {
      const number = person.applicantNumber ?? await assignApplicantNumber(person.id)
      return res.status(403).json({
        error: 'El legajo está incompleto y no ocupa cupo',
        applicantNumber: number,
      })
    }

    try {
      const result = await requestPreinscripcion({ userId: person.id, courseId })
      const status = result.status === 'esperando' ? 200 : 201
      return res.status(status).json(result)
    } catch (error) {
      if (error instanceof EnrollmentError) return sendEnrollmentError(res, error)
      throw error
    }
  } catch (error) {
    if (error?.code === 'P2002') {
      return res.status(409).json({ error: DNI_TAKEN })
    }
    next(error)
  }
}
