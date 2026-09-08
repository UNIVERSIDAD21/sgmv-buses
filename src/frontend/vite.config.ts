/// <reference types="vitest" />

import react from '@vitejs/plugin-react'
import { configDefaults, defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  envDir: '../..',
  plugins: [react()],
  build: {
    manifest: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const moduleId = id.replaceAll('\\', '/')

          if (moduleId.includes('/node_modules/')) {
            if (moduleId.includes('/react-router')) {
              return 'vendor-router'
            }
            if (
              moduleId.includes('/react/') ||
              moduleId.includes('/react-dom/') ||
              moduleId.includes('/scheduler/')
            ) {
              return 'vendor-react'
            }
            return 'vendor'
          }

          return undefined
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    exclude: [...configDefaults.exclude, 'e2e/**'],
    fileParallelism: false,
    globals: true,
    setupFiles: './src/test/setup.ts',
  },
})
