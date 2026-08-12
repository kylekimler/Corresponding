# Product

## Name

Corresponding

## Problem

Scientific manuscript submission systems force repetitive, error-prone re-entry of author metadata (names, emails, affiliations, ORCID, corresponding-author flags) across journals and portals. Large collaborations amplify the pain.

## Solution

A Chrome Manifest V3 extension that:

1. Lets a scientist maintain one canonical local author roster.
2. Imports rosters from CSV, Google Sheets (read-only), or saved local storage.
3. Detects the active submission platform.
4. Previews exactly what will be filled.
5. Shows missing information and conflicts.
6. Fills the form deterministically via a platform adapter.
7. Validates the resulting form.
8. Leaves final submission, certification, payment, and legal actions to the human.

## First supported platform

Nature MTS / eJournalPress, based on observed DOM field IDs such as:

- `num_authors`
- `corr_auth_*`
- `contrib_auth_{n}_*`
- `current_contrib_auth_{n}_author_pid`

This is the first implemented adapter, not the strategic destination order.
Near-term coverage priority is bioRxiv/medRxiv, eLife, then broader real-world
Nature/eJournalPress validation. New adapters still require anonymized fixture
evidence before selectors are implemented.

## Non-goals (v0)

- Automating final submission or legal attestations
- Storing or transmitting passwords / cookies / tokens
- Writing back to Google Sheets
- Broad web scraping of unrelated page content
- Payments / entitlement enforcement (interface only until fill flow is reliable)

## Success criteria

- A user can import a roster, preview fills on Nature MTS, fill without overwriting linked conflicting identities, and see a clear validation summary — without the extension ever submitting the manuscript.
