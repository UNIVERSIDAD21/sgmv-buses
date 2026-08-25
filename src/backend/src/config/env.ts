import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { config } from 'dotenv'
import { z } from 'zod'

const currentDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(currentDir, '../../../..')

config({ path: resolve(repoRoot, '.env') })

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGIN: z.string().url().default('http://localhost:5173'),
  DATABASE_URL: z.string().url().optional(),
  JWT_SECRET: z.string().min(32).optional(),
  JWT_EXPIRES_IN: z.string().default('1h'),
  COOKIE_NAME: z.string().default('sgmv_session'),
  COOKIE_SECURE: z.coerce.boolean().default(false),
  COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  CSRF_SECRET: z.string().min(32).optional(),
})

const parsedEnv = envSchema.safeParse(process.env)

if (!parsedEnv.success) {
  console.error('Invalid environment configuration:', parsedEnv.error.flatten().fieldErrors)
  process.exit(1)
}

const env = parsedEnv.data

if (env.NODE_ENV === 'production') {
  const missing = ['DATABASE_URL', 'JWT_SECRET', 'CSRF_SECRET'].filter(
    (key) => !env[key as keyof typeof env],
  )

  if (missing.length > 0) {
    console.error(`Missing required production environment variables: ${missing.join(', ')}`)
    process.exit(1)
  }

  if (!env.COOKIE_SECURE) {
    console.error('COOKIE_SECURE must be true in production')
    process.exit(1)
  }
}

export { env }
