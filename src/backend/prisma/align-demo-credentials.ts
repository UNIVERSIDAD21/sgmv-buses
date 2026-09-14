import { hash } from 'bcryptjs'

import { prisma } from '../src/prisma/client.js'
import { ACADEMIC_DEMO_ACCOUNTS, ACADEMIC_DEMO_PASSWORD } from './demo-accounts.js'

async function main() {
  const password = process.env.DEMO_USER_PASSWORD
  if (password !== ACADEMIC_DEMO_PASSWORD) {
    throw new Error('DEMO_USER_PASSWORD no coincide con la credencial demo academica autorizada')
  }

  const emails = ACADEMIC_DEMO_ACCOUNTS.map((account) => account.email)
  const existing = await prisma.usuario.findMany({
    select: {
      email: true,
      estado: true,
      nombre: true,
      rol: { select: { codigo: true } },
    },
    where: { email: { in: emails } },
  })

  const byEmail = new Map(existing.map((account) => [account.email, account]))
  for (const expected of ACADEMIC_DEMO_ACCOUNTS) {
    const account = byEmail.get(expected.email)
    if (
      !account ||
      account.nombre !== expected.name ||
      account.rol.codigo !== expected.role ||
      account.estado !== 'ACTIVO'
    ) {
      throw new Error(`Cuenta demo no verificable: ${expected.email}`)
    }
  }

  const hashes = await Promise.all(
    ACADEMIC_DEMO_ACCOUNTS.map(() => hash(ACADEMIC_DEMO_PASSWORD, 12)),
  )
  await prisma.$transaction(
    ACADEMIC_DEMO_ACCOUNTS.map((account, index) =>
      prisma.usuario.update({
        data: { contrasenaHash: hashes[index]! },
        select: { email: true },
        where: { email: account.email },
      }),
    ),
  )

  console.log(`Credenciales demo alineadas: ${ACADEMIC_DEMO_ACCOUNTS.length} cuentas.`)
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'No fue posible alinear cuentas demo')
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
