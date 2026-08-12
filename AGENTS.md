# AGENTS.md — journal-autofill

Instructions for autonomous coding agents working on this repository.

## Product in one sentence

A scientist maintains one canonical author roster and uses it to fill manuscript submission forms across journal platforms — without ever automating final submission, certification, payment, or legal actions.

## Before changing code

Read, in order:

1. `README.md`
2. `AGENTS.md` (this file)
3. `docs/ROADMAP.md`
4. `docs/BACKLOG.md`
5. `docs/PRODUCT.md`
6. `docs/PRIVACY.md`
7. `docs/AUTHOR_SCHEMA.md`

Then inspect `docs/DEVLOG.md` for the latest iteration state.

## Hard safety constraints

Never automate or click:

- final submission
- certification
- copyright acceptance
- conflict-of-interest attestations
- payment
- signatures
- reviewer invitations

Never read or store:

- passwords
- cookies
- authentication tokens
- unrelated browsing history
- unrelated page content
- manuscript text unless a future explicit feature requires it

Do not transmit author PII to a backend. Local processing by default.

Prefer `activeTab` and the narrowest possible Chrome permissions.

Do not introduce remotely hosted executable code.

Do not guess selectors for a submission platform when no real DOM fixture exists.

## Architecture rules

- TypeScript, WXT, React, Manifest V3, Zod, Vitest, jsdom.
- Canonical scholarly-data model is platform-independent (`src/schema`).
- All portal-specific logic lives behind adapters (`src/adapters`).
- Adapter operations: `detect`, `inspect`, `fill`, `validate`.
- Adapters return structured reports, not UI strings.
- DOM mutation is deterministic.
- Every fill must be capable of a dry-run report.
- Default: preserve existing non-empty fields.
- Overwrite only when the user explicitly chooses it.
- Refuse to overwrite linked portal author accounts when identity conflicts.

## Development loop

1. Inspect repository state.
2. Read `docs/BACKLOG.md`.
3. Choose the highest-priority unfinished task completable with available information.
4. Make the smallest coherent implementation.
5. Add or update tests.
6. Run `npm test`, `npm run typecheck`, `npm run build`.
7. Fix every failure caused by the change.
8. Manually review security implications and browser permissions.
9. Commit with a concise message.
10. Append an entry to `docs/DEVLOG.md`.
11. Continue.

Do not stop merely because one milestone is complete.

Do not repeatedly refactor working code without a user-visible or reliability benefit.

Do not create speculative platform adapters from generic web knowledge.

If blocked, document the blocker and proceed to an independent item.

## Permissions philosophy

- Default permissions: `activeTab`, `storage`, `scripting`.
- No broad host permissions for form filling.
- Google Sheets OAuth (when enabled) uses minimum read-only Sheets scope and does not require a backend for author data.
- Never ship fake OAuth credentials.

## Quality bar

A wrong author name, email, order, or affiliation is a serious product failure.

Favor deterministic software over AI guesses for form filling.

Validation is a first-class feature.

The commercial moat is reliable platform adapters, test fixtures, canonical scholarly metadata, and an audit trail.
