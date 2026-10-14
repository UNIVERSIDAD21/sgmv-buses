import { PrismaClient } from '@prisma/client'

export async function setup() {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      'PostgreSQL es obligatorio para la suite backend. Use npm run test:backend:local.',
    )
  }
  const database = new URL(process.env.DATABASE_URL)
  if (
    !['localhost', '127.0.0.1', '[::1]'].includes(database.hostname) ||
    !/^\/sgmv_(?:test|e2e|.*validation)_/.test(database.pathname) ||
    process.env.NODE_ENV === 'production'
  ) {
    throw new Error(
      'Suite con escritura rechazada: use npm run test:backend:local para crear una base local aislada.',
    )
  }

  const prisma = new PrismaClient()

  try {
    await prisma.$queryRaw`SELECT 1`
    await prisma.limiteTasa.deleteMany()
  } catch (error) {
    throw new Error(
      'PostgreSQL no esta disponible para la suite backend. Verifique npm run db:local:status.',
      { cause: error },
    )
  } finally {
    await prisma.$disconnect()
  }
}
