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

The extension accepts website messages from `https://corresponding.app` and
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

### Netlify handoff

1. Sign into the intended Netlify account. Import the existing GitHub project
   `kylekimler/Corresponding`, branch `main`; grant access to this repository
   only. A public repository is **not** a technical prerequisite for hosting;
   account/plan and Git-provider authorization must permit the private import.
2. Use the repository root as the base, Node 22, build `npm run build:web`,
   publish `web/dist`. The existing lockfile supplies dependencies. No build
   environment variables, backend, account system, extension ID, or author data
   are required. Leave optional Google OAuth and count-service settings unset.
   Do not upload the repository root, raw recordings, `.env`, or `.output` as
   the website; only deploy `web/dist`.
3. A generated `*.netlify.app` URL can preview roster editing and local saving.
   It **cannot synchronize with the extension**: that origin is intentionally
   outside all three trust gates (manifest, discovery script, background handler).
   `VITE_EXTENSION_ID` does not bypass this. Do not advertise it as a full
   journal-autofill demo or add wildcard preview domains to the extension.
4. Add the owned `corresponding.app` domain to the project. Keep the apex
   `https://corresponding.app` as the canonical URL; `www.corresponding.app` is
   not an allowed extension origin. If using `www`, redirect it to the apex.
   In the domain registrar's DNS settings, apply the **exact current records
   displayed by Netlify for this project**. Preserve unrelated records (especially
   email). Do not buy a domain or change nameservers without owner approval.
5. Wait for DNS and HTTPS provisioning, then test signed out: home → create →
   paste synthetic authors → reload. In Chrome with the built extension, confirm
   “Saved to the Corresponding extension” and the same active roster in the popup.
   Check GitHub/setup/privacy links anonymously once the repo is public.

No rewrite is needed for hash routes. `web/public/_headers` is copied into the
publish directory for Netlify/Cloudflare response headers. Deploying the website
does not publish the extension or make GitHub public.

Provider references: [import an existing repository](https://docs.netlify.com/start/quickstarts/deploy-from-repository/),
[configure external DNS](https://docs.netlify.com/manage/domains/configure-domains/configure-external-dns/).
See [launch status](LAUNCH_STATUS.md) for verified checks and pending decisions.
