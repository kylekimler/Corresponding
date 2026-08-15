# Blockers requiring Kyle (external only)

1. **Google OAuth client ID / Chrome Web Store item ID**  
   Sheets read-only import is implemented and UI-gated. Needs `VITE_GOOGLE_OAUTH_CLIENT_ID`. See `docs/GOOGLE_SHEETS_SETUP.md`.

2. **Real Nature MTS / eJournalPress HTML capture**  
   Synthetic + corpus fixtures cover observed IDs. A redacted live capture validates edge cases.

3. **Real DOM fixtures for ScholarOne author-entry**  
   Editorial Manager author IDs are now capture-backed (PLOS ONE 2026-08-15).
   ScholarOne still needs a redacted author-form capture before selectors.

Everything else in the reliability backlog is local and unblocked.
