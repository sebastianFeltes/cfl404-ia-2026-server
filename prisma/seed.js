import 'dotenv/config'
import prisma from '../src/lib/prisma.js'

const MOCK_STUDENTS_SEED = [
  {
    first_name: 'Juan',
    last_name: 'Pérez',
    email: 'juan.perez@gmail.com',
    dni: '34567890',
    status_id: 1,
    phone: '11-4567-8901',
    address: 'Calle 12 N° 450, Berisso',
    academic_level: 'Secundario',
    course_name: 'Operador de PC',
    profile_photo_url: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80',
  },
  {
    first_name: 'María',
    last_name: 'González',
    email: 'maria.g@hotmail.com',
    dni: '36123456',
    status_id: 1,
    phone: '11-5555-1234',
    address: 'Av. Montevideo 1240, Berisso',
    academic_level: 'Terciario',
    course_name: 'Programador Web',
    profile_photo_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
  },
  {
    first_name: 'Carlos',
    last_name: 'Rodríguez',
    email: 'carlos.rod@yahoo.com',
    dni: '32987654',
    status_id: 2,
    phone: '11-9876-5432',
    address: 'Calle 8 N° 890, Ensenada',
    academic_level: 'Secundario',
    course_name: 'Electricista Matriculado',
    profile_photo_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  },
  {
    first_name: 'Ana',
    last_name: 'Martínez',
    email: 'ana.mtz@gmail.com',
    dni: '40111222',
    status_id: 1,
    phone: '11-2222-3333',
    address: 'Calle 168 y 18, Berisso',
    academic_level: 'Universitario',
    course_name: 'Diseño Gráfico Digital',
    profile_photo_url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
  },
  {
    first_name: 'Luis',
    last_name: 'Fernández',
    email: 'luis.fer@outlook.com',
    dni: '38444555',
    status_id: 3,
    phone: '11-3333-4444',
    address: 'Calle 25 N° 340, La Plata',
    academic_level: 'Secundario',
    course_name: 'Operador de PC',
    profile_photo_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
  },
  {
    first_name: 'Laura',
    last_name: 'Gómez',
    email: 'laura.g@gmail.com',
    dni: '42666777',
    status_id: 3,
    phone: '11-6666-7777',
    address: 'Calle 60 N° 110, Berisso',
    academic_level: 'Terciario',
    course_name: 'Programador Web',
    profile_photo_url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
  },
  {
    first_name: 'Miguel',
    last_name: 'Sánchez',
    email: 'miguel.s@gmail.com',
    dni: '30888999',
    status_id: 2,
    phone: '11-7777-8888',
    address: 'Calle 13 N° 612, Berisso',
    academic_level: 'Universitario',
    course_name: 'Electricista Matriculado',
    profile_photo_url: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150&auto=format&fit=crop&q=80',
  },
  {
    first_name: 'Sofía',
    last_name: 'Díaz',
    email: 'sofia.diaz@gmail.com',
    dni: '45000111',
    status_id: 3,
    phone: '11-8888-9999',
    address: 'Calle 157 N° 920, Berisso',
    academic_level: 'Secundario',
    course_name: 'Diseño Gráfico Digital',
    profile_photo_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  },
  {
    first_name: 'Esteban',
    last_name: 'Quito',
    email: 'esteban.q@hotmail.com',
    dni: '39222333',
    status_id: 1,
    phone: '11-4444-5555',
    address: 'Av. del Petróleo 890, Berisso',
    academic_level: 'Terciario',
    course_name: 'Operador de PC',
    profile_photo_url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80',
  },
  {
    first_name: 'Florencia',
    last_name: 'Morales',
    email: 'flor.morales@gmail.com',
    dni: '43789012',
    status_id: 3,
    phone: '11-9900-1122',
    address: 'Calle 22 N° 780, Berisso',
    academic_level: 'Secundario',
    course_name: 'Diseño Gráfico Digital',
    profile_photo_url: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80',
  }
]

// Convención unificada de roles para toda la plataforma (login, cursos, instructores y alumnos)
const ROLES = {
  ESTUDIANTE: 1,
  DOCENTE: 2,
  ADMIN: 3,
  DIRECTIVO: 4,
}

