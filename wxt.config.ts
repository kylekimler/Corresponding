import { defineConfig } from 'wxt';
import { loadEnv } from 'vite';
import { serveFixturesPlugin } from './scripts/serveFixturesPlugin';

/** Pinned so `webExt.startUrls` always matches the WXT Vite server. */
const DEV_SERVER_PORT = 3000;
const NATURE_FIXTURE_URL = `http://localhost:${DEV_SERVER_PORT}/fixtures/nature-mts-sample.html`;

// Local-first MV3 extension: only activeTab + storage + scripting.
// Contextual autofill registers a narrow content script on known journal
// hosts. Other pages still use activeTab injection. No broad host permissions.
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  srcDir: 'src',
  outDir: '.output',
  // Predictable origin for startUrls (do not let the port float to 3001+).
  dev: {
    server: {
      port: DEV_SERVER_PORT,
      strictPort: true,
    },
  },
  // Serve `fixtures/` from the existing WXT/Vite server (no second process).
  vite: () => ({
    plugins: [serveFixturesPlugin()],
  }),
  // Dedicated Chromium profile for `npm run dev` — separate from your everyday Chrome.
  // Rosters, cookies, and logins persist across restarts under `.wxt/chrome-data` (gitignored).
  // Note: web-ext may also pass `--disable-blink-features=AutomationControlled` on its own
  // (to keep navigator.webdriver false while using remote debugging). That flag is not set here.
  webExt: {
    chromiumArgs: ['--user-data-dir=./.wxt/chrome-data'],
    startUrls: [NATURE_FIXTURE_URL],
  },
  manifest: ({ mode }) => {
    const googleClientId = loadEnv(mode, process.cwd(), 'VITE_')
      .VITE_GOOGLE_OAUTH_CLIENT_ID;
    const sheetsEnabled = Boolean(googleClientId?.trim());
    return {
      name: 'Corresponding',
      description:
        'Stop retyping authors into journal forms. Import a spreadsheet, fill locally. You still submit. Free. No account.',
      version: '0.1.1',
      permissions: [
        'activeTab',
        'storage',
        'scripting',
        ...(sheetsEnabled ? (['identity'] as const) : []),
      ],
      // Google access exists only in explicitly configured builds. Default
      // production builds retain no host permissions.
      host_permissions: sheetsEnabled
        ? ['https://sheets.googleapis.com/*']
        : undefined,
      oauth2: sheetsEnabled
        ? {
            client_id: googleClientId,
            scopes: [
              'https://www.googleapis.com/auth/spreadsheets.readonly',
            ],
          }
        : undefined,
      icons: {
        16: 'icons/corr-16.png',
        32: 'icons/corr-32.png',
        48: 'icons/corr-48.png',
        128: 'icons/corr-128.png',
      },
      action: {
        default_title: 'Corresponding',
        default_icon: {
          16: 'icons/corr-16.png',
          32: 'icons/corr-32.png',
          48: 'icons/corr-48.png',
          128: 'icons/corr-128.png',
        },
      },
      // First-party website only. Not a host permission and not a
      // content script. Journal pages still use activeTab injection.
      externally_connectable: {
        matches: [
          'https://corresponding.pages.dev/*',
          'http://localhost/*',
          'http://127.0.0.1/*',
        ],
      },
    };
  },
});
