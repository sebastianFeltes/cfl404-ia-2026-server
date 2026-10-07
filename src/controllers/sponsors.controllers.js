import prisma from '../lib/prisma.js'
import { syncCourseSponsors } from '../lib/courseSponsors.js'

const SPONSOR_INCLUDE = {
  _count: { select: { courseSponsors: true } },
  courseSponsors: {
    select: { courseId: true },
  },
}

/**
 * GET /api/v1/sponsors
 * Lista todos los patrocinadores con la cantidad de cursos asociados y sus IDs.
 */
export async function getSponsors(req, res, next) {
  try {
    const sponsors = await prisma.sponsor.findMany({
      orderBy: { name: 'asc' },
      include: SPONSOR_INCLUDE,
    })
    return res.json(sponsors)
  } catch (error) {
    next(error)
  }
}

/**
 * POST /api/v1/sponsors
 * Crea un nuevo patrocinador.
 * Body: { name, description?, logoUrl? }
 */
export async function createSponsor(req, res, next) {
  try {
    const { name, description, logoUrl } = req.body

    if (!name || String(name).trim().length === 0) {
      return res.status(400).json({ error: 'El nombre del patrocinador es obligatorio' })
    }

    const sponsor = await prisma.sponsor.create({
      data: {
        name: String(name).trim(),
        description: description ? String(description).trim() : null,
        logoUrl: logoUrl ? String(logoUrl) : null,
      },
      include: SPONSOR_INCLUDE,
    })

    return res.status(201).json(sponsor)
  } catch (error) {
    next(error)
  }
}

/**
 * PATCH /api/v1/sponsors/:id
 * Actualiza un patrocinador existente (edición parcial).
 * Los cursos lo referencian por la tabla course_sponsor, así que el nombre y el logo
 * se leen siempre desde Sponsor.
 */
export async function updateSponsor(req, res, next) {
  try {
    const { id } = req.params
    const { name, description, logoUrl } = req.body

    const existing = await prisma.sponsor.findUnique({ where: { id } })
    if (!existing) {
      return res.status(404).json({ error: 'Patrocinador no encontrado' })
    }

    const data = {}
    if (name !== undefined) data.name = String(name).trim()
    if (description !== undefined) data.description = description ? String(description).trim() : null
    if (logoUrl !== undefined) data.logoUrl = logoUrl ? String(logoUrl) : null

    const sponsor = await prisma.sponsor.update({
      where: { id },
      data,
      include: SPONSOR_INCLUDE,
    })

    return res.json(sponsor)
  } catch (error) {
    next(error)
  }
}

/**
 * DELETE /api/v1/sponsors/:id
 * Elimina un patrocinador. Las filas de course_sponsor se borran en cascada.
 */
export async function deleteSponsor(req, res, next) {
  try {
    const { id } = req.params

    const existing = await prisma.sponsor.findUnique({ where: { id } })
    if (!existing) {
      return res.status(404).json({ error: 'Patrocinador no encontrado' })
    }

    await prisma.sponsor.delete({ where: { id } })
    return res.json({ message: 'Patrocinador eliminado correctamente' })
  } catch (error) {
    next(error)
  }
}

/**
 * PATCH /api/v1/courses/:courseId/sponsor
 * Reemplaza los patrocinadores de un curso por sponsors ya cargados.
 * Body: { sponsorIds: string[] } o, en compatibilidad, { sponsorId: string | null }
 */
export async function assignSponsorToCourse(req, res, next) {
  try {
    const { courseId } = req.params
    const { sponsorIds, sponsorId } = req.body

    const course = await prisma.course.findUnique({ where: { id: courseId } })
    if (!course) {
      return res.status(404).json({ error: 'Curso no encontrado' })
    }

    const ids = Array.isArray(sponsorIds)
      ? sponsorIds
      : sponsorId
        ? [sponsorId]
        : []

    await prisma.$transaction(async (tx) => {
      await syncCourseSponsors(tx, courseId, ids)
    })

    const links = await prisma.courseSponsor.findMany({
      where: { courseId },
      include: { sponsor: true },
      orderBy: { createdAt: 'asc' },
    })

    return res.json(links)
  } catch (error) {
    next(error)
  }
}
