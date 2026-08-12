import { defineConfig } from 'wxt';
import { serveFixturesPlugin } from './dev/serveFixturesPlugin';

/** Pinned so `webExt.startUrls` always matches the WXT Vite server. */
const DEV_SERVER_PORT = 3000;
const NATURE_FIXTURE_URL = `http://localhost:${DEV_SERVER_PORT}/fixtures/nature-mts-sample.html`;

// Local-first MV3 extension: only activeTab + storage + scripting.
// Content scripts are injected on demand via activeTab; no broad host permissions.
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
  manifest: {
    name: 'Corresponding',
    description:
      'Maintain one scientific identity and fill manuscript author forms locally. Never submits or certifies for you.',
    version: '0.1.0',
    permissions: ['activeTab', 'storage', 'scripting'],
    // No host_permissions: rely on activeTab for the current tab only.
    action: {
      default_title: 'Corresponding',
    },
  },
  hooks: {
    // Keep the content-script build artifact for activeTab executeScript, but do not
    // register automatic content_scripts (narrowest permission model).
    'build:manifestGenerated': (_wxt, manifest) => {
      delete manifest.content_scripts;
    },
  },
});
