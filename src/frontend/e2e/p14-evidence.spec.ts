import { expect, test, type Browser, type Page } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const productionUrl =
  process.env.P14_PRODUCTION_URL ?? 'https://v0-bus-fleet-management-neon.vercel.app'
const password = process.env.SGMV_PROD_TEST_PASSWORD
const evidenceDirectory = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../docs/p14/evidencias',
)

type Viewport = { height: number; label: '390' | '1024' | '1440'; width: number }
type EvidenceCase = {
  file: string
  path: string
  requirement: string
  role: 'ADMINISTRADOR' | 'DESPACHADOR' | 'MECANICO' | 'CONDUCTOR' | 'PUBLICO'
  scenario: string
  viewport: Viewport
}

const viewports = {
  mobile: { height: 844, label: '390', width: 390 },
  laptop: { height: 768, label: '1024', width: 1024 },
  desktop: { height: 900, label: '1440', width: 1440 },
} satisfies Record<string, Viewport>

const accounts = {
  ADMINISTRADOR: 'administrador.demo@sgmv.local',
  DESPACHADOR: 'despachador.demo@sgmv.local',
  MECANICO: 'mecanico.demo@sgmv.local',
  CONDUCTOR: 'conductor.demo@sgmv.local',
} as const

const publicCases: EvidenceCase[] = [
  {
    file: 'P14_RNF02_LOGIN_390.png',
    path: '/login',
    requirement: 'RNF-02',
    role: 'PUBLICO',
    scenario: 'Acceso adaptable en movil',
    viewport: viewports.mobile,
  },
  {
    file: 'P14_RNF02_LOGIN_1024.png',
    path: '/login',
    requirement: 'RNF-02',
    role: 'PUBLICO',
    scenario: 'Acceso adaptable en portatil',
    viewport: viewports.laptop,
  },
  {
    file: 'P14_RNF02_LOGIN_1440.png',
    path: '/login',
    requirement: 'RNF-02',
    role: 'PUBLICO',
    scenario: 'Acceso adaptable en escritorio',
    viewport: viewports.desktop,
  },
]

const roleCases: EvidenceCase[] = [
  {
    file: 'P14_RF01_ADMIN_FLOTA_1440.png',
    path: '/flota',
    requirement: 'RF-01',
    role: 'ADMINISTRADOR',
    scenario: 'Consulta administrativa de flota',
    viewport: viewports.desktop,
  },
  {
    file: 'P14_RF03_ADMIN_PREVENTIVO_1024.png',
    path: '/mantenimiento-preventivo',
    requirement: 'RF-03',
    role: 'ADMINISTRADOR',
    scenario: 'Gestion de mantenimiento preventivo',
    viewport: viewports.laptop,
  },
  {
    file: 'P14_RF05_ADMIN_REPUESTOS_390.png',
    path: '/repuestos',
    requirement: 'RF-05',
    role: 'ADMINISTRADOR',
    scenario: 'Central de repuestos en movil',
    viewport: viewports.mobile,
  },
  {
    file: 'P14_RF01_DESPACHADOR_JORNADAS_1440.png',
    path: '/jornadas',
    requirement: 'RF-01',
    role: 'DESPACHADOR',
    scenario: 'Coordinacion de jornadas operativas',
    viewport: viewports.desktop,
  },
  {
    file: 'P14_RF02_DESPACHADOR_NOVEDADES_1024.png',
    path: '/novedades',
    requirement: 'RF-02',
    role: 'DESPACHADOR',
    scenario: 'Seguimiento operativo de novedades',
    viewport: viewports.laptop,
  },
  {
    file: 'P14_RF04_DESPACHADOR_ORDENES_390.png',
    path: '/ordenes-trabajo/despacho',
    requirement: 'RF-04',
    role: 'DESPACHADOR',
    scenario: 'Proyeccion operativa sin detalle tecnico',
    viewport: viewports.mobile,
  },
  {
    file: 'P14_RF04_MECANICO_ORDENES_1440.png',
    path: '/ordenes-trabajo',
    requirement: 'RF-04',
    role: 'MECANICO',
    scenario: 'Consulta de ordenes tecnicas asignadas',
    viewport: viewports.desktop,
  },
  {
    file: 'P14_RF06_MECANICO_HISTORIAL_1024.png',
    path: '/historial',
    requirement: 'RF-06',
    role: 'MECANICO',
    scenario: 'Antecedentes tecnicos autorizados',
    viewport: viewports.laptop,
  },
  {
    file: 'P14_RNF05_MECANICO_ALERTAS_390.png',
    path: '/alertas',
    requirement: 'RNF-05',
    role: 'MECANICO',
    scenario: 'Bandeja individual de alertas',
    viewport: viewports.mobile,
  },
  {
    file: 'P14_RF02_CONDUCTOR_NOVEDADES_1440.png',
    path: '/novedades',
    requirement: 'RF-02',
    role: 'CONDUCTOR',
    scenario: 'Reporte y seguimiento de novedades propias',
    viewport: viewports.desktop,
  },
  {
    file: 'P14_RF01_CONDUCTOR_JORNADA_1024.png',
    path: '/jornadas',
    requirement: 'RF-01',
    role: 'CONDUCTOR',
    scenario: 'Consulta de jornada propia',
    viewport: viewports.laptop,
  },
  {
    file: 'P14_RF06_CONDUCTOR_HISTORIAL_390.png',
    path: '/historial',
    requirement: 'RF-06',
    role: 'CONDUCTOR',
    scenario: 'Historial autorizado de su bus',
    viewport: viewports.mobile,
  },
]

