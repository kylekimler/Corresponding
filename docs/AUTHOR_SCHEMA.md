# Author Schema (Canonical)

Platform-independent scholarly author metadata. All imports normalize into this model. Adapters map from this model to portal-specific fields.

## Author

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | string (uuid) | yes | Stable local id |
| `givenName` | string | yes | First / given name |
| `middleName` | string | no | |
| `familyName` | string | yes | Last / family name |
| `namePrefix` | string | no | Honorific / Prefix (Dr., Prof., Mx). Required to save on ScholarOne Bioinformatics Create New Author |
| `email` | string (email) | recommended | Missing email is a validation warning |
| `orcid` | string | no | ORCID iD, normalized when present |
| `isCorresponding` | boolean | yes | Multiple shared corresponding authors are allowed |
| `equalContribution` | boolean | yes | Shared/co-first or equally contributing author. Canonical only: not filled into any portal without fixture evidence |
| `creditRoles` | CreditRole[] | yes (may be empty) | CRediT contributor roles. Editorial Manager refuses to save an author without at least one |
| `affiliations` | Affiliation[] | yes (may be empty) | Ordered; one may be marked primary |
| `sequence` | positive int | yes | 1-based author order in the roster |

## Affiliation

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `institution` | string | yes if affiliation present | Organization / institution name |
| `department` | string | no | |
| `city` | string | no | |
| `state` | string | no | |
| `postalCode` | string | no | Required by Editorial Manager's author form |
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
| `source` | enum | yes | `manual` \| `sample` \| `csv` \| `docx` \| `google_sheets` \| `json` \| `duplicate` \| `web` |
| `projectMetadata` | object | no | Project-level funding/support and disclosure statements imported with the roster |

### Project metadata

Project-level statements are not attributed to an individual author:

| Field | Type | Notes |
|-------|------|-------|
| `fundingStatements` | string[] | Unique non-empty support/funding statements from mapped columns |
| `disclosureStatements` | string[] | Unique non-empty conflict/competing-interest/disclosure statements |

Adapters may map these only when fixture evidence identifies the corresponding
journal fields. Importing them does not authorize certification or legal
attestation.

## Common import column aliases

Recognized headings (non-exhaustive; mapping UI must show final mapping):

- Prefix: `Prefix`, `Salutation`, `Name prefix`, `Honorific`
- Given name: `First name`, `First Name`, `given_name`, `Given Name`, `first`
- Family name: `Last name`, `Last Name`, `Family name`, `family_name`, `surname`
- Email: `Email`, `E-mail`, `email_address`
- ORCID: `ORCID`, `ORCID iD`, `orcid_id`
- Institution: `Institution`, `Affiliation`, `Affiliation 1`, `Organization`, `org`
- City: `City`
- Country: `Country`
- Middle: `Middle name`, `Middle Name`, `middle_name`
- Corresponding: `Corresponding`, `Corresponding Author`, `is_corresponding`
- Equal contribution: `Equal contribution`, `Co-first author`, `Shared first author`
- Funding: `Support/Funding Statement`, `Funding Statement`, `Funding`
- Disclosure: `Conflicts of Interest`, `Competing Interests`, `Disclosure Statement`

**Never silently guess an ambiguous column mapping.** Show the mapping to the user and require confirmation when confidence is not unique.

## Identity schema v2 (optional expansions)

`schemaVersion: 2` (`IDENTITY_SCHEMA_VERSION`) extends the v1 roster with optional per-author metadata. Adapters and local roster storage continue to use v1 `Author` records (`ROSTER_SCHEMA_VERSION = 1`).

Bridges in `src/schema/migrate.ts`:

- `fromSimpleRoster(roster)` → `IdentityDocument`
- `toSimpleRoster(identityDoc)` → `Roster` (strips v2-only fields)
- `exportIdentityV2Json` / `importIdentityV2Json` for portable v2 JSON

Optional v2 fields (on `IdentityPerson` inside `IdentityDocument.people`):

| Area | Fields |
|------|--------|
| Names | `preferredPublicationName`, `alternateNames[]` |
| Emails | `emails[]` with `value`, `type`, `verificationStatus`, `validFrom`/`validTo`, `provenance` |
| Affiliations | `datedAffiliations[]` with start/end + provenance |
| Identifiers | `identifiers[]` (`system`: orcid, ror, …) |
| Funding | `funding[]` grant records |
| Ethics | `disclosures[]` |
| Contributions | `creditRoles[]` (CRediT enum) |
| Works | `works[]` publication references |
| Teams | `teamMemberships[]` |

Provenance (`src/schema/provenance.ts`): each externally sourced assertion may carry `source`, `timestamp`, `verificationStatus` (`unverified` \| `self_attested` \| `externally_verified`), and optional `note`. Defaults are `unverified`; never infer `externally_verified`.

## CRediT contributor roles

`src/schema/credit.ts` holds the 14-role taxonomy plus an `other` catch-all.
`parseCreditRoles` reads spreadsheet cells listing several roles, tolerating
en dashes, ampersands, and common shorthands. Unrecognized text is dropped
rather than guessed, so a roster never claims a role an author did not declare.

## Portal requirements

`src/adapters/requirements.ts` declares, per portal and only from captured
forms, which canonical fields that portal refuses to save without. Adapters
report unmet requirements on the fill report so the popup can name the field and
the affected authors. Requirements are reported, not enforced: Corresponding
still fills what the portal accepts.
