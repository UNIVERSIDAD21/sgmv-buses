import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const backendRequire = createRequire(resolve(root, 'src/backend/package.json'))
const frontendRequire = createRequire(resolve(root, 'src/frontend/package.json'))
const { parse } = backendRequire('dotenv')
const { PrismaClient, Prisma } = backendRequire('@prisma/client')
const [kind, ...args] = process.argv.slice(2)
if (!['backend', 'e2e'].includes(kind)) throw new Error('Indique backend o e2e.')

const local = parse(readFileSync(resolve(root, '.env.local')))
const source = new URL(local.DATABASE_URL)
if (
  !['localhost', '127.0.0.1', '[::1]'].includes(source.hostname) ||
  process.env.NODE_ENV === 'production'
) {
  throw new Error('Las pruebas con escritura exigen PostgreSQL local y un entorno no productivo.')
}
const databaseName = `sgmv_test_${kind}_${Date.now()}_${randomBytes(4).toString('hex')}`
const adminUrl = new URL(source)
adminUrl.pathname = '/postgres'
const testUrl = new URL(source)
testUrl.pathname = `/${databaseName}`
const admin = new PrismaClient({ datasources: { db: { url: adminUrl.href } } })
const testEnv = {
  ...process.env,
  ...local,
  DATABASE_URL: testUrl.href,
  DIRECT_URL: testUrl.href,
  NODE_ENV: 'test',
  SGMV_LOCAL_RUNTIME: 'false',
  SEED_USER_PASSWORD: '123456',
  COOKIE_SECURE: 'false',
  PORT: '4000',
  CORS_ORIGIN: 'http://localhost:5173',
  VITE_API_URL: 'http://localhost:4000',
  PLAYWRIGHT_API_URL: 'http://localhost:4000',
  PLAYWRIGHT_BASE_URL: 'http://localhost:5173',
  LOG_LEVEL: 'silent',
}
// Las credenciales de medios no son necesarias para esta suite local.
for (const key of [
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
  'LOGIN_RATE_LIMIT_MAX_ATTEMPTS',
  'LOGIN_IP_RATE_LIMIT_MAX_ATTEMPTS',
])
  delete testEnv[key]

let currentChild
let interrupted = false
function stopChild(signal = 'SIGTERM') {
  if (!currentChild || currentChild.exitCode !== null) return
  if (process.platform === 'win32') currentChild.kill(signal)
  else
    try {
      process.kill(-currentChild.pid, signal)
    } catch {
      /* Ya terminó. */
    }
}
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => {
    interrupted = true
    stopChild(signal)
  })

async function run(script, scriptArgs, cwd) {
  if (interrupted) throw new Error('Pruebas interrumpidas.')
  const child = spawn(process.execPath, [script, ...scriptArgs], {
    cwd,
    env: testEnv,
    stdio: 'inherit',
    detached: process.platform !== 'win32',
  })
  currentChild = child
  try {
    await new Promise((resolveRun, reject) => {
      child.once('error', reject)
      child.once('exit', (code, signal) =>
        code === 0
          ? resolveRun()
          : reject(new Error(`La validación terminó con ${signal ?? code}.`)),
      )
    })
  } finally {
    stopChild()
    currentChild = undefined
  }
}

let created = false
try {
  await admin.$executeRaw(Prisma.raw(`CREATE DATABASE "${databaseName}"`))
  created = true
  console.log(`Base de pruebas aislada: ${databaseName}; la base habitual no se modifica.`)
  await run(
    backendRequire.resolve('prisma/build/index.js'),
    ['migrate', 'deploy', '--schema', 'prisma/schema.prisma'],
    resolve(root, 'src/backend'),
  )
  await run(backendRequire.resolve('tsx/cli'), ['prisma/seed.ts'], resolve(root, 'src/backend'))
  if (kind === 'e2e') {
    await run(
      frontendRequire.resolve('@playwright/test/cli'),
      ['test', ...args],
      resolve(root, 'src/frontend'),
    )
  } else {
    await run(
      resolve(dirname(backendRequire.resolve('vitest/package.json')), 'vitest.mjs'),
      ['--run', '--fileParallelism=false', ...args],
      resolve(root, 'src/backend'),
    )
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Falló la validación local.')
  process.exitCode = 1
} finally {
  stopChild()
  if (created) {
    await admin.$executeRaw(Prisma.raw(`DROP DATABASE "${databaseName}" WITH (FORCE)`))
    console.log(`Base temporal retirada: ${databaseName}. No quedan fixtures en la base habitual.`)
  }
  await admin.$disconnect()
}
