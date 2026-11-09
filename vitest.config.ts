import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

type BrowserName = 'chromium' | 'firefox' | 'webkit';

/**
 * Przeglądarki dla testów w prawdziwej przeglądarce. Domyślnie Chromium;
 * w CI: BROWSERS=chromium,firefox,webkit (wymaga `playwright install`).
 */
const browsers = (process.env['BROWSERS'] ?? 'chromium')
  .split(',')
  .map((name) => name.trim())
  .filter(Boolean) as BrowserName[];

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          // Core ma działać bez DOM; testy muszą to potwierdzać. Testy komponentów
          // przełączają się na jsdom docblockiem `@vitest-environment jsdom`.
          environment: 'node',
          include: ['packages/*/src/**/*.test.ts'],
          exclude: ['**/*.browser.test.ts', '**/node_modules/**'],
        },
      },
      {
        test: {
          name: 'browser',
          include: ['packages/elements/src/**/*.browser.test.ts'],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({ launchOptions: { args: ['--no-sandbox'] } }),
            instances: browsers.map((browser) => ({ browser })),
            viewport: { width: 1100, height: 700 },
          },
        },
      },
    ],
  },
});
