# Blockers requiring Kyle

1. **Google OAuth client ID / Chrome Web Store item ID**  
   Needed to enable Google Sheets read-only import in production builds. Abstraction, mocks, UI (when configured), tests, and setup docs are in place. See `docs/GOOGLE_SHEETS_SETUP.md`.

2. **Real Nature MTS / eJournalPress HTML capture**  
   Synthetic fixture covers observed field IDs (`num_authors`, `corr_auth_*`, `contrib_auth_{n}_*`, `current_contrib_auth_{n}_author_pid`). A redacted live capture would confirm edge cases (dynamic slot creation, country option values, linked PID behavior).

3. **Real DOM fixtures for other portals**  
   ScholarOne, Editorial Manager, and generic eJournalPress adapters are stubs by design. Do not invent selectors without fixtures. Use the in-extension Diagnostics tool on a real page and send the redacted report.

## Not blocked

- Local CSV import, saved rosters, Nature MTS fill against the synthetic fixture, preview/validate UX, diagnostics, commercial docs.
