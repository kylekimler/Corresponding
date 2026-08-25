# Product

## Name

Corresponding

## Problem

Stop entering 74 authors into journal submission forms by hand. Scientific
manuscript portals force repetitive, error-prone re-entry of author metadata
(names, emails, affiliations, ORCID, corresponding-author flags). Large
collaborations amplify a universally hated form.

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
9. After a successful fill, tells the scientist how many authors were filled
   and how much time that gave back (about 40 seconds per author). The popup
   footer keeps a local lifetime hours estimate. Example authors and test
   fixtures are not counted. Eligible fills also increment a community
   hours total via a privacy-safe author-count ping (no PII).

## Supported platform adapters

The public scoreboard lives at the top of `README.md` and in
`src/compatibility/catalog.ts`. A publisher is ✅ only when a fixture-tested
adapter can fill the author form. Empty squares are the game: open an issue
and paste a screenshot, or PR a ~10-line file in `sites/`.

Nature MTS / eJournalPress, based on observed DOM field IDs such as:

- `num_authors`
- `corr_auth_*`
- `contrib_auth_{n}_*`
- `current_contrib_auth_{n}_author_pid`

This was the first implemented adapter, not the strategic destination order.
Near-term coverage priority is live bioRxiv/medRxiv validation, ScholarOne
(Manuscript Central) live smoke, eLife fixture capture, then broader real-world
Nature/eJournalPress validation. New adapters still require anonymized fixture
evidence before selectors are implemented.

bioRxiv/medRxiv author entry is now implemented from redacted live structural
captures as a repeated-modal workflow. It fills and saves author dialogs only;
it refuses pages that already contain author rows and never clicks page
continuation or submission controls. Automated fixture verification is complete;
live smoke validation remains pending.

ScholarOne / Manuscript Central author entry is implemented from the redacted
Bioinformatics (`mc.manuscriptcentral.com/bioinformatics`) compatibility capture.
Authors are looked up by email first (`findAuthorEmailId` + Search), then
`AUTHOR_*` fields are filled and committed with Add Author. Save and Continue,
CRediT role automation, and institution typeahead remain out of scope until
further capture evidence. Automated fixture coverage is in place; authenticated
live smoke is still required.

## Non-goals (v0)

- Automating final submission or legal attestations
- Storing or transmitting passwords / cookies / tokens
- Writing back to Google Sheets
- Broad web scraping of unrelated page content
- Accounts, trials, freemium gates, or author-count limits on fill
- A Corresponding login or backend for author PII

## Success criteria

- A user can install the extension with no account, import a roster, preview fills on Nature MTS, fill without overwriting linked conflicting identities, and see a clear validation summary — without the extension ever submitting the manuscript.
- Fill stays MIT-licensed and ungated.
