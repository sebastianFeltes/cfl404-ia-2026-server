import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL || 'file:./database.db',
  timeout: 10000,
})
const p = new PrismaClient({ adapter })

async function seed() {
  const result = await p.setting.upsert({
    where: { key: 'cooperadora_monto_mensual' },
    update: {},
    create: {
      key: 'cooperadora_monto_mensual',
      value: '5000',
      name: 'Monto mensual cooperadora',
      description: 'Cuota mensual en pesos para la cooperadora escolar',
    },
  })
  console.log('Setting insertado:', result.key, '=', result.value)
  await p.$disconnect()
}

seed().catch((e) => {
  console.error(e)
  p.$disconnect()
  process.exit(1)
})
