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

**ScholarOne Manuscripts** and **Editorial Manager** are the first-priority
platform families. Adapters match official vendor field **labels** and workflow
chrome (Authors & Institutions / Create New Author; Manuscript Data / Enter
Author Details). They fill author identity fields and, when present on a later
step, conflict-of-interest **text**. They never click Search-to-attach-account,
Save and Continue, Proceed, Build PDF, Approve Submission, or COI
certification/attestation.

Nature MTS / eJournalPress, based on observed DOM field IDs such as:

- `num_authors`
- `corr_auth_*`
- `contrib_auth_{n}_*`
- `current_contrib_auth_{n}_author_pid`

Nature MTS was the first implemented adapter. Coverage priority is now
ScholarOne and Editorial Manager (largest submission managers), then live
bioRxiv/medRxiv validation and eLife fixture capture. New exact-ID selectors
still require anonymized fixture evidence; these two families use documented
labels rather than guessed live IDs.

bioRxiv/medRxiv author entry is now implemented from redacted live structural
captures as a repeated-modal workflow. It fills and saves author dialogs only;
it refuses pages that already contain author rows and never clicks page
continuation or submission controls. Automated fixture verification is complete;
live smoke validation remains pending.

## Non-goals (v0)

- Automating final submission or legal attestations
- Storing or transmitting passwords / cookies / tokens
- Writing back to Google Sheets
- Broad web scraping of unrelated page content
- Payments / entitlement enforcement (interface only until fill flow is reliable)

## Success criteria

- A user can import a roster, preview fills on Nature MTS, fill without overwriting linked conflicting identities, and see a clear validation summary — without the extension ever submitting the manuscript.
