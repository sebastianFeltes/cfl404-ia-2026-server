/**
 * seed-instructors.js
 * -------------------
 * Siembra 50 instructores de prueba en la base de datos CFL 404.
 * Idempotente: se puede ejecutar N veces sin duplicar registros (filtra por email y DNI).
 *
 * Uso: node prisma/seed-instructors.js
 */

import 'dotenv/config'
import prisma from '../src/lib/prisma.js'

const ROLES = { INSTRUCTOR: 7 }
const STATUSES = { ACTIVO: 1, INACTIVO: 2, LICENCIA: 3 }

// 50 instructores argentinos realistas con datos distribuidos
const MOCK_INSTRUCTORS = [
  { first_name: 'Alejandro',  last_name: 'Villanueva',   dni: '21100001', email: 'a.villanueva@cfl404.edu.ar',  phone: '221-411-0001', address: 'Calle 1 N 100, Berisso',       status_id: 1, photo: 'https://randomuser.me/api/portraits/men/1.jpg'   },
  { first_name: 'Beatriz',    last_name: 'Romero',        dni: '24100002', email: 'b.romero@cfl404.edu.ar',      phone: '221-411-0002', address: 'Calle 2 N 200, Berisso',       status_id: 1, photo: 'https://randomuser.me/api/portraits/women/2.jpg' },
  { first_name: 'Claudio',    last_name: 'Herrera',       dni: '27100003', email: 'c.herrera@cfl404.edu.ar',    phone: '221-411-0003', address: 'Calle 3 N 300, Ensenada',      status_id: 1, photo: 'https://randomuser.me/api/portraits/men/3.jpg'   },
  { first_name: 'Daniela',    last_name: 'Castro',        dni: '30100004', email: 'd.castro@cfl404.edu.ar',     phone: '221-411-0004', address: 'Av. Montevideo 400, Berisso',   status_id: 2, photo: 'https://randomuser.me/api/portraits/women/4.jpg' },
  { first_name: 'Ernesto',    last_name: 'Medina',        dni: '22100005', email: 'e.medina@cfl404.edu.ar',     phone: '221-411-0005', address: 'Calle 5 N 500, La Plata',      status_id: 1, photo: 'https://randomuser.me/api/portraits/men/5.jpg'   },
  { first_name: 'Fernanda',   last_name: 'Torres',        dni: '25100006', email: 'f.torres@cfl404.edu.ar',     phone: '221-411-0006', address: 'Calle 6 N 600, Berisso',       status_id: 3, photo: 'https://randomuser.me/api/portraits/women/6.jpg' },
  { first_name: 'Gustavo',    last_name: 'Acosta',        dni: '28100007', email: 'g.acosta@cfl404.edu.ar',     phone: '221-411-0007', address: 'Calle 7 N 700, Berisso',       status_id: 1, photo: 'https://randomuser.me/api/portraits/men/7.jpg'   },
  { first_name: 'Hector',     last_name: 'Delgado',       dni: '31100008', email: 'h.delgado@cfl404.edu.ar',   phone: '221-411-0008', address: 'Calle 8 N 800, Ensenada',      status_id: 1, photo: 'https://randomuser.me/api/portraits/men/8.jpg'   },
  { first_name: 'Irene',      last_name: 'Navarro',       dni: '23100009', email: 'i.navarro@cfl404.edu.ar',   phone: '221-411-0009', address: 'Av. del Petroleo 900, Berisso', status_id: 2, photo: 'https://randomuser.me/api/portraits/women/9.jpg' },
  { first_name: 'Jorge',      last_name: 'Molina',        dni: '26100010', email: 'j.molina@cfl404.edu.ar',    phone: '221-411-0010', address: 'Calle 10 N 100, La Plata',     status_id: 1, photo: 'https://randomuser.me/api/portraits/men/10.jpg'  },
  { first_name: 'Karina',     last_name: 'Ruiz',          dni: '29100011', email: 'k.ruiz@cfl404.edu.ar',      phone: '221-411-0011', address: 'Calle 11 N 111, Berisso',      status_id: 1, photo: 'https://randomuser.me/api/portraits/women/11.jpg'},
  { first_name: 'Leonardo',   last_name: 'Jimenez',       dni: '32100012', email: 'l.jimenez@cfl404.edu.ar',   phone: '221-411-0012', address: 'Calle 12 N 120, Berisso',      status_id: 3, photo: 'https://randomuser.me/api/portraits/men/12.jpg'  },
  { first_name: 'Marcela',    last_name: 'Alvarez',       dni: '21200013', email: 'm.alvarez@cfl404.edu.ar',   phone: '221-411-0013', address: 'Calle 13 N 130, Ensenada',     status_id: 1, photo: 'https://randomuser.me/api/portraits/women/13.jpg'},
  { first_name: 'Nicolas',    last_name: 'Vega',          dni: '24200014', email: 'n.vega@cfl404.edu.ar',      phone: '221-411-0014', address: 'Calle 14 N 140, Berisso',      status_id: 1, photo: 'https://randomuser.me/api/portraits/men/14.jpg'  },
  { first_name: 'Olga',       last_name: 'Mendez',        dni: '27200015', email: 'o.mendez@cfl404.edu.ar',    phone: '221-411-0015', address: 'Av. Montevideo 150, Berisso',   status_id: 2, photo: 'https://randomuser.me/api/portraits/women/15.jpg'},
  { first_name: 'Pablo',      last_name: 'Guerrero',      dni: '30200016', email: 'p.guerrero@cfl404.edu.ar',  phone: '221-411-0016', address: 'Calle 16 N 160, La Plata',     status_id: 1, photo: 'https://randomuser.me/api/portraits/men/16.jpg'  },
  { first_name: 'Quintina',   last_name: 'Ortiz',         dni: '22200017', email: 'q.ortiz@cfl404.edu.ar',     phone: '221-411-0017', address: 'Calle 17 N 170, Berisso',      status_id: 1, photo: 'https://randomuser.me/api/portraits/women/17.jpg'},
  { first_name: 'Roberto',    last_name: 'Aguilar',       dni: '25200018', email: 'r.aguilar@cfl404.edu.ar',   phone: '221-411-0018', address: 'Calle 18 N 180, Ensenada',     status_id: 3, photo: 'https://randomuser.me/api/portraits/men/18.jpg'  },
  { first_name: 'Silvana',    last_name: 'Moreno',        dni: '28200019', email: 's.moreno@cfl404.edu.ar',    phone: '221-411-0019', address: 'Calle 19 N 190, Berisso',      status_id: 1, photo: 'https://randomuser.me/api/portraits/women/19.jpg'},
  { first_name: 'Tomas',      last_name: 'Contreras',     dni: '31200020', email: 't.contreras@cfl404.edu.ar', phone: '221-411-0020', address: 'Calle 20 N 200, La Plata',     status_id: 1, photo: 'https://randomuser.me/api/portraits/men/20.jpg'  },
  { first_name: 'Ursula',     last_name: 'Reyes',         dni: '23200021', email: 'u.reyes@cfl404.edu.ar',     phone: '221-411-0021', address: 'Calle 21 N 210, Berisso',      status_id: 2, photo: 'https://randomuser.me/api/portraits/women/21.jpg'},
  { first_name: 'Valentin',   last_name: 'Flores',        dni: '26200022', email: 'v.flores@cfl404.edu.ar',    phone: '221-411-0022', address: 'Av. del Petroleo 220, Berisso', status_id: 1, photo: 'https://randomuser.me/api/portraits/men/22.jpg'  },
  { first_name: 'Wendy',      last_name: 'Cruz',          dni: '29200023', email: 'w.cruz@cfl404.edu.ar',      phone: '221-411-0023', address: 'Calle 23 N 230, Ensenada',     status_id: 1, photo: 'https://randomuser.me/api/portraits/women/23.jpg'},
  { first_name: 'Xavier',     last_name: 'Vargas',        dni: '32200024', email: 'x.vargas@cfl404.edu.ar',    phone: '221-411-0024', address: 'Calle 24 N 240, Berisso',      status_id: 3, photo: 'https://randomuser.me/api/portraits/men/24.jpg'  },
  { first_name: 'Yamila',     last_name: 'Ramos',         dni: '21300025', email: 'y.ramos@cfl404.edu.ar',     phone: '221-411-0025', address: 'Calle 25 N 250, La Plata',     status_id: 1, photo: 'https://randomuser.me/api/portraits/women/25.jpg'},
  { first_name: 'Zacarias',   last_name: 'Pena',          dni: '24300026', email: 'z.pena@cfl404.edu.ar',      phone: '221-411-0026', address: 'Calle 26 N 260, Berisso',      status_id: 1, photo: 'https://randomuser.me/api/portraits/men/26.jpg'  },
  { first_name: 'Adriana',    last_name: 'Luna',          dni: '27300027', email: 'a.luna@cfl404.edu.ar',      phone: '221-411-0027', address: 'Calle 27 N 270, Berisso',      status_id: 2, photo: 'https://randomuser.me/api/portraits/women/27.jpg'},
  { first_name: 'Bernardo',   last_name: 'Fuentes',       dni: '30300028', email: 'b.fuentes@cfl404.edu.ar',   phone: '221-411-0028', address: 'Calle 28 N 280, Ensenada',     status_id: 1, photo: 'https://randomuser.me/api/portraits/men/28.jpg'  },
  { first_name: 'Carolina',   last_name: 'Salazar',       dni: '22300029', email: 'c.salazar@cfl404.edu.ar',   phone: '221-411-0029', address: 'Av. Montevideo 290, Berisso',   status_id: 1, photo: 'https://randomuser.me/api/portraits/women/29.jpg'},
  { first_name: 'Diego',      last_name: 'Mendoza',       dni: '25300030', email: 'd.mendoza@cfl404.edu.ar',   phone: '221-411-0030', address: 'Calle 30 N 300, La Plata',     status_id: 3, photo: 'https://randomuser.me/api/portraits/men/30.jpg'  },
  { first_name: 'Elena',      last_name: 'Gutierrez',     dni: '28300031', email: 'e.gutierrez@cfl404.edu.ar', phone: '221-411-0031', address: 'Calle 31 N 310, Berisso',      status_id: 1, photo: 'https://randomuser.me/api/portraits/women/31.jpg'},
  { first_name: 'Federico',   last_name: 'Soto',          dni: '31300032', email: 'f.soto@cfl404.edu.ar',      phone: '221-411-0032', address: 'Calle 32 N 320, Berisso',      status_id: 1, photo: 'https://randomuser.me/api/portraits/men/32.jpg'  },
  { first_name: 'Gabriela',   last_name: 'Ibanez',        dni: '23300033', email: 'g.ibanez@cfl404.edu.ar',    phone: '221-411-0033', address: 'Calle 33 N 330, Ensenada',     status_id: 2, photo: 'https://randomuser.me/api/portraits/women/33.jpg'},
  { first_name: 'Horacio',    last_name: 'Mora',          dni: '26300034', email: 'h.mora@cfl404.edu.ar',      phone: '221-411-0034', address: 'Calle 34 N 340, Berisso',      status_id: 1, photo: 'https://randomuser.me/api/portraits/men/34.jpg'  },
  { first_name: 'Ines',       last_name: 'Paredes',       dni: '29300035', email: 'i.paredes@cfl404.edu.ar',   phone: '221-411-0035', address: 'Calle 35 N 350, La Plata',     status_id: 1, photo: 'https://randomuser.me/api/portraits/women/35.jpg'},
  { first_name: 'Javier',     last_name: 'Cardenas',      dni: '32300036', email: 'j.cardenas@cfl404.edu.ar',  phone: '221-411-0036', address: 'Av. del Petroleo 360, Berisso', status_id: 3, photo: 'https://randomuser.me/api/portraits/men/36.jpg'  },
  { first_name: 'Karen',      last_name: 'Pizarro',       dni: '21400037', email: 'k.pizarro@cfl404.edu.ar',   phone: '221-411-0037', address: 'Calle 37 N 370, Berisso',      status_id: 1, photo: 'https://randomuser.me/api/portraits/women/37.jpg'},
  { first_name: 'Lorenzo',    last_name: 'Saavedra',      dni: '24400038', email: 'l.saavedra@cfl404.edu.ar',  phone: '221-411-0038', address: 'Calle 38 N 380, Ensenada',     status_id: 1, photo: 'https://randomuser.me/api/portraits/men/38.jpg'  },
  { first_name: 'Monica',     last_name: 'Espinoza',      dni: '27400039', email: 'm.espinoza@cfl404.edu.ar',  phone: '221-411-0039', address: 'Calle 39 N 390, Berisso',      status_id: 2, photo: 'https://randomuser.me/api/portraits/women/39.jpg'},
  { first_name: 'Nahuel',     last_name: 'Quiroga',       dni: '30400040', email: 'n.quiroga@cfl404.edu.ar',   phone: '221-411-0040', address: 'Av. Montevideo 400, La Plata',  status_id: 1, photo: 'https://randomuser.me/api/portraits/men/40.jpg'  },
  { first_name: 'Ofelia',     last_name: 'Trujillo',      dni: '22400041', email: 'o.trujillo@cfl404.edu.ar',  phone: '221-411-0041', address: 'Calle 41 N 410, Berisso',      status_id: 1, photo: 'https://randomuser.me/api/portraits/women/41.jpg'},
  { first_name: 'Pedro',      last_name: 'Rios',          dni: '25400042', email: 'p.rios@cfl404.edu.ar',      phone: '221-411-0042', address: 'Calle 42 N 420, Ensenada',     status_id: 3, photo: 'https://randomuser.me/api/portraits/men/42.jpg'  },
  { first_name: 'Querubina',  last_name: 'Santana',       dni: '28400043', email: 'q.santana@cfl404.edu.ar',   phone: '221-411-0043', address: 'Calle 43 N 430, Berisso',      status_id: 1, photo: 'https://randomuser.me/api/portraits/women/43.jpg'},
  { first_name: 'Rodrigo',    last_name: 'Cabrera',       dni: '31400044', email: 'r.cabrera@cfl404.edu.ar',   phone: '221-411-0044', address: 'Calle 44 N 440, La Plata',     status_id: 1, photo: 'https://randomuser.me/api/portraits/men/44.jpg'  },
  { first_name: 'Susana',     last_name: 'Lara',          dni: '23400045', email: 's.lara@cfl404.edu.ar',      phone: '221-411-0045', address: 'Calle 45 N 450, Berisso',      status_id: 2, photo: 'https://randomuser.me/api/portraits/women/45.jpg'},
  { first_name: 'Telmo',      last_name: 'Palacios',      dni: '26400046', email: 't.palacios@cfl404.edu.ar',  phone: '221-411-0046', address: 'Av. del Petroleo 460, Berisso', status_id: 1, photo: 'https://randomuser.me/api/portraits/men/46.jpg'  },
  { first_name: 'Ursula2',    last_name: 'Barrios',       dni: '29400047', email: 'u.barrios@cfl404.edu.ar',   phone: '221-411-0047', address: 'Calle 47 N 470, Ensenada',     status_id: 1, photo: 'https://randomuser.me/api/portraits/women/47.jpg'},
  { first_name: 'Victor',     last_name: 'Marin',         dni: '32400048', email: 'v.marin@cfl404.edu.ar',     phone: '221-411-0048', address: 'Calle 48 N 480, Berisso',      status_id: 3, photo: 'https://randomuser.me/api/portraits/men/48.jpg'  },
  { first_name: 'Wanda',      last_name: 'Guzman',        dni: '21500049', email: 'w.guzman@cfl404.edu.ar',    phone: '221-411-0049', address: 'Calle 49 N 490, Berisso',      status_id: 1, photo: 'https://randomuser.me/api/portraits/women/49.jpg'},
  { first_name: 'Xenofonte',  last_name: 'Alvarado',      dni: '24500050', email: 'x.alvarado@cfl404.edu.ar',  phone: '221-411-0050', address: 'Calle 50 N 500, La Plata',     status_id: 1, photo: 'https://randomuser.me/api/portraits/men/50.jpg'  },
]

