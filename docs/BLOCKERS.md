# Blockers requiring Kyle (external only)

1. **Google OAuth client ID / Chrome Web Store item ID**  
   Sheets read-only import is implemented and UI-gated. Needs `VITE_GOOGLE_OAUTH_CLIENT_ID`. See `docs/GOOGLE_SHEETS_SETUP.md`.

2. **Real Nature MTS / eJournalPress HTML capture**  
   Synthetic + corpus fixtures cover observed IDs. A redacted live capture validates edge cases.

3. **Real DOM fixtures for ScholarOne / Editorial Manager author-entry**  
   Stubs + research notes exist. PLOS ONE live captures (2026-08-14) are the EM
   role/home shell only — no author field IDs. Do not invent selectors. Recapture
   on Manuscript Data → Authors after clicking inside the author fields.

Everything else in the reliability backlog is local and unblocked.
