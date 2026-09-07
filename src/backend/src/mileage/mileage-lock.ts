import { Prisma } from '@prisma/client'

/**
 * Serializes every odometer write for the same bus, independently of whether
 * the reading originates in an operational journey, a novelty or a work order.
 */
export async function lockBusMileage(client: Prisma.TransactionClient, busId: string) {
  await client.$executeRaw(
    Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${`sgmv:kilometraje:${busId}`}, 0))`,
  )
}
