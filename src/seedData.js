// Archivo: src/seedData.js
import prisma from './lib/prisma.js'

export const MOCK_STUDENTS_SEED = [
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

export async function autoSeedDatabase() {
  try {
    // 1. Asegurar roles
    const roles = ['Director', 'Secretaría', 'Instructor', 'Alumno', 'Aspirante']
    for (const name of roles) {
      const exists = await prisma.role.findFirst({ where: { name } })
      if (!exists) {
        await prisma.role.create({ data: { name } }).catch(() => null)
      }
    }

    const defaultRole = await prisma.role.findFirst({ where: { name: 'Alumno' } })
    const aspiranteRole = await prisma.role.findFirst({ where: { name: 'Aspirante' } })

    if (!defaultRole) return

    // 2. Poblar estudiantes si hay menos de 5
    const count = await prisma.student.count()
    if (count < 5) {
      console.log('Inicializando nómina inicial de alumnos en SQLite...')
      for (const s of MOCK_STUDENTS_SEED) {
        const exists = await prisma.student.findFirst({
          where: { OR: [{ dni: s.dni }, { email: s.email }] }
        })

        if (!exists) {
          const isAspirante = s.status_id === 3
          const roleId = isAspirante && aspiranteRole ? aspiranteRole.id : defaultRole.id

          await prisma.student.create({
            data: {
              firstName: s.first_name,
              lastName: s.last_name,
              dni: s.dni,
              email: s.email,
              statusId: s.status_id,
              roleId,
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
                }
              }
            }
          }).catch((err) => console.log('Notice seed item:', err.message))
        }
      }
      console.log('Nómina inicial de alumnos sincronizada con éxito.')
    }
  } catch (error) {
    console.error('Error al inicializar datos:', error.message)
  }
}
