# Google Sheets import architecture

Author data is normalized locally. No Corresponding backend stores roster PII.

## Product UX (scientist-facing)

Configured builds say **“Import Google Sheet”**.

Scientists:

1. Sign into Google (Chrome Identity).
2. Paste the URL of a spreadsheet they can access.
3. Corresponding reads the selected file read-only and maps columns.
4. Rosters stay on-device.

Scientists **never** enter:

- API keys
- OAuth client IDs
- Client secrets

Those are **developer configuration** only (this document).

Google Picker with per-file `drive.file` access remains the preferred follow-up
UX. The URL flow is the immediately available fallback and currently uses
Sheets read-only scope.

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

**Status:** URL import UI and client are implemented, but direct connection is
disabled in builds without production OAuth credentials. The product never
shows an error about missing client IDs.

1. Create a Google Cloud project.
2. Enable **Google Sheets API**, **Google Picker API**, and **Google Drive API** (Picker).
3. Configure OAuth consent screen.
4. Create an OAuth client ID of type **Chrome Extension** (extension ID).
5. Provide `VITE_GOOGLE_OAUTH_CLIENT_ID` via CI secret / local `.env` — never ask users for it.
6. Configured builds automatically add:
   - `identity`
   - Manifest `oauth2.client_id`
   - `spreadsheets.readonly`
   - `https://sheets.googleapis.com/*`
7. Implement `pickSpreadsheet()` behind `GoogleSheetsClient` (see `src/sheets/types.ts`).

## Code status

- Client interface + mock client + tests
- Chrome Identity-shaped client throws `SheetsNotConfiguredError` when unset (caught; UI stays scientist-friendly)
- No write APIs
- Popup: URL-based read-only import when configured; otherwise disabled with
  Paste as the private immediate alternative

Until credentials exist: **Paste from spreadsheet** and **Upload CSV** are the supported import paths.
