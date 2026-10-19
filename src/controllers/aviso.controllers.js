import prisma from '../lib/prisma.js'

function dateOrNull(value) {
  if (value == null || value === '') return null
  return new Date(value)
}

async function assertCourse(courseId) {
  if (!courseId) return null
  const course = await prisma.course.findUnique({ where: { id: courseId }, select: { id: true } })
  if (!course) {
    const error = new Error('El curso no existe')
    error.status = 400
    throw error
  }
  return course.id
}

function sendKnown(res, error) {
  if (error?.status) return res.status(error.status).json({ error: error.message })
  return null
}

export const listAvisos = async (_req, res, next) => {
  try {
    const avisos = await prisma.aviso.findMany({
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      include: { course: { select: { id: true, name: true } } },
    })
    return res.json({ avisos })
  } catch (error) {
    next(error)
  }
}

export const createAviso = async (req, res, next) => {
  try {
    const courseId = await assertCourse(req.body.courseId || null)
    const aviso = await prisma.aviso.create({
      data: {
        title: req.body.title,
        body: req.body.body,
        type: req.body.type,
        audience: req.body.audience,
        courseId,
        priority: req.body.priority ?? 0,
        publication: req.body.publication ?? 'borrador',
        startsAt: dateOrNull(req.body.startsAt),
        endsAt: dateOrNull(req.body.endsAt),
        createdById: req.user.id,
      },
      include: { course: { select: { id: true, name: true } } },
    })
    return res.status(201).json({ aviso })
  } catch (error) {
    if (sendKnown(res, error)) return
    next(error)
  }
}

export const updateAviso = async (req, res, next) => {
  try {
    const current = await prisma.aviso.findUnique({ where: { id: req.params.id } })
    if (!current) return res.status(404).json({ error: 'Aviso no encontrado' })

    const startsAt = req.body.startsAt !== undefined ? dateOrNull(req.body.startsAt) : current.startsAt
    const endsAt = req.body.endsAt !== undefined ? dateOrNull(req.body.endsAt) : current.endsAt
    if (startsAt && endsAt && endsAt <= startsAt) {
      return res.status(400).json({ error: 'endsAt debe ser posterior a startsAt' })
    }

    const data = { updatedById: req.user.id }
    for (const field of ['title', 'body', 'type', 'audience', 'priority', 'publication']) {
      if (req.body[field] !== undefined) data[field] = req.body[field]
    }
    if (req.body.courseId !== undefined) data.courseId = await assertCourse(req.body.courseId || null)
    if (req.body.startsAt !== undefined) data.startsAt = startsAt
    if (req.body.endsAt !== undefined) data.endsAt = endsAt

    const aviso = await prisma.aviso.update({
      where: { id: current.id },
      data,
      include: { course: { select: { id: true, name: true } } },
    })
    return res.json({ aviso })
  } catch (error) {
    if (sendKnown(res, error)) return
    next(error)
  }
}

export const archiveAviso = async (req, res, next) => {
  try {
    const current = await prisma.aviso.findUnique({ where: { id: req.params.id } })
    if (!current) return res.status(404).json({ error: 'Aviso no encontrado' })
    const aviso = await prisma.aviso.update({
      where: { id: current.id },
      data: { publication: 'archivado', updatedById: req.user.id },
    })
    return res.json({ aviso })
  } catch (error) {
    next(error)
  }
}
