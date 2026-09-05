import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { config } from 'dotenv'
import { z } from 'zod'

const currentDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(currentDir, '../../../..')

config({ path: resolve(repoRoot, '.env') })

export function parseBooleanEnv(value: unknown) {
  if (typeof value !== 'string') {
    return value
  }

  const normalized = value.trim().toLowerCase()

  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true
  }

  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false
  }

  return value
}

const booleanEnv = z.preprocess(parseBooleanEnv, z.boolean())

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGIN: z.string().url().default('http://localhost:5173'),
  DATABASE_URL: z.string().url().optional(),
  JWT_SECRET: z.string().min(32).optional(),
  JWT_EXPIRES_IN: z.string().default('1h'),
  JWT_ISSUER: z.string().min(1).default('sgmv-api'),
  JWT_AUDIENCE: z.string().min(1).default('sgmv-web'),
  COOKIE_NAME: z.string().default('sgmv_session'),
  COOKIE_SECURE: booleanEnv.default(false),
  COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  CSRF_COOKIE_NAME: z.string().min(1).default('sgmv_csrf'),
  CSRF_SECRET: z.string().min(32).optional(),
  CSRF_TOKEN_TTL_MS: z.coerce.number().int().positive().default(7_200_000),
  RATE_LIMIT_SECRET: z.string().min(32).optional(),
  LOGIN_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  LOGIN_RATE_LIMIT_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  LOGIN_IP_RATE_LIMIT_MAX_ATTEMPTS: z.coerce.number().int().positive().default(100),
  TRUST_PROXY_HOPS: z.coerce.number().int().nonnegative().default(0),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  IDEMPOTENCY_IN_PROGRESS_TTL_MS: z.coerce.number().int().positive().default(120_000),
  IDEMPOTENCY_RESPONSE_MAX_BYTES: z.coerce.number().int().positive().default(262_144),
  READINESS_TIMEOUT_MS: z.coerce.number().int().positive().default(3_000),
  SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
  PREVENTIVE_SOON_DAYS: z.coerce.number().int().positive().default(7),
  PREVENTIVE_SOON_KM: z.coerce.number().int().positive().default(500),
})

const parsedEnv = envSchema.safeParse(process.env)

if (!parsedEnv.success) {
  console.error('Invalid environment configuration:', parsedEnv.error.flatten().fieldErrors)
  process.exit(1)
}

const env = parsedEnv.data

if (env.NODE_ENV === 'test' && !env.JWT_SECRET) {
  env.JWT_SECRET = 'test-only-jwt-secret-for-sgmv-auth-suite-32'
}

if (env.NODE_ENV === 'test' && !env.CSRF_SECRET) {
  env.CSRF_SECRET = 'test-only-csrf-secret-for-sgmv-suite-32'
}

if (env.NODE_ENV === 'test' && !env.RATE_LIMIT_SECRET) {
  env.RATE_LIMIT_SECRET = 'test-only-rate-limit-secret-for-sgmv-32'
}

if (env.NODE_ENV === 'test') {
  env.LOGIN_IP_RATE_LIMIT_MAX_ATTEMPTS = 10_000
}

if (env.COOKIE_SAMESITE === 'none' && !env.COOKIE_SECURE) {
  console.error('COOKIE_SECURE must be true when COOKIE_SAMESITE is none')
  process.exit(1)
}

if (env.NODE_ENV === 'production') {
  const missing = ['DATABASE_URL', 'JWT_SECRET', 'CSRF_SECRET', 'RATE_LIMIT_SECRET'].filter(
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

  if (env.TRUST_PROXY_HOPS < 1) {
    console.error('TRUST_PROXY_HOPS must identify the trusted production proxy chain')
    process.exit(1)
  }
}

export { env }
