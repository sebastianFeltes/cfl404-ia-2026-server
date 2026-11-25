import prisma from './prisma.js'

export const STATUS_CATALOG = [
  { id: 1, name: 'activo', context: 'persona' },
  { id: 2, name: 'inactivo', context: 'persona' },
  { id: 3, name: 'pendiente', context: 'persona' },
  { id: 4, name: 'egresado', context: 'persona' },
  { id: 5, name: 'suspendido', context: 'persona' },
  { id: 6, name: 'bloqueado', context: 'persona' },
  { id: 7, name: 'eliminado', context: 'persona' },
  { id: 8, name: 'inscripcion_abierta', context: 'curso' },
  { id: 9, name: 'ultimos_cupos', context: 'curso' },
  { id: 10, name: 'cupo_completo', context: 'curso' },
  { id: 11, name: 'curso_finalizado', context: 'curso' },
  { id: 12, name: 'baja_requisito', context: 'inscripcion' },
  { id: 13, name: 'baja_manual', context: 'inscripcion' },
  { id: 14, name: 'baja_inasistencia', context: 'inscripcion' },
]

const BAJA_NAMES = new Set(['baja_requisito', 'baja_manual', 'baja_inasistencia'])

export function isBajaStatus(name) {
  return BAJA_NAMES.has(String(name || '').toLowerCase())
}

export async function ensureStatusCatalog(db = prisma) {
  for (const row of STATUS_CATALOG) {
    await db.status.upsert({
      where: { id: row.id },
      create: row,
      update: { name: row.name, context: row.context },
    })
  }
}
