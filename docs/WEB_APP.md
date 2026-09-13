# Corresponding web app

Local-first manuscript roster editor. Author data stays in the browser and,
when the Chrome extension is installed, in `chrome.storage.local`. There is
no account and no remote roster store.

Scientists never configure an extension id. The installed extension announces
itself to this site.

An old local `VITE_EXTENSION_ID` is only a fallback; a discovered installed
extension takes priority. Reload the extension and refresh the website after
updating. The workspace also has a Check connection again action.

Drafts stay in this browser. Starting a new manuscript keeps the previous one
in manuscript history. Download backup exports a JSON file; Import file restores
it. Clearing site data deletes local drafts/history, so keep a backup when moving
browsers or devices. Incomplete invalid edits are not saved or synced; the UI
warns before leaving and keeps the last valid draft available for export.

## Develop

```bash
npm install
npm run dev
```

In another terminal:

```bash
npm run dev:web
```

The site is at `http://localhost:5173`. After you change the extension, reload
it on `chrome://extensions`, then refresh the site.

The extension accepts website messages from `https://corresponding.pages.dev` and
from localhost. Other websites cannot talk to it.

## Build

```bash
npm run build:web
```

Static files are written to `web/dist`.

## Local launch rehearsal

From the repository root with Node.js 22.13 or newer:

```sh
npm ci
npm run build
npm run build:web
npm run preview:web -- --host 127.0.0.1
```

Open `http://127.0.0.1:4173/`. This is a local instance, not a shareable public
URL. Load `.output/chrome-mv3` in Chrome using the README instructions, then
refresh the page. Both `localhost:4173` and `127.0.0.1:4173` are explicitly
supported by the extension's automatic discovery script. Do not choose a random
preview port. The Codex in-app browser can demonstrate editing and persistence,
but use Chrome with Corresponding installed for extension synchronization.

## Deploy

Cloudflare Pages or Netlify, from the repository root:

- Build command: `npm run build:web`
- Output directory: `web/dist`

Routing is hash-based (`#/manuscript`), so no rewrite rules are required.

`netlify.toml` at the repo root repeats that build configuration.

### Cloudflare Pages launch hosting

Canonical URL: https://corresponding.pages.dev/ under kylejkimler@gmail.com.
Use the free Pages address. Do not buy a domain or enable paid services without
an explicit owner decision after traction warrants it.

The existing `corresponding` project uses direct uploads. Build with
`npm run build:web`, then upload only the contents of `web/dist` as a ZIP using
Cloudflare Pages > corresponding > Create deployment. GitHub automatic
deployments are not configured. No backend or environment variables are needed.

Extension 0.1.1 trusts only this exact production origin and existing local
development origins. Other Pages projects and preview subdomains cannot access
rosters. Version 0.1.0 requires upgrading for production website synchronization.

After deployment, verify home and sample editing without an account, then in
Chrome with the extension verify roster synchronization. Keep downloaded roster
backups before moving between origins; browser storage is origin-specific.
