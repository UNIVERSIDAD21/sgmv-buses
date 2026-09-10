import { defineConfig } from '@playwright/test'

const productionUrl =
  process.env.P14_PRODUCTION_URL ?? 'https://v0-bus-fleet-management-neon.vercel.app'

export default defineConfig({
  expect: { timeout: 20_000 },
  fullyParallel: false,
  outputDir: 'test-results/p14-evidence',
  projects: [{ name: 'p14-evidence-chromium', use: { browserName: 'chromium' } }],
  reporter: [['list']],
  retries: 0,
  testDir: './e2e',
  testMatch: /p14-evidence\.spec\.ts/,
  timeout: 180_000,
  use: {
    baseURL: productionUrl,
    screenshot: 'off',
    trace: 'off',
    video: 'off',
  },
  workers: 1,
})
