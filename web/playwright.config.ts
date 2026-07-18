import { defineConfig, devices } from '@playwright/test'

const port = Number(process.env.PORT ?? 3000)
const host = process.env.PLAYWRIGHT_HOST ?? 'localhost'
const localChromiumChannel = process.env.PLAYWRIGHT_CHANNEL ?? (process.env.CI ? undefined : 'chrome')
const crossBrowserSmoke = /cross-browser-smoke\.spec\.ts/
const useProductionServer = process.env.PLAYWRIGHT_USE_PRODUCTION_SERVER === '1'
const reuseExistingServer = process.env.PLAYWRIGHT_REUSE_EXISTING_SERVER === '0'
  ? false
  : !process.env.CI

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: `http://${host}:${port}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  webServer: {
    command: useProductionServer
      ? `npm run start -- --hostname ${host} --port ${port}`
      : `npm run dev -- --hostname ${host} --port ${port}`,
    url: `http://${host}:${port}`,
    reuseExistingServer,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'chromium',
      testIgnore: crossBrowserSmoke,
      use: {
        ...devices['Desktop Chrome'],
        ...(localChromiumChannel ? { channel: localChromiumChannel } : {}),
      },
    },
    {
      name: 'chromium-tablet-smoke',
      testMatch: crossBrowserSmoke,
      use: {
        browserName: 'chromium',
        ...(localChromiumChannel ? { channel: localChromiumChannel } : {}),
        viewport: { width: 768, height: 1024 },
        deviceScaleFactor: 1,
        hasTouch: true,
        isMobile: true,
      },
    },
    {
      name: 'firefox-smoke',
      testMatch: crossBrowserSmoke,
      use: {
        ...devices['Desktop Firefox'],
        browserName: 'firefox',
      },
    },
    {
      name: 'webkit-smoke',
      testMatch: crossBrowserSmoke,
      use: {
        ...devices['Desktop Safari'],
        browserName: 'webkit',
      },
    },
  ],
})
