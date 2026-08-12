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
npm test
npm run typecheck
npm run build
npm run lint:security
npm run semgrep
npm run security          # lint + semgrep + npm audit
gitleaks detect --source . --no-git
```
