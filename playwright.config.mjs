import { defineConfig, devices } from '@playwright/test'
import { resolveChromium } from './tools/resolve-chromium.mjs'

const PORT = process.env.PLAYWRIGHT_WEB_PORT ? Number(process.env.PLAYWRIGHT_WEB_PORT) : 4173
const HOST = process.env.PLAYWRIGHT_WEB_HOST || '127.0.0.1'
const EXECUTABLE_PATH = resolveChromium()

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
    browserName: 'chromium',
    launchOptions: {
      executablePath: EXECUTABLE_PATH,
      args: [
        '--disable-http-cache',
        '--disk-cache-size=0',
        '--media-cache-size=0',
        '--disable-application-cache',
        '--disable-offline-auto-reload',
        '--disable-background-networking',
      ],
    },
    extraHTTPHeaders: {
      'cache-control': 'no-store, max-age=0, must-revalidate',
      pragma: 'no-cache',
      expires: '0',
    },
    ignoreHTTPSErrors: true,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
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
