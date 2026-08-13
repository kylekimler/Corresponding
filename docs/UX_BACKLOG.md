# UX backlog (adversarial review)

Prioritized friction for a first-time scientist. Status: `[ ]` open · `[x]` fixed this run.

## First install / open

- [x] Rename user-facing product to **Corresponding** (popup, manifest, error boundary)
- [x] Lead with purpose line: “Giving scientists more time to do science.”
- [x] Compact primary popup (portal → roster → Preview/Fill)
- [x] Onboarding sample roster one-click import

## First roster import

- [x] Unified **Import authors** flow (paste / CSV / Excel stub / Sheets chooser)
- [x] Paste from spreadsheet (TSV) with mapping confirmation
- [x] Drag-and-drop CSV + filename / row count
- [x] Ambiguous columns require explicit confirmation
- [x] Show a data preview beside mapping selects
- [x] Friendlier empty roster CTA: “Import authors”
- [x] No OAuth / client-ID errors on the scientist-facing UI

## Selecting a saved roster

- [x] Status: ready · need attention · conflicts
- [x] Attention-first list (ready authors collapsed)
- [x] Read-only imported-author review with issue summary and full list
- [x] Persist last-selected roster id across popup opens

## Preview

- [x] Preview is primary and shows a clear result card
- [x] Exact / semantic / preserved / unresolved / conflicts counts
- [x] Dry-run never mutates the form (tested)
- [x] Detection errors no longer stick forever on “Checking…”
- [x] Group preview by author block with confidence badges

## Unresolved fields

- [x] Unknown portal shows structured failure / unsupported state
- [ ] Inline “why unresolved” tooltips from evidence array

## Fill / validation

- [x] Fill disabled on unknown portal
- [x] Optional Preview guidance near Fill; direct Fill still performs internal preflight
- [x] Post-fill validation summary + “not submitted” message
- [ ] Toast-style confirmation with counts only (no PII)

## Advanced

- [x] Diagnostics moved under Advanced (not in main fill workflow)
- [x] Redaction safeguards preserved

## Scientist review checklist (2026-08-12)

| Question | Result |
|----------|--------|
| Obvious first action with no roster? | Yes — Import authors |
| Developer details exposed? | No OAuth/API keys in product UI |
| Spreadsheet → filled form without docs? | Paste or CSV → Preview → Fill |
| Popup feels small? | Compact main view; manage/import secondary |
