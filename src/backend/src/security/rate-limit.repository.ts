import { Prisma, type PrismaClient } from '@prisma/client'

import { prisma } from '../prisma/client.js'

type DatabaseClient = PrismaClient | Prisma.TransactionClient

export interface IncrementRateLimitInput {
  ambito: string
  claveHash: string
  expiraAt: Date
  ventanaInicio: Date
}

interface RateLimitRow {
  contador: number
  expiraAt: Date
}

export class RateLimitRepository {
  constructor(private readonly database: PrismaClient = prisma) {}

  transaction<T>(operation: (database: Prisma.TransactionClient) => Promise<T>) {
    return this.database.$transaction(operation)
  }

  async increment(database: DatabaseClient, input: IncrementRateLimitInput) {
    const rows = await database.$queryRaw<RateLimitRow[]>(Prisma.sql`
      INSERT INTO "limites_tasa" (
        "ambito",
        "clave_hash",
        "ventana_inicio",
        "contador",
        "expira_at",
        "updated_at"
      )
      VALUES (
        ${input.ambito},
        ${input.claveHash},
        ${input.ventanaInicio},
        1,
        ${input.expiraAt},
        CURRENT_TIMESTAMP
      )
      ON CONFLICT ("ambito", "clave_hash", "ventana_inicio")
      DO UPDATE SET
        "contador" = "limites_tasa"."contador" + 1,
        "expira_at" = EXCLUDED."expira_at",
        "updated_at" = CURRENT_TIMESTAMP
      RETURNING "contador", "expira_at" AS "expiraAt"
    `)

    const row = rows[0]

    if (!row) {
      throw new Error('Rate limit counter was not returned')
    }

    return row
  }

  deleteCounter(ambito: string, claveHash: string) {
    return this.database.limiteTasa.deleteMany({
      where: {
        ambito,
        claveHash,
      },
    })
  }
}
