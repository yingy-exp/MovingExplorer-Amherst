const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: '.',
  testMatch: '**/*.test.js',
  use: {
    baseURL: 'http://localhost:3456',
    headless: true,
    // Give OSRM-dependent tests enough time
    actionTimeout: 10_000,
  },
  // Per-test timeout: 30s normally, overridden per-test where OSRM is involved
  timeout: 30_000,
  reporter: [['list'], ['html', { outputFolder: 'report', open: 'never' }]],
});