async function main() {
  console.log('Sembrando 50 instructores de prueba para CFL 404...\n')

  let creados = 0
  let omitidos = 0

  for (const inst of MOCK_INSTRUCTORS) {
    // Buscar por email O por DNI para evitar duplicados en cualquier caso
    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { email: inst.email },
          { dni: inst.dni },
        ],
      },
    })

    if (existing) {
      console.log(`Omitido (ya existe): ${inst.first_name} ${inst.last_name} - ${inst.email}`)
      omitidos++
      continue
    }

    await prisma.user.create({
      data: {
        firstName: inst.first_name,
        lastName: inst.last_name,
        email: inst.email,
        dni: inst.dni,
        statusId: inst.status_id,
        roleId: ROLES.INSTRUCTOR,
        profilePhotoUrl: inst.photo,
        userDetail: {
          create: {
            phone: inst.phone,
            address: inst.address,
            academicLevel: 'Terciario',
            gender: 'No especificado',
            nacionality: 'Argentina',
            dniCopy: 'true',
            formCopy: 'true',
            titleCopy: 'true',
          },
        },
      },
    })

    const statusLabel = inst.status_id === 1 ? 'Activo'
      : inst.status_id === 2 ? 'Inactivo'
      : 'Licencia'

    console.log(`OK: ${inst.first_name} ${inst.last_name} - ${inst.email} [${statusLabel}]`)
    creados++
  }

  console.log(`\nProceso finalizado.`)
  console.log(`Instructores creados: ${creados}`)
  console.log(`Omitidos (ya existian): ${omitidos}`)
  console.log(`Total procesados: ${MOCK_INSTRUCTORS.length}`)
}

main()
  .catch((e) => {
    console.error('Error en seed-instructors:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
