import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDirectory = dirname(fileURLToPath(import.meta.url))
const repositoryRoot = resolve(currentDirectory, '..')

function readJson(path) {
  return JSON.parse(readFileSync(resolve(repositoryRoot, path), 'utf8'))
}

function requireCondition(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

const rootPackage = readJson('package.json')
const frontendPackage = readJson('src/frontend/package.json')
const backendPackage = readJson('src/backend/package.json')
const vercel = readJson('src/frontend/vercel.json')
const render = readFileSync(resolve(repositoryRoot, 'render.yaml'), 'utf8')

requireCondition(rootPackage.scripts['build:render'], 'Missing root build:render script')
requireCondition(rootPackage.scripts['build:vercel'], 'Missing root build:vercel script')
requireCondition(frontendPackage.scripts['build:vercel'], 'Missing frontend build:vercel script')
requireCondition(backendPackage.scripts['prisma:generate:ci'], 'Missing CI Prisma generation')
requireCondition(
  backendPackage.scripts['prisma:migrate:deploy:ci'],
  'Missing controlled Prisma migration script',
)
requireCondition(vercel.buildCommand === 'npm run build:vercel', 'Unexpected Vercel build command')
requireCondition(vercel.framework === 'vite', 'Vercel framework must be Vite')
requireCondition(vercel.outputDirectory === 'dist', 'Vercel output directory must be dist')
requireCondition(vercel.rewrites?.[0]?.source === '/api/:path*', 'API rewrite must run first')
requireCondition(vercel.rewrites?.[1]?.destination === '/index.html', 'SPA fallback must run last')

for (const fragment of [
  'name: sgmv-backend',
  'branch: realineacion/trazabilidad-operativa-tecnica',
  'buildCommand: npm ci --include=dev && npm run build:render',
  'startCommand: npm --workspace @sgmv/backend run start',
  'healthCheckPath: /ready',
  '- key: DATABASE_URL',
  '- key: DIRECT_URL',
  'sync: false',
]) {
  requireCondition(render.includes(fragment), `render.yaml is missing: ${fragment}`)
}

requireCondition(
  !/postgres(?:ql)?:\/\/[\w-]+:[^<\s]+@/i.test(render),
  'render.yaml contains a database credential',
)
requireCondition(
  !/(JWT|CSRF|RATE_LIMIT)_SECRET:\s*\S+/i.test(render),
  'render.yaml contains an inline secret',
)

console.log('P13 deployment configuration: PASS')
