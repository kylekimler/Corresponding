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
