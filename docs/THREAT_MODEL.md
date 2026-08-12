# Threat Model (v0)

## Assets

- Author PII in local rosters (names, emails, affiliations, ORCID)
- Integrity of manuscript submission forms (wrong fill is a serious failure)
- User trust that the extension will not submit/certify/pay

## Trust boundaries

1. Extension popup / service worker / content script (our code)
2. Active tab DOM (publisher portal)
3. Chrome storage (local)
4. Optional Google Sheets API (read-only, user-authorized)
5. No journal-autofill backend for author data

## Threats and mitigations

| Threat | Mitigation |
|--------|------------|
| Extension submits manuscript | Hard forbid list (normalized snake/camel case); adapters never click submit/certify/pay/sign; tests spy on `click` |
| Overwriting linked portal identity | Detect linked PID; refuse fill on identity conflict including missing roster email; corresponding block also skipped |
| Silent roster wipe on bad data | `migrateRosterSafe` salvages/quarantines; `save` validates and throws |
| Silent wrong column mapping | Mapping UI; ambiguous headers require confirmation |
| Broad page data exfiltration | `activeTab` only; inject only http(s); diagnostics redact labels/options/URL hash; fail-closed `redactionComplete` |
| Credential theft | Never read password fields; diagnostics categorize as `auth_secret` |
| Malicious extension messages | Zod-validated `ExtensionRequest` in content script before fill |
| CSV formula injection on export | Neutralize leading `=+-@` on export; denature on import for round-trip |
| Sheets error PII leak | Sanitize API status to safe UI strings; never surface response bodies |
| Writing disabled portal fields | `setValue` skips `disabled` / `readOnly` |
| Remote code compromise | No remotely hosted executable fill logic |
| Sheets write / over-scope | Read-only scope only; write APIs absent |
| PII to analytics | No PII analytics pipeline |
| Supply-chain / dependency | `npm audit`; Semgrep CE; ESLint security; Gitleaks; pin/review permissions |

## Out of scope (v0)

- Compromised publisher origin itself
- User intentionally pasting secrets into roster fields
- Full Chrome extension store review process (see release checklist)
