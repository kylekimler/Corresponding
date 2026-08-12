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
| Extension submits manuscript | Hard forbid list; adapters never click submit/certify/pay/sign; tests spy on `click` |
| Overwriting linked portal identity | Detect `author_pid`; refuse fill on identity conflict |
| Silent wrong column mapping | Mapping UI; ambiguous headers require confirmation |
| Broad page data exfiltration | `activeTab` only; diagnostics redact values; no unrelated history |
| Credential theft | Never read password fields; diagnostics categorize as `auth_secret` |
| Remote code compromise | No remotely hosted executable fill logic |
| Sheets write / over-scope | Read-only scope only; write APIs absent |
| PII to analytics | No PII analytics pipeline |
| Supply-chain / dependency | Pin versions; review permissions on each change |

## Out of scope (v0)

- Compromised publisher origin itself
- User intentionally pasting secrets into roster fields
- Full Chrome extension store review process (see release checklist)
