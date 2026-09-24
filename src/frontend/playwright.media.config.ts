import { defineConfig } from '@playwright/test'
import base from './playwright.config'

// Explicit real-provider gate. No mocks, trace, video or network dumps containing cookies.
export default defineConfig({
  ...base,
  projects: [
    { name: 'media-real', testMatch: /novelty-media\.spec\.ts/, use: { browserName: 'chromium' } },
  ],
  use: { ...base.use, trace: 'off', video: 'off' },
})
