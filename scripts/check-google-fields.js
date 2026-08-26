/**
 * Verificación puntual: la base debe poder registrar y releer un usuario
 * creado a partir de los claims que devuelve el ID token de Google
 * (sub, email, email_verified, given_name, family_name, picture, locale),
 * incluso cuando Google no aporta DNI.
 *
 * Uso: node scripts/check-google-fields.js
 */
import 'dotenv/config'
import prisma from '../src/lib/prisma.js'

const googlePayload = {
  sub: '110000000000000000001',
  email: 'prueba.google.check@gmail.com',
  email_verified: true,
  given_name: 'Prueba',
  family_name: 'Google',
  picture: 'https://lh3.googleusercontent.com/a/ejemplo=s96-c',
  locale: 'es-419',
}

async function main() {
  await prisma.student.deleteMany({ where: { email: googlePayload.email } })

  const creado = await prisma.student.create({
    data: {
      firstName: googlePayload.given_name,
      lastName: googlePayload.family_name,
      email: googlePayload.email,
      googleId: googlePayload.sub,
      emailVerified: googlePayload.email_verified,
      profilePhotoUrl: googlePayload.picture,
      locale: googlePayload.locale,
      lastLoginAt: new Date(),
      statusId: 3,
      roleId: 1,
      studentDetail: { create: {} },
    },
    include: { role: true, studentDetail: true },
  })

  const checks = [
    ['googleId  (claim sub)', creado.googleId === googlePayload.sub],
    ['email', creado.email === googlePayload.email],
    ['emailVerified', creado.emailVerified === true],
    ['firstName (given_name)', creado.firstName === googlePayload.given_name],
    ['lastName  (family_name)', creado.lastName === googlePayload.family_name],
    ['profilePhotoUrl (picture)', creado.profilePhotoUrl === googlePayload.picture],
    ['locale', creado.locale === googlePayload.locale],
    ['lastLoginAt', creado.lastLoginAt instanceof Date],
    ['dni nulo permitido', creado.dni === null],
    ['rol asignado', creado.role.name === 'ESTUDIANTE'],
    ['estado pendiente', creado.statusId === 3],
    ['detalle vinculado', Boolean(creado.studentDetail)],
  ]

  for (const [campo, ok] of checks) {
    console.log(`${ok ? '✅' : '❌'} ${campo}`)
  }

  // El googleId debe ser único: un segundo usuario no puede reclamar el mismo sub.
  try {
    await prisma.student.create({
      data: {
        firstName: 'Suplantador',
        lastName: 'Test',
        email: 'otro.distinto@gmail.com',
        googleId: googlePayload.sub,
        statusId: 3,
        roleId: 1,
      },
    })
    console.log('❌ googleId duplicado fue aceptado')
  } catch (error) {
    console.log(`${error.code === 'P2002' ? '✅' : '❌'} googleId duplicado rechazado (${error.code})`)
  }

  // Dos cuentas sin DNI deben poder coexistir pese al índice único.
  try {
    await prisma.student.deleteMany({ where: { email: 'segundo.sin.dni@gmail.com' } })
    await prisma.student.create({
      data: {
        firstName: 'Segundo',
        lastName: 'SinDni',
        email: 'segundo.sin.dni@gmail.com',
        googleId: '110000000000000000002',
        statusId: 3,
        roleId: 1,
      },
    })
    console.log('✅ dos usuarios sin DNI coexisten')
    await prisma.student.deleteMany({ where: { email: 'segundo.sin.dni@gmail.com' } })
  } catch (error) {
    console.log(`❌ conflicto entre usuarios sin DNI: ${error.code}`)
  }

  await prisma.student.deleteMany({ where: { email: googlePayload.email } })
  console.log('\n🧹 Registros de prueba eliminados.')
}

main()
  .catch((e) => {
    console.error('❌ Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
