import 'dotenv/config'
import prisma from '../src/lib/prisma.js'
import { hashPassword } from '../src/lib/password.js'
import { assignApplicantNumber } from '../src/lib/enrollment.js'

const MOCK_POSTULANTES = [
  { firstName: 'Mateo', lastName: 'Benítez', email: 'mateo.benitez@test.cfl404.ar', dni: '45100001' },
  { firstName: 'Camila', lastName: 'Navarro', email: 'camila.navarro@test.cfl404.ar', dni: '45100002' },
  { firstName: 'Joaquín', lastName: 'Herrera', email: 'joaquin.herrera@test.cfl404.ar', dni: '45100003' },
  { firstName: 'Lucía', lastName: 'Castro', email: 'lucia.castro@test.cfl404.ar', dni: '45100004' },
  { firstName: 'Valentín', lastName: 'Romero', email: 'valentin.romero@test.cfl404.ar', dni: '45100005' },
  { firstName: 'Martina', lastName: 'Vega', email: 'martina.vega@test.cfl404.ar', dni: '45100006' },
  { firstName: 'Ignacio', lastName: 'Molina', email: 'ignacio.molina@test.cfl404.ar', dni: '45100007' },
  { firstName: 'Sofía', lastName: 'Acosta', email: 'sofia.acosta@test.cfl404.ar', dni: '45100008' },
]

const DEFAULT_PASSWORD = 'Smoke404!'

async function createPostulantes() {
  console.log('🚀 Creando 8 postulantes para smoke test...')

  const passwordHash = await hashPassword(DEFAULT_PASSWORD)

  // Rol postulante = 9, Status pendiente = 3
  const rolePostulante = await prisma.role.findFirst({ where: { name: 'postulante' } })
  const statusPendiente = await prisma.status.findFirst({ where: { name: 'pendiente' } })

  const roleId = rolePostulante ? rolePostulante.id : 9
  const statusId = statusPendiente ? statusPendiente.id : 3

  for (const item of MOCK_POSTULANTES) {
    let user = await prisma.user.findFirst({
      where: { OR: [{ email: item.email }, { dni: item.dni }] }
    })

    if (!user) {
      user = await prisma.user.create({
        data: {
          firstName: item.firstName,
          lastName: item.lastName,
          email: item.email,
          dni: item.dni,
          passwordHash,
          roleId,
          statusId,
          acceptedTerms: true,
          userDetail: {
            create: {
              phone: '221-555-' + item.dni.slice(-4),
              address: 'Calle Falsa 123, Berisso',
              academicLevel: 'Secundario Completo',
              gender: 'No especificado',
              nacionality: 'Argentina',
            }
          }
        }
      })
      await assignApplicantNumber(user.id)
      console.log(`✅ Creado: ${item.firstName} ${item.lastName} (DNI: ${item.dni})`)
    } else {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          roleId,
          statusId,
          acceptedTerms: true
        }
      })
      console.log(`ℹ️ Actualizado: ${item.firstName} ${item.lastName} (DNI: ${item.dni})`)
    }
  }

  console.log('✨ Listo.')
}

createPostulantes()
  .catch((e) => {
    console.error('❌ Error creando postulantes:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
