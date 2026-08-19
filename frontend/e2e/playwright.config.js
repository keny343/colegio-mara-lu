// @ts-check

const path = require('path');
const dotenv = require('dotenv');
const { defineConfig } = require('@playwright/test');

// ============================================================
// CARREGAR .env DA PASTA E2E
// ============================================================

const envPath = path.join(__dirname, '.env');

const dotenvResult = dotenv.config({
  path: envPath,
});

if (dotenvResult.error) {
  console.warn(
    `[e2e] Aviso: não consegui carregar ${envPath} — ${dotenvResult.error.message}`
  );
}

// ============================================================
// CONFIGURAÇÃO PLAYWRIGHT
// ============================================================

module.exports = defineConfig({
  testDir: './',

  timeout: 90_000,

  fullyParallel: false,

  retries: 1,

  reporter: 'list',

  use: {
    baseURL:
      process.env.E2E_BASE_URL ||
      'http://localhost:3000',

    trace: 'retain-on-failure',

    screenshot: 'only-on-failure',

    actionTimeout: 15_000,

    navigationTimeout: 30_000,
  },
});