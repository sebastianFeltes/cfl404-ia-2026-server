const ENROLLMENT_UI = {
  inscripcion_abierta: {
    label: 'Inscripción Abierta',
    color: 'bg-emerald-500/10 text-emerald-700 border-emerald-300 dark:text-emerald-400',
    badgeColor: 'bg-emerald-500',
  },
  ultimos_cupos: {
    label: 'Últimos Cupos',
    color: 'bg-amber-500/10 text-amber-700 border-amber-300 dark:text-amber-400',
    badgeColor: 'bg-amber-500',
  },
  cupo_completo: {
    label: 'Cupo Completo',
    color: 'bg-rose-500/10 text-rose-700 border-rose-300 dark:text-rose-400',
    badgeColor: 'bg-rose-500',
  },
  curso_finalizado: {
    label: 'Curso Finalizado',
    color: 'bg-gray-500/10 text-gray-700 border-gray-300 dark:text-gray-400',
    badgeColor: 'bg-gray-500',
  },
}

function presentation(key, status) {
  return {
    id: status?.id ?? null,
    name: status?.name || key,
    ...ENROLLMENT_UI[key],
  }
}

/**
 * Etiqueta pública de la landing.
 * Si el curso ya tiene un estado de cursada, se respeta.
 * Si sigue en activo, se infiere con la fecha de fin y las vacantes.
 */
export function resolveEnrollmentStatus({ status, availableQuota, quota, endDate }) {
  const name = String(status?.name || '').toLowerCase()

  if (ENROLLMENT_UI[name]) return presentation(name, status)
  if (name === 'egresado') return presentation('curso_finalizado', status)
  if (name === 'inactivo' || name === 'pendiente') return null

  const end = endDate ? new Date(endDate) : null
  if (end && !Number.isNaN(end.getTime()) && end.getTime() < Date.now()) {
    return presentation('curso_finalizado', status)
  }
  if (quota > 0 && availableQuota <= 0) return presentation('cupo_completo', status)
  if (quota > 0 && availableQuota <= 3) return presentation('ultimos_cupos', status)
  return presentation('inscripcion_abierta', status)
}
