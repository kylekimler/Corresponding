# Backlog

Status key: `[ ]` todo · `[~]` in progress · `[x]` done · `[!]` blocked

## Milestone 1 — Scaffold

- [x] Initialize WXT + React + TypeScript + Vitest + Zod project
- [x] Document product, privacy, schema, roadmap, agents guide
- [x] Popup builds as Chrome MV3 with `activeTab` + `storage` + `scripting` only
- [x] `npm test`, `npm run typecheck`, `npm run build` pass

## Milestone 2 — Nature MTS adapter

- [x] Formal adapter interface (`detect`, `inspect`, `fill`, `validate`)
- [x] Synthetic Nature MTS DOM fixture
- [x] Corresponding author at begin/middle/end
- [x] Roster sizes 1, 10, 75, 200
- [x] Missing emails, country select, blank fields
- [x] Overwrite false/true; linked-author conflicts
- [x] Unicode names; primary affiliation among multiple
- [x] Mismatched `num_authors`
- [x] Assert submit/certify controls never clicked

## Milestone 3 — Import

- [x] Robust CSV parser (quoting, Unicode)
- [x] Column mapping with common aliases
- [x] Ambiguous mappings require user confirmation

## Milestone 4 — Local rosters

- [x] Create / rename / import / edit / reorder / delete / duplicate (storage API)
- [x] Export JSON and CSV (storage API)
- [x] Schema version + migration hook
- [ ] Popup UI for rename / delete / duplicate / export / author edit / reorder

## Milestone 5 — Google Sheets

- [x] Read-only client abstraction + mocks
- [x] URL parse + tab selection (client API)
- [x] Setup docs for OAuth client ID
- [ ] Popup UI for paste URL + tab select (uses mock until credentials)
- [!] Production OAuth credentials (requires Kyle)

## Milestone 6 — UX

- [x] Preview + Fill flow in popup
- [x] Structured fill/validate summary
- [x] Clear non-submission messaging
- [ ] Richer conflict/missing-field drill-down list in popup

## Milestone 7 — Diagnostics

- [x] Form metadata extractor with redaction
- [x] Copy-friendly diagnostic report

## Milestone 8 — Platform architecture

- [x] Adapter registry + detection
- [x] Stubs: ScholarOne, Editorial Manager, generic eJournalPress
- [x] Unsupported → diagnostic report (no silent failure)

## Milestone 9 — Commercial readiness

- [x] CWS permission explanation
- [x] Threat model
- [x] Release checklist + versioning strategy
- [x] React error boundary
- [x] Entitlement check interface (no payments yet)
- [x] Privacy policy draft

## Blockers requiring Kyle

1. Google OAuth client ID / Chrome Web Store item ID for Sheets read-only import.
2. Real Nature MTS / eJournalPress HTML capture from a live submission session (synthetic fixture covers observed IDs; live confirmation still valuable).
3. Real DOM fixtures before implementing ScholarOne / Editorial Manager selectors.

## Next three highest-value tasks

1. Popup roster management UI (rename/delete/duplicate/export + author edit/reorder).
2. Google Sheets import UI wired to the existing client abstraction (mockable without credentials).
3. Capture/validate against a real Nature MTS DOM HTML fixture from Kyle.
