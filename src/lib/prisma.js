import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { PrismaPg } from '@prisma/adapter-pg'

export function databaseDriver(databaseUrl = process.env.DATABASE_URL || 'file:./database.db') {
  return String(databaseUrl).startsWith('postgres') ? 'postgres' : 'sqlite'
}

function createPrisma() {
  const url = process.env.DATABASE_URL || 'file:./database.db'
  if (databaseDriver(url) === 'postgres') {
    return new PrismaClient({ adapter: new PrismaPg(url) })
  }
  return new PrismaClient({
    adapter: new PrismaBetterSqlite3({ url, timeout: 10000 }),
  })
}

const prisma = createPrisma()

export default prisma
