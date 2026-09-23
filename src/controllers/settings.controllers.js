import prisma from '../lib/prisma.js'

/**
 * GET /api/settings/kpis
 * Público: devuelve solo las claves kpi_* (valores institucionales visibles en la web).
 */
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

/**
 * GET /api/v1/settings
 * Protegido (GOD / DIRECTOR / REGENTE): devuelve todos los settings.
 */
export async function getAllSettings(req, res, next) {
  try {
    const settings = await prisma.setting.findMany({
      orderBy: { key: 'asc' },
    })
    return res.json(settings)
  } catch (error) {
    next(error)
  }
}

/**
 * POST  /api/v1/settings          → crea o actualiza (key en body)
 * PATCH /api/v1/settings/:key     → actualiza (key en params)
 * Protegido (GOD / DIRECTOR / REGENTE).
 */
export async function updateSetting(req, res, next) {
  try {
    // key puede venir en params (PATCH) o en body (POST)
    const key = req.params.key ?? req.body.key
    if (!key || String(key).trim().length === 0) {
      return res.status(400).json({ error: 'Se requiere la clave (key)' })
    }

    const { value, name, description } = req.body

    if (value === undefined && name === undefined && description === undefined) {
      return res.status(400).json({ error: 'Se requiere al menos un campo: value, name o description' })
    }

    const data = {}
    if (value !== undefined) data.value = String(value)
    if (name !== undefined) data.name = String(name)
    if (description !== undefined) data.description = String(description)

    // upsert: crea el setting si no existe
    const setting = await prisma.setting.upsert({
      where: { key: String(key).trim() },
      update: data,
      create: { key: String(key).trim(), value: String(value ?? ''), ...data },
    })

    const statusCode = req.method === 'POST' ? 201 : 200
    return res.status(statusCode).json(setting)
  } catch (error) {
    next(error)
  }
}

/**
 * DELETE /api/v1/settings/:key
 * Protegido (GOD / DIRECTOR / REGENTE): elimina una clave de configuración.
 */
export async function deleteSetting(req, res, next) {
  try {
    const { key } = req.params
    const existing = await prisma.setting.findUnique({ where: { key } })
    if (!existing) {
      return res.status(404).json({ error: 'Configuración no encontrada' })
    }

    await prisma.setting.delete({ where: { key } })
    return res.json({ message: 'Configuración eliminada correctamente' })
  } catch (error) {
    next(error)
  }
}

