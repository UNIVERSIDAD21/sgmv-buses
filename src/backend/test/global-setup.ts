import { PrismaClient } from '@prisma/client'

export async function setup() {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      'PostgreSQL es obligatorio para la suite backend. Use npm run test:backend:local.',
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
