# Backlog

Status key: `[ ]` todo · `[~]` in progress · `[x]` done · `[!]` blocked

## Milestone 1 — Scaffold

- [x] Initialize WXT + React + TypeScript + Vitest + Zod project
- [x] Document product, privacy, schema, roadmap, agents guide
- [x] Popup builds as Chrome MV3 with `activeTab` + `storage` + `scripting` only
- [x] `npm test`, `npm run typecheck`, `npm run build` pass

## Milestone 2 — Nature MTS adapter

- [x] Formal adapter interface (`detect` / `inspect` / `fill` / `validate`)
- [x] Synthetic Nature MTS DOM fixture (+ `fixtures/nature-mts-sample.html`)
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

- [x] Create / rename / import / edit / reorder / delete / duplicate
- [x] Export JSON and CSV
- [x] Schema version + migration hook
- [x] Popup UI for rename / delete / duplicate / export / author edit / reorder

## Milestone 5 — Google Sheets

- [x] Read-only client abstraction + mocks
- [x] URL parse + tab selection
- [x] Setup docs for OAuth client ID
- [x] Popup UI for paste URL + tab select (enabled only when configured)
- [!] Production OAuth credentials (requires Kyle)

## Milestone 6 — UX

- [x] Preview + Fill flow in popup
- [x] Structured fill/validate summary
- [x] Clear non-submission messaging
- [x] Conflict / missing-field drill-down lists in popup

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

## Remaining / follow-ups

- [ ] Wire production Sheets OAuth after Kyle provides client ID
- [ ] Validate Nature MTS adapter against live HTML capture
- [ ] Implement ScholarOne / EM only after real fixtures arrive
- [ ] Optional: add author “add row” UI for empty manual rosters
- [ ] Optional: zip packaging + store listing assets

## Blockers requiring Kyle

See `docs/BLOCKERS.md`.

## Next three highest-value tasks

1. Obtain Google OAuth client ID and enable Sheets import end-to-end.
2. Capture a real Nature MTS author-form HTML (redacted) and add as a regression fixture.
3. Collect ScholarOne or Editorial Manager diagnostic reports from real sessions before writing selectors.
