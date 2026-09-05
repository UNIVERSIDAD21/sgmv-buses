import { AsyncLocalStorage } from 'node:async_hooks'

import { Prisma, PrismaClient } from '@prisma/client'

const rootPrisma = new PrismaClient()
interface TransactionContext {
  client: Prisma.TransactionClient
  savepointIndex: number
}

const transactionStorage = new AsyncLocalStorage<TransactionContext>()

export const prisma = new Proxy(rootPrisma, {
  get(target, property) {
    const context = transactionStorage.getStore()

    if (context && property === '$transaction') {
      return async <T>(operation: (client: Prisma.TransactionClient) => Promise<T>) => {
        if (typeof operation !== 'function') {
          throw new Error('Las transacciones por lote no se admiten dentro de otra transaccion')
        }

        context.savepointIndex += 1
        const savepoint = `sgmv_nested_${context.savepointIndex}`

        await context.client.$executeRawUnsafe(`SAVEPOINT ${savepoint}`)

        try {
          const result = await operation(context.client)
          await context.client.$executeRawUnsafe(`RELEASE SAVEPOINT ${savepoint}`)
          return result
        } catch (error) {
          await context.client.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT ${savepoint}`)
          await context.client.$executeRawUnsafe(`RELEASE SAVEPOINT ${savepoint}`)
          throw error
        }
      }
    }

    const source = context?.client ?? target
    const value = Reflect.get(source, property, source) as unknown

    return typeof value === 'function' ? value.bind(source) : value
  },
}) as PrismaClient

export function runInPrismaTransaction<T>(
  operation: (client: Prisma.TransactionClient) => Promise<T>,
) {
  const currentTransaction = transactionStorage.getStore()

  if (currentTransaction) {
    return operation(currentTransaction.client)
  }

  return rootPrisma.$transaction(
    (transaction) =>
      transactionStorage.run({ client: transaction, savepointIndex: 0 }, () =>
        operation(transaction),
      ),
    {
      maxWait: 15_000,
      timeout: 60_000,
    },
  )
}

export async function checkDatabaseReadiness() {
  await rootPrisma.$queryRaw`SELECT 1`
}

export function disconnectPrisma() {
  return rootPrisma.$disconnect()
}
