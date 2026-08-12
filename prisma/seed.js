import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'

const adapter = new PrismaBetterSqlite3({
  url: 'file:./database.db'
})
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('Poblando base de datos...')

  // Aulas
  const classroomsData = [
    { capacity: 45, name: 'aula 1' },
    { capacity: 20, name: 'aula digital' },
    { capacity: 30, name: 'aula 3' },
    { capacity: 45, name: 'aula 4' },
    { capacity: 20, name: 'aula 5' },
    { capacity: 100, name: 'aula magna' }
  ]

  for (const data of classroomsData) {
    const exists = await prisma.classroom.findFirst({
      where: { name: data.name }
    })
    if (!exists) {
      await prisma.classroom.create({ data })
      console.log(`Aula creada: ${data.name}`)
    } else {
      console.log(`Aula ya existe: ${data.name}`)
    }
  }

  // Códigos de asistencia
  const attendanceCodesData = [
    'presente',
    'tarde',
    'media falta',
    'ausente',
    'justificado',
    'feriado'
  ]

  for (const name of attendanceCodesData) {
    const exists = await prisma.attendanceCode.findFirst({
      where: { name }
    })
    if (!exists) {
      await prisma.attendanceCode.create({
        data: { name }
      })
      console.log(`Código de asistencia creado: ${name}`)
    } else {
      console.log(`Código de asistencia ya existe: ${name}`)
    }
  }

  console.log('Poblado completo exitosamente.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
