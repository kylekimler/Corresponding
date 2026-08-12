# Google Sheets Read-Only Setup

Author data is normalized locally. No backend is required for roster storage.

## Status

**Blocked on production OAuth credentials** (Chrome Extension OAuth client ID).

The codebase includes:

- URL parsing
- Client interface
- Mock client + tests
- Chrome Identity-shaped client that throws if unconfigured
- No write APIs

## Minimum scope

`https://www.googleapis.com/auth/spreadsheets.readonly`

## Steps for Kyle

1. Create a Google Cloud project.
2. Enable Google Sheets API.
3. Configure OAuth consent screen (external or internal as appropriate).
4. Create an OAuth client ID of type **Chrome Extension**, using the extension’s Chrome Web Store item ID (or development ID during testing).
5. Provide the client ID as `VITE_GOOGLE_OAUTH_CLIENT_ID` for builds (via CI secret / local `.env` — never commit the value if policies forbid it; client IDs are often public but still manage carefully).
6. Add the `oauth2` section to the WXT manifest when enabling the feature in a release build:
   - `client_id`
   - `scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"]`
7. Optionally add host permission for `https://sheets.googleapis.com/*` only when shipping Sheets import.

Until then, CSV and local roster flows remain the supported import paths.
