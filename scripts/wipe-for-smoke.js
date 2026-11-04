/**
 * wipe-for-smoke.js
 * -----------------
 * Borra la base SQLite y la recrea con SOLO los catálogos necesarios
 * para el funcionamiento primario + un único usuario GOD.
 *
 * Uso:  node scripts/wipe-for-smoke.js
 */

import 'dotenv/config'
import { execSync } from 'node:child_process'
import prisma from '../src/lib/prisma.js'
import {
  DEFAULT_ACERCA,
  DEFAULT_AYUDA,
  DEFAULT_BENEFICIOS,
  DEFAULT_CONTACTO,
  DEFAULT_COOPERADORA,
  MOBILE_SETTING_KEYS,
} from '../src/lib/mobile-content.js'
import { hashPassword } from '../src/lib/password.js'

// ── 1. Recrear las tablas ──────────────────────────────────────────────
console.log('🗑️  Eliminando y recreando tablas con prisma db push --force-reset …')
execSync('npx prisma db push --force-reset --accept-data-loss', {
  cwd: process.cwd(),
  stdio: 'inherit',
  env: {
    ...process.env,
    PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION: 'wippea la db, elimina los usuarios, deja solo alejoezequiel9999@gmail.com',
  },
})

// ── 2. Catálogos base ──────────────────────────────────────────────────
async function main() {
  console.log('\n🌱 Poblando catálogos mínimos para smoke test …')

  // Roles
  const roles = [
    { id: 1, name: 'god' },
    { id: 2, name: 'admin' },
    { id: 3, name: 'director' },
    { id: 4, name: 'regente' },
    { id: 5, name: 'secretaria' },
    { id: 6, name: 'preceptoria' },
    { id: 7, name: 'instructor' },
    { id: 8, name: 'alumno' },
    { id: 9, name: 'postulante' },
    { id: 10, name: 'contralor' },
  ]
  for (const r of roles) {
    await prisma.role.create({ data: r })
  }
  console.log('✅ Roles')

  // Statuses
  const statuses = [
    { id: 1, name: 'activo' },
    { id: 2, name: 'inactivo' },
    { id: 3, name: 'pendiente' },
    { id: 4, name: 'egresado' },
    { id: 5, name: 'suspendido' },
    { id: 6, name: 'bloqueado' },
    { id: 7, name: 'eliminado' },
    { id: 8, name: 'inscripcion_abierta' },
    { id: 9, name: 'ultimos_cupos' },
    { id: 10, name: 'cupo_completo' },
    { id: 11, name: 'curso_finalizado' },
  ]
  for (const s of statuses) {
    await prisma.status.create({ data: s })
  }
  console.log('✅ Estados')

  // Días
  const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
  for (const name of days) {
    await prisma.day.create({ data: { name } })
  }
  console.log('✅ Días')

  // Códigos de asistencia
  const codes = ['presente', 'tarde', 'media falta', 'ausente', 'justificado', 'feriado']
  for (const name of codes) {
    await prisma.attendanceCode.create({ data: { name } })
  }
  console.log('✅ Códigos de asistencia')

  // Familias
  const families = ['Oficios', 'Tecnología', 'Emprendimiento', 'Servicios', 'Administración', 'Construcción', 'Educación']
  for (const name of families) {
    await prisma.family.create({ data: { name } })
  }
  console.log('✅ Familias')

  // Aulas
  const classrooms = [
    { capacity: 45, name: 'aula 1' },
    { capacity: 20, name: 'aula digital' },
    { capacity: 30, name: 'aula 3' },
    { capacity: 45, name: 'aula 4' },
    { capacity: 20, name: 'aula 5' },
    { capacity: 100, name: 'aula magna' },
  ]
  for (const c of classrooms) {
    await prisma.classroom.create({ data: c })
  }
  console.log('✅ Aulas')

  // KPIs institucionales
  const kpis = [
    { key: 'kpi_1', name: 'Cursos dictados', value: '50+', description: 'Especialidades con amplia salida laboral y formación práctica profesional.' },
    { key: 'kpi_2', name: 'Alumnos egresados', value: '3500+', description: 'Vecinos y vecinas que se insertaron exitosamente en el mercado laboral.' },
    { key: 'kpi_3', name: 'Años de trayectoria', value: '10+', description: 'Brindando educación pública y gratuita en Berisso y la región.' },
    { key: 'kpi_4', name: 'Convenios locales', value: '15+', description: 'Acuerdos y beneficios con el sector comercial y productivo para nuestros estudiantes.' },
  ]
  for (const kpi of kpis) {
    await prisma.setting.create({ data: kpi })
  }
  console.log('✅ KPIs')

  // Settings de la app mobile
  const mobileSettings = [
    { key: MOBILE_SETTING_KEYS.beneficios, name: 'Beneficios de la app', description: 'Comercios adheridos que ve el alumno', value: JSON.stringify(DEFAULT_BENEFICIOS) },
    { key: MOBILE_SETTING_KEYS.contacto, name: 'Contacto institucional', description: 'Canales oficiales de la app', value: JSON.stringify(DEFAULT_CONTACTO) },
    { key: MOBILE_SETTING_KEYS.ayuda, name: 'Ayuda de la app', description: 'Guías para el alumno', value: JSON.stringify(DEFAULT_AYUDA) },
    { key: MOBILE_SETTING_KEYS.cooperadora, name: 'Datos de la cooperadora', description: 'Alias, CBU y cuota de referencia', value: JSON.stringify(DEFAULT_COOPERADORA) },
    { key: MOBILE_SETTING_KEYS.acerca, name: 'Acerca de la app', description: 'Descripción, creadores, soporte y enlaces de calificación', value: JSON.stringify(DEFAULT_ACERCA) },
  ]
  for (const item of mobileSettings) {
    await prisma.setting.create({ data: item })
  }
  console.log('✅ Settings mobile')

  // ── 3. Único usuario: GOD ────────────────────────────────────────────
  await prisma.user.create({
    data: {
      firstName: 'Alejo',
      lastName: 'GOD',
      email: 'alejoezequiel9999@gmail.com',
      dni: '99999999',
      passwordHash: await hashPassword('God404!x'),
      statusId: 1,  // activo
      roleId: 1,     // god
      acceptedTerms: true,
    },
  })
  console.log('✅ Usuario GOD creado: alejoezequiel9999@gmail.com  |  DNI: 99999999  |  Pass: God404!x')

  console.log('\n✨ Base de datos lista para smoke test. 0 cursos, 0 alumnos, 0 data transaccional.')
}

main()
  .catch((e) => {
    console.error('❌ Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
