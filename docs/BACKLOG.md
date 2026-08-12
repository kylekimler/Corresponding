# Backlog

Status key: `[ ]` todo · `[~]` in progress · `[x]` done · `[!]` blocked (external)

## Prior milestones (extension core)

- [x] Scaffold, Nature MTS adapter, CSV import, local rosters, Sheets abstraction, diagnostics, stubs, commercial docs

## Overnight reliability tracks

### Recognition & safety
- [x] A — Generic semantic form recognizer (deterministic, no LLM)
- [x] B — Repeated author-group detection + layout fixtures
- [x] H — Explicit confidence model + fill threshold
- [x] C — Property-based roster stress (fast-check)
- [x] D — DOM chaos harness + `reports/chaos-report.json`
- [x] E — Shared adapter contract suite (Nature MTS opted in)
- [x] F — Compatibility capture + redaction tests
- [x] G — Fixture corpus + replay metrics
- [x] O — Explicit failure states catalog

### Data model & privacy
- [x] I — Identity schema v2 + migrate bridges (v1 adapters unchanged)
- [x] J — Provenance model (never auto-claim external verification)
- [x] M — Local audit trail (counts only, clearable)

### UX / product
- [x] K — Corresponding branding + design tokens + popup hierarchy
- [x] L — UX adversarial review → `docs/UX_BACKLOG.md`
- [x] N — Perf benchmarks with generous thresholds
- [x] P — DX scripts + adapter template + `docs/ADDING_AN_ADAPTER.md`
- [x] Q — Public platform research notes (`docs/PLATFORM_RESEARCH.md`)
- [ ] R — Coverage report review / raise on high-risk gaps (run `npm run test:coverage`)

## Local remaining (not blocked)

- [ ] Empty-state CTA + one-click sample roster import
- [ ] CSV mapping data preview (3 rows)
- [ ] Confidence badges in Preview (exact vs semantic)
- [ ] Persist last-selected roster id
- [ ] Wire audit log to chrome.storage in popup (memory log exists)
- [ ] Optional visual regression for popup tokens

## External validation (true blockers)

- [!] Google OAuth client ID for Sheets read-only
- [!] Real Nature MTS HTML capture to validate synthetic IDs
- [!] Real ScholarOne / Editorial Manager fixtures before selectors

## Security / quality (post PR #1)

- [x] Clear npm audit CVEs (WXT upgrade)
- [x] Semgrep CE + ESLint security + Gitleaks baseline (0 findings)
- [x] Roster wipe / linked-PID / corr-conflict / diagnostic redaction hardening
- [ ] Optional CodeQL workflow on GitHub (if Advanced Security available)
- [ ] Raise coverage on popup chrome bridges

## Next five highest-value tasks

1. Empty-state + sample import (first-run UX)
2. Preview confidence badges (exact / semantic / unresolved)
3. Raise coverage on migrate + capture redaction edge cases
4. Enable Sheets when OAuth credentials arrive
5. Add live Nature MTS regression fixture when Kyle captures HTML
