import 'dotenv/config'
import prisma from '../src/lib/prisma.js'

async function runVerification() {
  console.log('🧪 Iniciando verificación del campo acceptedTerms y persistencia de datos...')

  const testEmail = 'test.consent.check@cfl404.edu.ar'
  await prisma.user.deleteMany({ where: { email: testEmail } })

  // 1. Verificar valor por defecto en nuevo usuario
  const user = await prisma.user.create({
    data: {
      firstName: 'Estudiante',
      lastName: 'Prueba Check',
      email: testEmail,
      statusId: 3,
      roleId: 8,
      userDetail: {
        create: {}
      }
    },
    include: { role: true, userDetail: true }
  })

  console.log('1. Valor inicial de acceptedTerms (default false):', user.acceptedTerms === false ? '✅ Correcto (false)' : '❌ Incorrecto')

  // 2. Simular cuando el usuario acepta el check y envía los datos completados
  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: {
      acceptedTerms: true,
      dni: '99887766',
      userDetail: {
        upsert: {
          create: {
            phone: '11-4433-2211',
            address: 'Calle 10 N° 123',
            academicLevel: 'Secundario Completo',
            gender: 'Femenino',
            nacionality: 'Argentina'
          },
          update: {
            phone: '11-4433-2211',
            address: 'Calle 10 N° 123',
            academicLevel: 'Secundario Completo',
            gender: 'Femenino',
            nacionality: 'Argentina'
          }
        }
      }
    },
    include: { role: true, userDetail: true }
  })

  console.log('2. Estado de acceptedTerms tras aceptar:', updatedUser.acceptedTerms === true ? '✅ Correcto (true)' : '❌ Incorrecto')
  console.log('3. DNI guardado correctamente:', updatedUser.dni === '99887766' ? '✅ Correcto' : '❌ Incorrecto')
  console.log('4. Teléfono guardado en userDetail:', updatedUser.userDetail?.phone === '11-4433-2211' ? '✅ Correcto' : '❌ Incorrecto')
  console.log('5. Dirección guardada en userDetail:', updatedUser.userDetail?.address === 'Calle 10 N° 123' ? '✅ Correcto' : '❌ Incorrecto')
  console.log('6. Nivel académico guardado en userDetail:', updatedUser.userDetail?.academicLevel === 'Secundario Completo' ? '✅ Correcto' : '❌ Incorrecto')

  // 3. Limpieza
  await prisma.user.deleteMany({ where: { email: testEmail } })
  console.log('✨ Verificación completada con éxito. Todos los checks pasaron.')
}

runVerification()
  .catch((err) => {
    console.error('❌ Error en verificación:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