const accessDeniedCase: EvidenceCase = {
  file: 'P14_RNF01_DESPACHADOR_ACCESO_DENEGADO_1440.png',
  path: '/repuestos',
  requirement: 'RNF-01',
  role: 'DESPACHADOR',
  scenario: 'Proteccion visible de ruta administrativa',
  viewport: viewports.desktop,
}

async function waitForStablePage(page: Page) {
  await page.locator('main').waitFor({ state: 'visible' })
  await page.waitForLoadState('networkidle')
  await expect(page.getByText(/Error al cargar|No fue posible cargar/i)).toHaveCount(0)
}

async function capture(page: Page, evidence: EvidenceCase) {
  await page.setViewportSize(evidence.viewport)
  await page.goto(evidence.path, { waitUntil: 'networkidle' })
  await waitForStablePage(page)
  await page.screenshot({ fullPage: true, path: resolve(evidenceDirectory, evidence.file) })
}

async function login(page: Page, email: string) {
  if (!password) {
    throw new Error('SGMV_PROD_TEST_PASSWORD must be provided through the protected environment')
  }

  await page.goto('/login', { waitUntil: 'networkidle' })
  await page.getByLabel(/Correo/).fill(email)
  await page.getByLabel(/Contrase.a/).fill(password)
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/auth/login') && response.request().method() === 'POST',
  )
  await page.getByRole('button', { name: /Ingresar/ }).click()
  expect((await responsePromise).status()).toBe(200)
  await expect(page).toHaveURL(/\/inicio$/)
}

async function capturePublicEvidence(browser: Browser) {
  for (const evidence of publicCases) {
    const context = await browser.newContext({ viewport: evidence.viewport })
    const page = await context.newPage()
    await capture(page, evidence)
    await context.close()
  }
}

async function captureRoleEvidence(browser: Browser) {
  for (const role of Object.keys(accounts) as Array<keyof typeof accounts>) {
    const cases = roleCases.filter((item) => item.role === role)
    const context = await browser.newContext({ viewport: viewports.desktop })
    const page = await context.newPage()
    await login(page, accounts[role])

    for (const evidence of cases) await capture(page, evidence)

    if (role === 'DESPACHADOR') {
      await page.setViewportSize(accessDeniedCase.viewport)
      await page.goto(accessDeniedCase.path, { waitUntil: 'networkidle' })
      await expect(page).toHaveURL(/\/acceso-denegado$/)
      await waitForStablePage(page)
      await page.screenshot({
        fullPage: true,
        path: resolve(evidenceDirectory, accessDeniedCase.file),
      })
    }

    await context.close()
  }
}

function checksum(file: string) {
  return createHash('sha256')
    .update(readFileSync(resolve(evidenceDirectory, file)))
    .digest('hex')
}

function csvCell(value: string | number) {
  return `"${String(value).replaceAll('"', '""')}"`
}

function writeManifest() {
  const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
  const gitSha = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  }).trim()
  const branch = execFileSync('git', ['branch', '--show-current'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  }).trim()
  const capturedAt = new Date().toISOString()
  const evidences = [...publicCases, ...roleCases, accessDeniedCase].map((item) => ({
    ...item,
    capturedAt,
    path: `docs/p14/evidencias/${item.file}`,
    result: 'PASS',
    sha256: checksum(item.file),
    viewport: `${item.viewport.width}x${item.viewport.height}`,
  }))
  const manifest = {
    branch,
    capturedAt,
    evidenceCount: evidences.length,
    productionUrl,
    sha: gitSha,
    evidences,
  }

  writeFileSync(
    resolve(evidenceDirectory, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8',
  )

  const headers = ['archivo', 'requisito', 'escenario', 'rol', 'viewport', 'resultado', 'sha256']
  const rows = evidences.map((item) =>
    [item.path, item.requirement, item.scenario, item.role, item.viewport, item.result, item.sha256]
      .map(csvCell)
      .join(','),
  )
  writeFileSync(
    resolve(evidenceDirectory, 'manifest.csv'),
    `${headers.map(csvCell).join(',')}\n${rows.join('\n')}\n`,
    'utf8',
  )

  console.log(
    JSON.stringify({
      branch,
      evidenceCount: evidences.length,
      manifest: relative(repositoryRoot, resolve(evidenceDirectory, 'manifest.json')),
      sha: gitSha,
    }),
  )
}

test('captures current production evidence for P14', async ({ browser }) => {
  mkdirSync(evidenceDirectory, { recursive: true })
  await capturePublicEvidence(browser)
  await captureRoleEvidence(browser)
  writeManifest()
})
