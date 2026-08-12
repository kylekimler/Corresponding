# Security & debugging tooling

## Decision (2026-08-12)

For this Chrome MV3 / TypeScript extension, the best open-source stack is:

| Layer | Tool | Why |
|-------|------|-----|
| Primary SAST | **Semgrep CE** | Industry-standard OSS rule engine; fast CI; JS/TS + security-audit rulesets |
| Lint-time security | **ESLint + eslint-plugin-security** | Instant local feedback; catches `eval`, unsafe regex, child_process patterns |
| Dependencies | **npm audit** | Supply-chain CVEs in the lockfile |
| Secrets | **Gitleaks** | Catches accidental credential commits |
| Runtime/unit | **Vitest + jsdom + fast-check** | Product edge cases Semgrep cannot see (DOM fill safety, PII redaction plants) |

### Considered but not adopted as primary

- **CodeQL** — excellent deep taint analysis; best as a GitHub Actions add-on when available. Heavier than Semgrep for local iteration.
- **SonarQube / Snyk Code** — strong, but commercial for full features.
- **Stryx / AEGIS** — promising stack-specific scanners; oriented to Node/Next backends, not MV3 extensions.

## Commands

```bash
# Always install from the repository root (not `.output/`).
git pull origin main
rm -rf node_modules
npm install
npm audit                 # expect: found 0 vulnerabilities (WXT >= 0.21.4)

npm test
npm run typecheck
npm run build
npm run lint:security
npm run semgrep
npm run security          # lint + semgrep + npm audit
gitleaks detect --source . --no-git
```

## Dependency baseline

`wxt` is pinned to **0.21.4** (exact). Older trees (e.g. `0.19.29`) report multiple critical/high CVEs via transitive deps (`node-forge`, `happy-dom`, etc.). If `npm install` still prints `WXT 0.19.x`, the checkout is stale or `node_modules`/`package-lock.json` was not refreshed from `main`.
