# Corresponding web app

Local-first manuscript roster editor. Author data stays in the browser and,
when the Chrome extension is installed, in `chrome.storage.local`. There is
no account and no remote roster store.

## Develop

```bash
npm install
npm run dev:web
```

The site is at `http://localhost:5173`.

In another terminal, run `npm run dev` and load the unpacked extension. Copy
its id from `chrome://extensions` into `web/.env`:

```
VITE_EXTENSION_ID=your_unpacked_extension_id
```

Restart `npm run dev:web`. Production builds of the extension accept messages
only from `https://corresponding.app`. Development builds also accept
`http://localhost` and `http://127.0.0.1`.

## Build

```bash
npm run build:web
```

Static files are written to `web/dist`.

## Deploy (do not publish from this document)

Cloudflare Pages or Netlify, from the repository root:

- Build command: `npm run build:web`
- Output directory: `web/dist`
- Environment: `VITE_EXTENSION_ID` = the Chrome Web Store extension id

Routing is hash-based (`#/manuscript`), so no rewrite rules are required.

`netlify.toml` at the repo root repeats that build configuration.
