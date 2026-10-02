import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.E2E_PORT) || 3100;

export default defineConfig({
  testDir: './e2e',
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${port}`,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'chromium-reduced-motion',
      use: { ...devices['Desktop Chrome'], contextOptions: { reducedMotion: 'reduce' } },
      testMatch: /motion\.spec\.ts|gui\.spec\.ts/,
    },
  ],
  webServer: {
    command: process.env.CI
      ? `npx next start -p ${port}`
      : `npm run build && npx next start -p ${port}`,
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.CI,
  },
});
