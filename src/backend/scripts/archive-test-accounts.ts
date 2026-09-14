import { PrismaClient } from '@prisma/client'

import { RESERVED_TEST_ACCOUNT_DOMAIN } from '../src/users/user.repository.js'

const prisma = new PrismaClient()
const confirmation = process.env.CONFIRM_ARCHIVE_TEST_ACCOUNTS

if (confirmation !== RESERVED_TEST_ACCOUNT_DOMAIN) {
  throw new Error(
    `CONFIRM_ARCHIVE_TEST_ACCOUNTS debe ser exactamente ${RESERVED_TEST_ACCOUNT_DOMAIN}`,
  )
}

try {
  const where = {
    email: { endsWith: RESERVED_TEST_ACCOUNT_DOMAIN, mode: 'insensitive' as const },
  }
  const before = await prisma.usuario.groupBy({
    by: ['estado'],
    _count: { _all: true },
    where,
  })
  const result = await prisma.usuario.updateMany({
    data: {
      bloqueadoHasta: null,
      estado: 'INACTIVO',
      intentosFallidosLogin: 0,
    },
    where: {
      ...where,
      estado: { not: 'INACTIVO' },
    },
  })
  const after = await prisma.usuario.groupBy({
    by: ['estado'],
    _count: { _all: true },
    where,
  })

  console.log(
    JSON.stringify({
      domain: RESERVED_TEST_ACCOUNT_DOMAIN,
      hard_delete: false,
      before,
      updated: result.count,
      after,
    }),
  )
} finally {
  await prisma.$disconnect()
}
