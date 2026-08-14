# Adding a journal or platform

Most journals do not need a TypeScript adapter. Add a file under `sites/`.

## Tiny declarative site (preferred)

1. Capture a redacted author-form screenshot or fixture. Do not guess IDs.
2. Copy `sites/_example-society.json` to `sites/<your-journal>.json`.
3. Put the real element IDs in `detect` and `authors.fields`. `{n}` is the
   1-based author slot.
4. Set `"autofill": true` only after those IDs exist on a fixture.
5. If this publisher is on the README scoreboard, move the row to ✅ in
   `src/compatibility/catalog.ts` (the catalog test fails if they drift).
6. Run `npm test`, `npm run typecheck`, `npm run build`.

Site files may only name element IDs. No CSS selectors, XPath, or click
actions. Corresponding never clicks submit, certify, pay, or sign.

`sites/scholarone.json` and `sites/editorial-manager.json` are detect-only
until a redacted fixture exists. Do not invent their field IDs.

## When you still need TypeScript

Repeated dialogs, directory lookups, or other multi-step widgets (bioRxiv)
stay in `src/adapters/<platform>/`. Then:

1. Place an anonymized fixture under `fixtures/corpus/`.
2. Copy `src/adapters/_template/adapter.ts`.
3. Implement `detect`, `inspect`, `fill`, `validate`.
4. Register the adapter next to `loadSiteAdapters()` in
   `src/adapters/registry.ts`.
5. Add `tests/adapters/<platform>.contract.test.ts`.

## Confidence rules

- Exact tested selectors → confidence 1.0
- Platform patterns → ~0.95
- Semantic labels alone → fill only if ≥ 0.8 and author groups are fill-safe
- Ambiguous / structural guesses → unresolved (Preview only)

## Safety

Never click submit/certify/payment/signature controls. Never read passwords or auth tokens. Default preserve non-empty fields.
