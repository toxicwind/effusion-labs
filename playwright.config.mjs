import { defineConfig, devices } from '@playwright/test'

const PORT = process.env.PLAYWRIGHT_WEB_PORT ? Number(process.env.PLAYWRIGHT_WEB_PORT) : 4173
const HOST = process.env.PLAYWRIGHT_WEB_HOST || '127.0.0.1'

export default defineConfig({
  testDir: './tests/playwright',
  timeout: 30_000,
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://${HOST}:${PORT}`,
    trace: 'on-first-retry',
    viewport: { width: 1280, height: 720 },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: `npm run serve -- --port=${PORT}`,
    url: `http://${HOST}:${PORT}/`,
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe',
    stderr: 'pipe',
    timeout: 120_000,
  },
})
