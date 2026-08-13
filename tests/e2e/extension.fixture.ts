import {
  chromium,
  test as base,
  type BrowserContext,
} from '@playwright/test';
import { E2E_EXTENSION_PATH } from './globalSetup';

type ExtensionFixtures = {
  context: BrowserContext;
  extensionId: string;
};

export const test = base.extend<ExtensionFixtures>({
  context: async (_fixtures, use) => {
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      headless: !process.argv.includes('--headed'),
      args: [
        `--disable-extensions-except=${E2E_EXTENSION_PATH}`,
        `--load-extension=${E2E_EXTENSION_PATH}`,
      ],
    });
    await use(context);
    await context.close();
  },
  extensionId: async ({ context }, use) => {
    let [serviceWorker] = context.serviceWorkers();
    serviceWorker ??= await context.waitForEvent('serviceworker');
    const extensionId = new URL(serviceWorker.url()).host;
    if (!extensionId) {
      throw new Error(`Could not resolve extension ID from ${serviceWorker.url()}`);
    }
    await use(extensionId);
  },
});

export const expect = test.expect;
