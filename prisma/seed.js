import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'

const adapter = new PrismaBetterSqlite3({
  url: 'file:./database.db'
})
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('🌱 Poblando base de datos...')

  // 1. Roles
  const rolesData = [
    { id: 1, name: 'ESTUDIANTE' },
    { id: 2, name: 'DOCENTE' },
    { id: 3, name: 'ADMIN' },
    { id: 4, name: 'DIRECTIVO' }
  ]

  for (const role of rolesData) {
    const exists = await prisma.role.findUnique({
      where: { id: role.id }
    })
    if (!exists) {
      await prisma.role.create({ data: role })
      console.log(`✅ Rol creado: ${role.name}`)
    } else {
      console.log(`ℹ️ Rol ya existe: ${role.name}`)
    }
  }

  // 2. Aulas
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
      console.log(`✅ Aula creada: ${data.name}`)
    } else {
      console.log(`ℹ️ Aula ya existe: ${data.name}`)
    }
  }

  // 3. Códigos de asistencia
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
      console.log(`✅ Código de asistencia creado: ${name}`)
    } else {
      console.log(`ℹ️ Código de asistencia ya existe: ${name}`)
    }
  }

  // 4. Usuario de Prueba: Estudiante
  const studentEmail = 'alumno.test@cfl404.edu.ar'
  const studentExists = await prisma.student.findUnique({
    where: { email: studentEmail }
  })
  if (!studentExists) {
    const student = await prisma.student.create({
      data: {
        firstName: 'Juan',
        lastName: 'Pérez',
        email: studentEmail,
        dni: '40123456',
        statusId: 1,
        roleId: 1, // ESTUDIANTE
        googleId: 'google-student-fallback-id',
        profilePhotoUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
        studentDetail: {
          create: {
            address: 'Calle 123 N° 456, Berisso',
            phone: '221-555-0101',
            academicLevel: 'Secundario Completo',
            gender: 'Masculino',
            nacionality: 'Argentina'
          }
        }
      }
    })
    console.log(`✅ Estudiante de prueba creado: ${student.firstName} ${student.lastName} (${student.email})`)
  } else {
    console.log(`ℹ️ Estudiante de prueba ya existe: ${studentEmail}`)
  }

  // 5. Usuario de Prueba: Docente (Staff)
  const teacherEmail = 'docente.test@cfl404.edu.ar'
  const teacherExists = await prisma.staff.findUnique({
    where: { email: teacherEmail }
  })
  if (!teacherExists) {
    const teacher = await prisma.staff.create({
      data: {
        firstName: 'María',
        lastName: 'González',
        email: teacherEmail,
        dni: '30987654',
        statusId: 1,
        roleId: 2, // DOCENTE
        googleId: 'google-docente-fallback-id',
        profilePhotoUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
        staffDetail: {
          create: {
            address: 'Av. Montevideo 789, Berisso',
            phone: '221-555-0202',
            gender: 'Femenino',
            nacionality: 'Argentina'
          }
        }
      }
    })
    console.log(`✅ Docente de prueba creado: ${teacher.firstName} ${teacher.lastName} (${teacher.email})`)
  } else {
    console.log(`ℹ️ Docente de prueba ya existe: ${teacherEmail}`)
  }

  // 6. Usuario de Prueba: Administrador (Staff)
  const adminEmail = 'admin.test@cfl404.edu.ar'
  const adminExists = await prisma.staff.findUnique({
    where: { email: adminEmail }
  })
  if (!adminExists) {
    const admin = await prisma.staff.create({
      data: {
        firstName: 'Admin',
        lastName: 'CFL404',
        email: adminEmail,
        dni: '20111222',
        statusId: 1,
        roleId: 3, // ADMIN
        googleId: 'google-admin-fallback-id',
        profilePhotoUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
        staffDetail: {
          create: {
            address: 'Sede Central CFL 404, Berisso',
            phone: '221-555-0303',
            gender: 'Otro',
            nacionality: 'Argentina'
          }
        }
      }
    })
    console.log(`✅ Administrador de prueba creado: ${admin.firstName} ${admin.lastName} (${admin.email})`)
  } else {
    console.log(`ℹ️ Administrador de prueba ya existe: ${adminEmail}`)
  }

  console.log('✨ Base de datos poblada exitosamente con roles y usuarios de prueba.')
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
