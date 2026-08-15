# Blockers requiring Kyle (external only)

1. **Google OAuth client ID / Chrome Web Store item ID**  
   Sheets read-only import is implemented and UI-gated. Needs `VITE_GOOGLE_OAUTH_CLIENT_ID`. See `docs/GOOGLE_SHEETS_SETUP.md`.

2. **Real Nature MTS / eJournalPress HTML capture**  
   Synthetic + corpus fixtures cover observed IDs. A redacted live capture validates edge cases.

3. **Authenticated live smoke for Editorial Manager and ScholarOne**  
   Both now have capture-backed adapters (PLOS ONE 2026-08-15; Bioinformatics
   2026-08-14). Live multi-author Save on a real journal tab is still needed
   before production claims. Do not invent additional selectors.

Everything else in the reliability backlog is local and unblocked.
