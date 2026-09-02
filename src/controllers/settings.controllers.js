import prisma from '../lib/prisma.js'

export async function getKpis(req, res, next) {
  try {
    const kpis = await prisma.setting.findMany({
      where: {
        key: { startsWith: 'kpi_' },
      },
      orderBy: { key: 'asc' },
    })
    return res.json(kpis)
  } catch (error) {
    next(error)
  }
}
