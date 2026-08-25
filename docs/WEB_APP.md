# Corresponding web app

Local-first manuscript roster editor. Author data stays in the browser and,
when the Chrome extension is installed, in `chrome.storage.local`. There is
no account and no remote roster store.

Scientists never configure an extension id. The installed extension announces
itself to this site.

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

## Deploy (do not publish from this document)

Cloudflare Pages or Netlify, from the repository root:

- Build command: `npm run build:web`
- Output directory: `web/dist`

Routing is hash-based (`#/manuscript`), so no rewrite rules are required.

`netlify.toml` at the repo root repeats that build configuration.
