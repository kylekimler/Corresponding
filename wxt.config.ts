import { defineConfig } from 'wxt';

// Local-first MV3 extension: only activeTab + storage + scripting.
// Content scripts are injected on demand via activeTab; no broad host permissions.
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  srcDir: 'src',
  outDir: '.output',
  // Dedicated Chromium profile for `npm run dev` — separate from your everyday Chrome.
  // Rosters, cookies, and logins persist across restarts under `.wxt/chrome-data` (gitignored).
  webExt: {
    chromiumArgs: ['--user-data-dir=./.wxt/chrome-data'],
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
