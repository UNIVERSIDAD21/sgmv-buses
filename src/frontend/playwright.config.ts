import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { defineConfig } from '@playwright/test'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

export default defineConfig({
  expect: { timeout: 10_000 },
  fullyParallel: false,
  outputDir: 'test-results',
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  retries: process.env.CI ? 1 : 0,
  testDir: './e2e',
  timeout: 60_000,
  use: {
    baseURL: 'http://localhost:5173',
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
