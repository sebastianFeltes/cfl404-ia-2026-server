/**
 * Reemplaza los patrocinadores de un curso por los ids precargados en Sponsor.
 * sponsorIds vacío deja el curso sin patrocinadores.
 */
export async function syncCourseSponsors(tx, courseId, sponsorIds) {
  const uniqueIds = [...new Set(
    (Array.isArray(sponsorIds) ? sponsorIds : [])
      .map((id) => String(id).trim())
      .filter(Boolean),
  )]

  if (uniqueIds.length > 0) {
    const found = await tx.sponsor.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true },
    })
    if (found.length !== uniqueIds.length) {
      const error = new Error('Uno o más patrocinadores no existen. Cargalos antes de asignarlos al curso.')
      error.statusCode = 400
      throw error
    }
  }

  await tx.courseSponsor.deleteMany({ where: { courseId } })
  if (uniqueIds.length === 0) return

  await tx.courseSponsor.createMany({
    data: uniqueIds.map((sponsorId) => ({ courseId, sponsorId })),
  })
}

export function mapCourseSponsors(courseSponsors = []) {
  return courseSponsors
    .map((link) => link.sponsor)
    .filter(Boolean)
    .map((sponsor) => ({
      id: sponsor.id,
      name: sponsor.name,
      logo: sponsor.logoUrl || null,
      description: sponsor.description || null,
      mention: `Patrocinado por ${sponsor.name}`,
      badge: sponsor.name,
    }))
}
