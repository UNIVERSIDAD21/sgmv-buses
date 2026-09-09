import { defineConfig } from '@playwright/test'

const productionUrl =
  process.env.P13_PRODUCTION_URL ?? 'https://v0-bus-fleet-management-neon.vercel.app'

export default defineConfig({
  expect: { timeout: 15_000 },
  fullyParallel: false,
  outputDir: 'test-results/p13-production',
  projects: [{ name: 'p13-production-chromium', use: { browserName: 'chromium' } }],
  reporter: [['list']],
  retries: 0,
  testDir: './e2e',
  testMatch: /p13-production\.spec\.ts/,
  timeout: 60_000,
  use: {
    baseURL: productionUrl,
    screenshot: 'off',
    trace: 'off',
    video: 'off',
  },
  workers: 1,
})
