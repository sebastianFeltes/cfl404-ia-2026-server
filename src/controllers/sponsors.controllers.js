import prisma from '../lib/prisma.js'

/**
 * GET /api/v1/sponsors
 * Lista todos los patrocinadores con la cantidad de cursos asociados y sus IDs.
 */
export async function getSponsors(req, res, next) {
  try {
    const sponsors = await prisma.sponsor.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { courseDetails: true } },
        courseDetails: {
          select: { courseId: true },
        },
      },
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
      include: {
        _count: { select: { courseDetails: true } },
        courseDetails: {
          select: { courseId: true },
        },
      },
    })

    return res.status(201).json(sponsor)
  } catch (error) {
    next(error)
  }
}

/**
 * PATCH /api/v1/sponsors/:id
 * Actualiza un patrocinador existente (edición parcial) y sincroniza datos en cursos vinculados.
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
      include: {
        _count: { select: { courseDetails: true } },
        courseDetails: {
          select: { courseId: true },
        },
      },
    })

    // Sincronizar hacia los detalles de cursos que tienen asignado este sponsor
    if (name !== undefined || logoUrl !== undefined) {
      await prisma.courseDetail.updateMany({
        where: { sponsorId: id },
        data: {
          ...(name !== undefined && { sponsorName: String(name).trim() }),
          ...(logoUrl !== undefined && { sponsorLogo: logoUrl ? String(logoUrl) : null }),
        },
      })
    }

    return res.json(sponsor)
  } catch (error) {
    next(error)
  }
}

/**
 * DELETE /api/v1/sponsors/:id
 * Elimina un patrocinador. Desvincula y limpia los registros de CourseDetail.
 */
export async function deleteSponsor(req, res, next) {
  try {
    const { id } = req.params

    const existing = await prisma.sponsor.findUnique({ where: { id } })
    if (!existing) {
      return res.status(404).json({ error: 'Patrocinador no encontrado' })
    }

    // Limpiar referencias en course_detail
    await prisma.courseDetail.updateMany({
      where: { sponsorId: id },
      data: {
        sponsorId: null,
        sponsorName: null,
        sponsorLogo: null,
      },
    })

    await prisma.sponsor.delete({ where: { id } })
    return res.json({ message: 'Patrocinador eliminado correctamente' })
  } catch (error) {
    next(error)
  }
}

/**
 * PATCH /api/v1/courses/:courseId/sponsor
 * Asigna o desasigna un patrocinador a un curso (vía CourseDetail).
 * Body: { sponsorId: string | null }
 */
export async function assignSponsorToCourse(req, res, next) {
  try {
    const { courseId } = req.params
    const { sponsorId } = req.body

    // Validar que el curso existe
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: { courseDetail: true },
    })
    if (!course) {
      return res.status(404).json({ error: 'Curso no encontrado' })
    }

    // Validar que el sponsor existe si se provee
    let sponsor = null
    if (sponsorId) {
      sponsor = await prisma.sponsor.findUnique({ where: { id: sponsorId } })
      if (!sponsor) {
        return res.status(404).json({ error: 'Patrocinador no encontrado' })
      }
    }

    const updated = await prisma.courseDetail.upsert({
      where: { courseId },
      update: {
        sponsorId: sponsorId || null,
        sponsorName: sponsor ? sponsor.name : null,
        sponsorLogo: sponsor ? sponsor.logoUrl : null,
      },
      create: {
        courseId,
        quota: 25,
        hourQuantity: 120,
        classesQuantity: 32,
        sponsorId: sponsorId || null,
        sponsorName: sponsor ? sponsor.name : null,
        sponsorLogo: sponsor ? sponsor.logoUrl : null,
      },
      include: { sponsor: true },
    })

    return res.json(updated)
  } catch (error) {
    next(error)
  }
}
