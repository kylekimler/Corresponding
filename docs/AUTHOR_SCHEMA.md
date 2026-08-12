# Author Schema (Canonical)

Platform-independent scholarly author metadata. All imports normalize into this model. Adapters map from this model to portal-specific fields.

## Author

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | string (uuid) | yes | Stable local id |
| `givenName` | string | yes | First / given name |
| `middleName` | string | no | |
| `familyName` | string | yes | Last / family name |
| `email` | string (email) | recommended | Missing email is a validation warning |
| `orcid` | string | no | ORCID iD, normalized when present |
| `isCorresponding` | boolean | yes | Exactly one corresponding author recommended |
| `affiliations` | Affiliation[] | yes (may be empty) | Ordered; one may be marked primary |
| `sequence` | positive int | yes | 1-based author order in the roster |

## Affiliation

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `institution` | string | yes if affiliation present | Organization / institution name |
| `department` | string | no | |
| `city` | string | no | |
| `state` | string | no | |
| `country` | string | no | Prefer ISO-ish display names matching portal selects when known |
| `isPrimary` | boolean | yes | Exactly one primary per author when affiliations exist |

## Roster

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | string (uuid) | yes | |
| `name` | string | yes | User-visible roster name |
| `authors` | Author[] | yes | Ordered by `sequence` |
| `schemaVersion` | number | yes | For local migrations |
| `createdAt` | ISO datetime | yes | |
| `updatedAt` | ISO datetime | yes | |
| `source` | enum | yes | `manual` \| `csv` \| `google_sheets` \| `json` \| `duplicate` |

## Common import column aliases

Recognized headings (non-exhaustive; mapping UI must show final mapping):

- Given name: `First name`, `First Name`, `given_name`, `Given Name`, `first`
- Family name: `Last name`, `Last Name`, `Family name`, `family_name`, `surname`
- Email: `Email`, `E-mail`, `email_address`
- ORCID: `ORCID`, `ORCID iD`, `orcid_id`
- Institution: `Institution`, `Affiliation`, `Affiliation 1`, `Organization`, `org`
- City: `City`
- Country: `Country`
- Middle: `Middle name`, `Middle Name`, `middle_name`
- Corresponding: `Corresponding`, `Corresponding Author`, `is_corresponding`

**Never silently guess an ambiguous column mapping.** Show the mapping to the user and require confirmation when confidence is not unique.

## Identity schema v2 (optional expansions)

`schemaVersion: 2` (`IDENTITY_SCHEMA_VERSION`) extends the v1 roster with optional per-author metadata. Adapters and local roster storage continue to use v1 `Author` records (`ROSTER_SCHEMA_VERSION = 1`).

Bridges in `src/schema/migrate.ts`:

- `fromSimpleRoster(roster)` → `IdentityDocument`
- `toSimpleRoster(identityDoc)` → `Roster` (strips v2-only fields)
- `exportIdentityV2Json` / `importIdentityV2Json` for portable v2 JSON

Optional v2 fields (all optional on `IdentityAuthor`):

| Area | Fields |
|------|--------|
| Names | `preferredPublicationName`, `alternateNames[]` |
| Emails | `emails[]` with `type`, `verificationStatus`, `validFrom`/`validTo`, `provenance` |
| Affiliations | v1 fields plus `startDate`, `endDate`, `provenance` |
| Identifiers | `externalIdentifiers[]` (ORCID, Scopus, etc.) |
| Funding | `funding[]` grant records |
| Ethics | `disclosures[]` |
| Contributions | `creditRoles[]` (CRediT enum) |
| Works | `works[]` publication references |
| Teams | `teamMemberships[]` |

Provenance (`src/schema/provenance.ts`): each externally sourced assertion may carry `source`, `timestamp`, `verificationStatus` (`unverified` \| `self_attested` \| `externally_verified`), and optional `note`. Defaults are `unverified`; never infer `externally_verified`.
