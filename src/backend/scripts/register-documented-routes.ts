import { PrismaClient } from '@prisma/client'
import { documentedAmbRoutes2026 } from '../src/amb/documented-routes-2026.js'

const apply = process.argv.includes('--aplicar-local')
if (!apply) {
  console.log(JSON.stringify({ referencias: documentedAmbRoutes2026, aplicaDatos: false }, null, 2))
} else {
  const database = new URL(process.env.DATABASE_URL ?? '')
  if (
    !['localhost', '127.0.0.1', '[::1]'].includes(database.hostname) ||
    process.env.NODE_ENV === 'production' ||
    (database.pathname !== '/sgmv_admin_validation_20261013' &&
      !database.pathname.startsWith('/sgmv_test_'))
  )
    throw new Error('Utilice únicamente una base local aislada de revisión o pruebas')
  const prisma = new PrismaClient()
  try {
    const records = await prisma.$transaction(async (tx) => {
      const result = []
      for (const reference of documentedAmbRoutes2026) {
        const existing = await tx.ruta.findUnique({ where: { codigo: reference.codigo } })
        if (
          existing &&
          (existing.operador !== reference.operador ||
            existing.longitudKmOficial?.toNumber() !== reference.longitudKmOficial ||
            existing.nombre !== reference.nombre)
        )
          throw new Error('Un código de referencia está ocupado; no se sobrescribe el registro')
        const route = await tx.ruta.upsert({
          where: { codigo: reference.codigo },
          update: {},
          create: reference,
        })
        result.push({ id: route.id, codigo: route.codigo, creada: !existing })
      }
      return result
    })
    console.log(
      JSON.stringify({
        referencias: records,
        historicoConservado: true,
        registrosOperativosCreados: 0,
      }),
    )
  } finally {
    await prisma.$disconnect()
  }
}
