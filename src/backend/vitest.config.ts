import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: ['./test/global-setup.ts'],
    globals: true,
    hookTimeout: 60000,
    testTimeout: 60000,
  },
})