async function main() {
  console.log('🌱 Poblando base de datos CFL 404...')

  // 1. Roles
  const rolesData = [
    { id: ROLES.ESTUDIANTE, name: 'ESTUDIANTE' },
    { id: ROLES.DOCENTE, name: 'DOCENTE' },
    { id: ROLES.ADMIN, name: 'ADMIN' },
    { id: ROLES.DIRECTIVO, name: 'DIRECTIVO' },
  ]

  for (const role of rolesData) {
    const exists = await prisma.role.findUnique({ where: { id: role.id } })
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
    { capacity: 100, name: 'aula magna' },
  ]

  for (const data of classroomsData) {
    const exists = await prisma.classroom.findFirst({ where: { name: data.name } })
    if (!exists) {
      await prisma.classroom.create({ data })
      console.log(`✅ Aula creada: ${data.name}`)
    } else {
      console.log(`ℹ️ Aula ya existe: ${data.name}`)
    }
  }

  // 3. Códigos de asistencia
  const attendanceCodesData = ['presente', 'tarde', 'media falta', 'ausente', 'justificado', 'feriado']

  for (const name of attendanceCodesData) {
    const exists = await prisma.attendanceCode.findFirst({ where: { name } })
    if (!exists) {
      await prisma.attendanceCode.create({ data: { name } })
      console.log(`✅ Código de asistencia creado: ${name}`)
    } else {
      console.log(`ℹ️ Código de asistencia ya existe: ${name}`)
    }
  }

  // 4. Docente por defecto (dictará los cursos de la oferta formativa)
  let defaultStaff = await prisma.staff.findFirst({ where: { email: 'c.benitez@cfl404.edu.ar' } })
  if (!defaultStaff) {
    defaultStaff = await prisma.staff.create({
      data: {
        firstName: 'Carlos',
        lastName: 'Benítez',
        email: 'c.benitez@cfl404.edu.ar',
        dni: '20123456',
        statusId: 1,
        roleId: ROLES.DOCENTE,
      },
    })
    console.log(`✅ Docente por defecto creado: ${defaultStaff.firstName} ${defaultStaff.lastName}`)
  }

  // 5. Cursos de la oferta formativa
  const courseNames = ['Operador de PC', 'Programador Web', 'Electricista Matriculado', 'Diseño Gráfico Digital']

  const courseMap = {}
  for (const name of courseNames) {
    let course = await prisma.course.findFirst({ where: { name } })
    if (!course) {
      course = await prisma.course.create({
        data: {
          name,
          statusId: 1,
          staffId: defaultStaff.id,
          maxAbsences: 5,
        },
      })
      console.log(`✅ Curso creado: ${name}`)
    }
    courseMap[name] = course
  }

  // 6. Alumnos, detalles y asignación de curso
  for (const s of MOCK_STUDENTS_SEED) {
    let student = await prisma.student.findFirst({
      where: { OR: [{ dni: s.dni }, { email: s.email }] },
    })

    if (!student) {
      student = await prisma.student.create({
        data: {
          firstName: s.first_name,
          lastName: s.last_name,
          dni: s.dni,
          email: s.email,
          statusId: s.status_id,
          roleId: ROLES.ESTUDIANTE,
          profilePhotoUrl: s.profile_photo_url,
          studentDetail: {
            create: {
              phone: s.phone,
              address: s.address,
              academicLevel: s.academic_level,
              gender: 'No especificado',
              nacionality: 'Argentina',
              dniCopy: 'true',
              formCopy: 'true',
              titleCopy: 'true',
            },
          },
        },
      })
      console.log(`✅ Alumno creado: ${s.first_name} ${s.last_name}`)
    }

    // Vincular curso al alumno
    const targetCourse = courseMap[s.course_name]
    if (targetCourse) {
      const alreadyEnrolled = await prisma.studentCourse.findFirst({
        where: { studentId: student.id, courseId: targetCourse.id },
      })
      if (!alreadyEnrolled) {
        await prisma.studentCourse.create({
          data: { studentId: student.id, courseId: targetCourse.id },
        })
        console.log(`✅ Curso "${s.course_name}" asignado a ${s.first_name} ${s.last_name}`)
      }
    }
  }

  // 7. Usuario de prueba: Estudiante (login)
  const studentEmail = 'alumno.test@cfl404.edu.ar'
  const studentExists = await prisma.student.findUnique({ where: { email: studentEmail } })
  if (!studentExists) {
    const student = await prisma.student.create({
      data: {
        firstName: 'Juan',
        lastName: 'Pérez',
        email: studentEmail,
        dni: '40123456',
        statusId: 1,
        roleId: ROLES.ESTUDIANTE,
        googleId: 'google-student-fallback-id',
        profilePhotoUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
        studentDetail: {
          create: {
            address: 'Calle 123 N° 456, Berisso',
            phone: '221-555-0101',
            academicLevel: 'Secundario Completo',
            gender: 'Masculino',
            nacionality: 'Argentina',
          },
        },
      },
    })
    console.log(`✅ Estudiante de prueba creado: ${student.firstName} ${student.lastName} (${student.email})`)
  } else {
    console.log(`ℹ️ Estudiante de prueba ya existe: ${studentEmail}`)
  }

  // 8. Usuario de prueba: Docente (login)
  const teacherEmail = 'docente.test@cfl404.edu.ar'
  const teacherExists = await prisma.staff.findUnique({ where: { email: teacherEmail } })
  if (!teacherExists) {
    const teacher = await prisma.staff.create({
      data: {
        firstName: 'María',
        lastName: 'González',
        email: teacherEmail,
        dni: '30987654',
        statusId: 1,
        roleId: ROLES.DOCENTE,
        googleId: 'google-docente-fallback-id',
        profilePhotoUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
        staffDetail: {
          create: {
            address: 'Av. Montevideo 789, Berisso',
            phone: '221-555-0202',
            gender: 'Femenino',
            nacionality: 'Argentina',
          },
        },
      },
    })
    console.log(`✅ Docente de prueba creado: ${teacher.firstName} ${teacher.lastName} (${teacher.email})`)
  } else {
    console.log(`ℹ️ Docente de prueba ya existe: ${teacherEmail}`)
  }

  // 9. Usuario de prueba: Administrador (login)
  const adminEmail = 'admin.test@cfl404.edu.ar'
  const adminExists = await prisma.staff.findUnique({ where: { email: adminEmail } })
  if (!adminExists) {
    const admin = await prisma.staff.create({
      data: {
        firstName: 'Admin',
        lastName: 'CFL404',
        email: adminEmail,
        dni: '20111222',
        statusId: 1,
        roleId: ROLES.ADMIN,
        googleId: 'google-admin-fallback-id',
        profilePhotoUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
        staffDetail: {
          create: {
            address: 'Sede Central CFL 404, Berisso',
            phone: '221-555-0303',
            gender: 'Otro',
            nacionality: 'Argentina',
          },
        },
      },
    })
    console.log(`✅ Administrador de prueba creado: ${admin.firstName} ${admin.lastName} (${admin.email})`)
  } else {
    console.log(`ℹ️ Administrador de prueba ya existe: ${adminEmail}`)
  }

  // 10. Usuario de prueba: Directivo (login)
  const directorEmail = 'directivo.test@cfl404.edu.ar'
  const directorExists = await prisma.staff.findUnique({ where: { email: directorEmail } })
  if (!directorExists) {
    const director = await prisma.staff.create({
      data: {
        firstName: 'Silvina',
        lastName: 'Ibáñez',
        email: directorEmail,
        dni: '25333444',
        statusId: 1,
        roleId: ROLES.DIRECTIVO,
        googleId: 'google-directivo-fallback-id',
        profilePhotoUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150',
        staffDetail: {
          create: {
            address: 'Sede Central CFL 404, Berisso',
            phone: '221-555-0404',
            gender: 'Femenino',
            nacionality: 'Argentina',
          },
        },
      },
    })
    console.log(`✅ Directivo de prueba creado: ${director.firstName} ${director.lastName} (${director.email})`)
  } else {
    console.log(`ℹ️ Directivo de prueba ya existe: ${directorEmail}`)
  }

  console.log('✨ Base de datos poblada exitosamente.')
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
