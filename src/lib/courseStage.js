/**
 * Etapas lectivas del CFL 404, derivadas de las fechas del curso.
 * Primera etapa: marzo (3) – julio (7)
 * Segunda etapa: julio (7) – diciembre (12)
 * Julio se desambigua con la fecha de fin. Los anuales aparecen en ambas.
 */

export const COURSE_STAGES = {
  primera: {
    key: 'primera',
    label: 'Primera Etapa (Marzo - Julio)',
    short: 'Marzo - Julio',
  },
  segunda: {
    key: 'segunda',
    label: 'Segunda Etapa (Julio - Diciembre)',
    short: 'Julio - Diciembre',
  },
  anual: {
    key: 'anual',
    label: 'Anual / Dictado Continuo',
    short: 'Anual',
  },
}

function monthOf(value) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.getMonth() + 1
}

export function getCourseStageFromDates({ startDate, endDate, isAnnual } = {}) {
  if (isAnnual) return COURSE_STAGES.anual

  const startMonth = monthOf(startDate)
  const endMonth = monthOf(endDate)

  if (!startMonth) return null

  if (startMonth >= 3 && startMonth <= 6) return COURSE_STAGES.primera

  if (startMonth === 7) {
    if (endMonth && endMonth <= 7) return COURSE_STAGES.primera
    return COURSE_STAGES.segunda
  }

  if (startMonth >= 8 && startMonth <= 12) return COURSE_STAGES.segunda

  return null
}

export function courseMatchesStage(course, filterStage) {
  if (!filterStage) return true
  const stage = getCourseStageFromDates(course)
  const isAnnual = Boolean(course.isAnnual || course.is_annual || stage?.key === 'anual')
  if (filterStage === 'anual') return isAnnual
  if (filterStage === 'primera') return isAnnual || stage?.key === 'primera'
  if (filterStage === 'segunda') return isAnnual || stage?.key === 'segunda'
  return true
}

export function validateCourseStageDates({ startDate, endDate, isAnnual }) {
  if (!startDate) return 'La fecha de inicio es obligatoria'
  if (!endDate) return 'La fecha de fin es obligatoria'

  const start = new Date(startDate)
  const end = new Date(endDate)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 'Las fechas del curso no son válidas'
  }
  if (end < start) return 'La fecha de fin debe ser posterior a la de inicio'

  const startMonth = start.getMonth() + 1
  const endMonth = end.getMonth() + 1

  if (startMonth < 3) {
    return 'La cursada inicia en marzo. Usá una fecha de inicio entre marzo y diciembre.'
  }

  const spansBothStages = startMonth <= 6 && endMonth >= 8

  if (isAnnual) {
    if (startMonth < 3 || startMonth > 7) {
      return 'Un curso anual debe iniciar en la primera etapa (marzo a julio).'
    }
    if (endMonth < 7 || endMonth > 12) {
      return 'Un curso anual debe finalizar en la segunda etapa (julio a diciembre).'
    }
    return null
  }

  if (spansBothStages) {
    return 'Las fechas cubren ambas etapas. Marcá el curso como anual o ajustá el período a una sola etapa.'
  }

  const inPrimera = startMonth >= 3 && startMonth <= 7 && endMonth >= 3 && endMonth <= 7
  const inSegunda = startMonth >= 7 && startMonth <= 12 && endMonth >= 7 && endMonth <= 12

  if (inPrimera || inSegunda) return null

  return 'Las fechas deben estar en la primera etapa (marzo-julio) o en la segunda (julio-diciembre).'
}

export function formatCourseSchedule({ startTime, endTime, courseDays } = {}) {
  const dayNames = (courseDays || [])
    .map((item) => item.day?.name || item.name)
    .filter(Boolean)

  let daysLabel = ''
  if (dayNames.length === 1) {
    daysLabel = dayNames[0]
  } else if (dayNames.length === 2) {
    daysLabel = `${dayNames[0]} y ${dayNames[1]}`
  } else if (dayNames.length > 2) {
    daysLabel = `${dayNames.slice(0, -1).join(', ')} y ${dayNames[dayNames.length - 1]}`
  }

  const timeLabel = [startTime, endTime].filter(Boolean).join(' - ')
  if (daysLabel && timeLabel) return `${daysLabel} ${timeLabel}`
  if (daysLabel) return daysLabel
  if (timeLabel) return timeLabel
  return 'Horario a confirmar'
}
