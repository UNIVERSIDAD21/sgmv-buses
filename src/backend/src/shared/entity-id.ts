import { z } from 'zod'

// HTTP path/query strings and JSON integers share a strict PostgreSQL Int contract.
// Do not accept whitespace, signs, fractions, exponent notation, booleans or unsafe values.
export const entityIdSchema = z
  .union([
    z.number(),
    z
      .string()
      .regex(/^[1-9]\d*$/)
      .transform(Number),
  ])
  .pipe(z.number().int().positive().max(2_147_483_647))
