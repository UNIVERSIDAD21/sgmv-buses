import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { defineConfig } from '@playwright/test'

import { assertSafeWriteE2eDatabase, assertSafeWriteE2eTarget } from './e2e/support/e2e-safety.js'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const chromeExecutable = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const edgeExecutable = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const localBaseUrl = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173'

assertSafeWriteE2eTarget(localBaseUrl)
assertSafeWriteE2eDatabase(process.env.DATABASE_URL)

// El conjunto E2E local usa exclusivamente las cuentas académicas sembradas.
// La configuración de la estación puede contener una clave protegida para otros
// servicios; nunca debe reemplazar esta credencial pública ni alterar la base.
process.env.SEED_USER_PASSWORD = '123456'

export default defineConfig({
  expect: { timeout: 10_000 },
  fullyParallel: false,
  outputDir: 'test-results',
  projects: [
    {
      name: 'regression-chromium',
      testIgnore: [/ux-p11\.spec\.ts/, /p13-production\.spec\.ts/, /p14-evidence\.spec\.ts/],
      use: { browserName: 'chromium' },
    },
    {
      name: 'p11-chrome',
      testMatch: /ux-p11\.spec\.ts/,
      use: {
        browserName: 'chromium',
        launchOptions: { executablePath: chromeExecutable },
      },
    },
    {
      name: 'p11-edge',
      testMatch: /ux-p11\.spec\.ts/,
      use: {
        browserName: 'chromium',
        launchOptions: { executablePath: edgeExecutable },
      },
    },
  ],
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  retries: process.env.CI ? 1 : 0,
  testDir: './e2e',
  timeout: 60_000,
  use: {
    baseURL: localBaseUrl,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'npm run dev:backend:local',
      cwd: repositoryRoot,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      url: 'http://localhost:4000/health',
    },
    {
      command: 'npm run dev:frontend -- --host localhost',
      cwd: repositoryRoot,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      url: 'http://localhost:5173',
    },
  ],
  workers: 1,
})
