# Roadmap

## Milestone 1 — Make the scaffold real

Install deps; WXT MV3 React popup builds; `npm test`, `typecheck`, `build` pass; local-first permissions.

## Milestone 2 — Harden the Nature MTS adapter

Formal adapter interface; realistic DOM fixture; corresponding-author positions; roster sizes 1/10/75/200; missing emails; country select; blank fields; overwrite true/false; linked-author conflicts; Unicode names; primary affiliation; mismatched `num_authors`; never click submit controls.

## Milestone 3 — Improve the import layer

Robust CSV (quoting + Unicode); canonical schema; column-mapping UI with common headings; no silent ambiguous guesses.

## Milestone 4 — Local saved rosters

Extension storage CRUD: create, rename, import, edit author, reorder, delete, duplicate, export JSON/CSV.

## Milestone 5 — Google Sheets (read-only)

Chrome Extension OAuth compatible; minimum Sheets read-only scope; paste URL + select tab; normalize to Author schema; no write access. If credentials unavailable: abstraction + mocks + docs + blocker.

## Milestone 6 — User experience

Popup shows platform, roster, counts, corresponding author, missing fields, conflicts, fill/preserve/unmap plans; Preview + Fill; post-fill validation summary; never imply manuscript submitted.

## Milestone 7 — Adapter development tools

Diagnostic utility extracting form metadata (tag, type, id, name, label, options, category) with values redacted; never collect passwords/auth fields.

## Milestone 8 — Platform architecture

Adapter registration + detection; empty stubs for ScholarOne, Editorial Manager, generic eJournalPress; unsupported platforms return diagnostic reports.

## Milestone 9 — Commercial readiness

Privacy draft, CWS permission explanation, threat model, release checklist, versioning, error boundary, local roster schema migrations; entitlement interface without payments; no PII analytics.

## Founder-context opportunities

### Now

1. Complete first-run success with a one-click sample roster: empty popup → sample → Preview → Fill → validate.
2. Persist the last-selected roster locally so repeated submission work resumes without re-selection.
3. Add author-block confidence/evidence to Preview without permitting low-confidence mutation.
4. Wire the existing counts-only audit log to local extension storage and keep it clearable.
5. Decide and implement safe local XLSX parsing, preserving explicit mapping confirmation.

### Soon

- Investigate bioRxiv/medRxiv and eLife through public research and redacted fixture capture; implement only after fixture evidence.
- Validate Nature/eJournalPress against a real anonymized capture and expand only tested platform-family patterns.
- Add collaborator/project readiness concepts incrementally after the Fill workflow is dependable.
- Improve coverage on popup browser bridges, migrations, redaction, DOM chaos, and large-roster edge cases.
- Enable Google Picker/read-only import after developer OAuth credentials exist; never expose credentials to users.

### Later

- Reusable Corresponding Profile with freshness and provenance.
- Projects/Teams, reusable groups, and requests for missing collaborator information.
- Lab and institutional coordination workflows.
- Publisher/platform APIs based on trusted submission-ready metadata.
- A contribution-aware Corresponding Graph earned through useful workflows.

### Explicitly deferred

- Public scientist search or recruitment marketplace.
- Cloud graph infrastructure before workflow-generated data justifies it.
- Elaborate billing and publisher enterprise/OEM work.
- Speculative AI filling or automatic low-confidence mutations.
- Generalized frameworks without a testable user-visible vertical slice.
