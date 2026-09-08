import { gzipSync } from 'node:zlib'
import { readFile, stat } from 'node:fs/promises'
import { resolve } from 'node:path'

const frontendDist = resolve(import.meta.dirname, '../src/frontend/dist')
const manifestPath = resolve(frontendDist, '.vite/manifest.json')
const KIB = 1024
const budgets = {
  initialCssGzip: 100 * KIB,
  initialJsGzip: 200 * KIB,
  routeChunkGzip: 200 * KIB,
  anyJsRaw: 500 * KIB,
}

const expectedRouteSources = [
  'src/features/alertas/AlertsPage.tsx',
  'src/features/dashboard/DashboardPage.tsx',
  'src/features/flota/BusFormPage.tsx',
  'src/features/flota/FleetCatalogPage.tsx',
  'src/features/flota/FleetPage.tsx',
  'src/features/historial/HistoryReportsPage.tsx',
  'src/features/jornadas/JourneyPage.tsx',
  'src/features/novedades/NoveltyPage.tsx',
  'src/features/ordenes-trabajo/DispatchWorkOrdersPage.tsx',
  'src/features/ordenes-trabajo/WorkOrderPage.tsx',
  'src/features/preventivo/PreventivePage.tsx',
  'src/features/repuestos/SparePartsPage.tsx',
]

function fail(message) {
  throw new Error(`Presupuesto de bundle: ${message}`)
}

function formatKiB(bytes) {
  return `${(bytes / KIB).toFixed(1)} KiB`
}

async function fileSizes(file) {
  const absolutePath = resolve(frontendDist, file)
  let content
  let raw

  try {
    ;[content, raw] = await Promise.all([readFile(absolutePath), stat(absolutePath)])
  } catch {
    fail(`no se pudo leer el artefacto esperado ${file}. Ejecute npm run build:frontend.`)
  }

  return { gzip: gzipSync(content).length, raw: raw.size }
}

function collectStaticFiles(manifest, entryKey, seen = new Set()) {
  if (seen.has(entryKey)) {
    return seen
  }

  const chunk = manifest[entryKey]
  if (!chunk) {
    fail(`el manifiesto no contiene el chunk ${entryKey}.`)
  }

  seen.add(entryKey)
  for (const imported of chunk.imports ?? []) {
    collectStaticFiles(manifest, imported, seen)
  }
  return seen
}

async function totalForFiles(files, kind) {
  const uniqueFiles = [...new Set(files)]
  const sizes = await Promise.all(uniqueFiles.map(fileSizes))
  return sizes.reduce((total, size) => total + size[kind], 0)
}

try {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  const entryKey = Object.keys(manifest).find((key) => manifest[key].isEntry)

  if (!entryKey) {
    fail('falta el entrypoint en dist/.vite/manifest.json.')
  }

  const staticChunks = [...collectStaticFiles(manifest, entryKey)].map((key) => manifest[key])
  const initialJsFiles = staticChunks
    .map((chunk) => chunk.file)
    .filter((file) => file.endsWith('.js'))
  const initialCssFiles = staticChunks.flatMap((chunk) => chunk.css ?? [])
  const initialJsGzip = await totalForFiles(initialJsFiles, 'gzip')
  const initialCssGzip = await totalForFiles(initialCssFiles, 'gzip')

  if (initialJsGzip > budgets.initialJsGzip) {
    fail(`JS inicial ${formatKiB(initialJsGzip)} excede ${formatKiB(budgets.initialJsGzip)}.`)
  }
  if (initialCssGzip > budgets.initialCssGzip) {
    fail(`CSS inicial ${formatKiB(initialCssGzip)} excede ${formatKiB(budgets.initialCssGzip)}.`)
  }

  const routeEntries = expectedRouteSources.map((source) => {
    const entry = Object.entries(manifest).find(([, chunk]) => chunk.src === source)
    if (!entry) {
      fail(`no existe un chunk lazy para ${source}.`)
    }
    return { chunk: entry[1], source }
  })

  const routeFiles = [...new Set(routeEntries.map(({ chunk }) => chunk.file))]
  for (const file of routeFiles) {
    const { gzip } = await fileSizes(file)
    if (gzip > budgets.routeChunkGzip) {
      fail(
        `chunk de ruta ${file} (${formatKiB(gzip)}) excede ${formatKiB(budgets.routeChunkGzip)}.`,
      )
    }
  }

  const artifactFiles = [
    ...new Set([
      ...Object.values(manifest).map((chunk) => chunk.file),
      ...Object.values(manifest).flatMap((chunk) => chunk.css ?? []),
    ]),
  ]
  for (const file of artifactFiles.filter((file) => file.endsWith('.js'))) {
    const { raw } = await fileSizes(file)
    if (raw > budgets.anyJsRaw) {
      fail(
        `chunk JavaScript ${file} (${formatKiB(raw)} raw) excede ${formatKiB(budgets.anyJsRaw)} raw.`,
      )
    }
  }

  console.log('Presupuesto de bundle correcto')
  console.table({
    'CSS inicial gzip': formatKiB(initialCssGzip),
    'JS inicial gzip': formatKiB(initialJsGzip),
    'Chunks de ruta': routeFiles.length,
    'Rutas lazy verificadas': routeEntries.length,
  })
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}
