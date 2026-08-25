// @ts-check

const { defineConfig, devices } = require('@playwright/test');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({
  path: path.resolve(__dirname, '.env'),
});

/**
 * @see https://playwright.dev/docs/test-configuration
 */
module.exports = defineConfig({
  testDir: __dirname,

  fullyParallel: false,

  forbidOnly: !!process.env.CI,

  retries: process.env.CI ? 2 : 1,

  workers: 1,

  reporter: 'list',

  timeout: 60_000,

  expect: {
    timeout: 20_000,
  },

  use: {
    baseURL: 'http://localhost:3000',

    trace: 'retain-on-failure',

    screenshot: 'only-on-failure',

    video: 'retain-on-failure',

    actionTimeout: 30_000,

    navigationTimeout: 45_000,
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
    command: 'npm start',

    url: 'http://localhost:3000',

    reuseExistingServer: true,

    timeout: 120_000,
  },
});