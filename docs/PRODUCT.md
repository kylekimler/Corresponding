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

## Supported platform adapters

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
- Payments / entitlement enforcement (interface only until fill flow is reliable)

## Success criteria

- A user can import a roster, preview fills on Nature MTS, fill without overwriting linked conflicting identities, and see a clear validation summary — without the extension ever submitting the manuscript.
