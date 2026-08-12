# Google Sheets import architecture

Author data is normalized locally. No Corresponding backend stores roster PII.

## Product UX (scientist-facing)

The product says **“Choose Google Sheet”**.

Scientists:

1. Sign into Google (Chrome Identity).
2. Pick a spreadsheet with the **Google Picker**.
3. Corresponding reads the selected file and maps columns.
4. Rosters stay on-device.

Scientists **never** enter:

- API keys
- OAuth client IDs
- Client secrets

Those are **developer configuration** only (this document).

## Target architecture

| Piece | Role |
|-------|------|
| Chrome Extension OAuth client | Identity for the extension item |
| `chrome.identity` | Interactive Google sign-in / token |
| Google Picker | Explicit user file selection |
| Scope `drive.file` | Access only files the user opens/picks with the app |
| Sheets API read | Values from the selected spreadsheet |
| Local mapping UI | Same column-mapping as paste/CSV |

### Why `drive.file` (preferred)

Per-file access satisfies “choose a sheet” without requesting access to every spreadsheet in Drive. Broader scopes (e.g. full Sheets readonly across Drive) are a last resort and should not be the default product ask.

Fallback during development: `spreadsheets.readonly` + pasted URL — not the long-term UX.

## Developer setup (Kyle / CI)

**Status:** blocked on production OAuth credentials. Product UI shows “Coming soon” / disabled — never an error about missing client IDs.

1. Create a Google Cloud project.
2. Enable **Google Sheets API**, **Google Picker API**, and **Google Drive API** (Picker).
3. Configure OAuth consent screen.
4. Create an OAuth client ID of type **Chrome Extension** (extension ID).
5. Provide `VITE_GOOGLE_OAUTH_CLIENT_ID` via CI secret / local `.env` — never ask users for it.
6. When shipping Sheets:
   - Manifest `oauth2.client_id` + scopes (`drive.file` and/or Sheets read as finalized).
   - Host permissions only as required for Picker / Sheets endpoints.
7. Implement `pickSpreadsheet()` behind `GoogleSheetsClient` (see `src/sheets/types.ts`).

## Code status

- Client interface + mock client + tests
- Chrome Identity-shaped client throws `SheetsNotConfiguredError` when unset (caught; UI stays scientist-friendly)
- No write APIs
- Popup: “Choose Google Sheet” disabled until configured — **no OAuth warnings on the main fill screen**

Until credentials exist: **Paste from spreadsheet** and **Upload CSV** are the supported import paths.
