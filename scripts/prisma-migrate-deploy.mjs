import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDirectory = dirname(fileURLToPath(import.meta.url))
const repositoryRoot = resolve(currentDirectory, '..')
const schemaPath = resolve(repositoryRoot, 'src/backend/prisma/schema.prisma')
const prismaCliPath = resolve(repositoryRoot, 'src/backend/node_modules/prisma/build/index.js')
const migrationUrl = process.env.DIRECT_URL?.trim() || process.env.DATABASE_URL?.trim()

if (!migrationUrl) {
  console.error('DATABASE_URL or DIRECT_URL must be configured for production migrations')
  process.exit(1)
}

const result = spawnSync(
  process.execPath,
  [prismaCliPath, 'migrate', 'deploy', '--schema', schemaPath],
  {
    cwd: repositoryRoot,
    env: {
      ...process.env,
      DATABASE_URL: migrationUrl,
    },
    stdio: 'inherit',
  },
)

if (result.error) {
  console.error('Unable to start Prisma migrate deploy')
  process.exit(1)
}

process.exit(result.status ?? 1)
