# Privacy Policy (Draft)

**Product:** Corresponding
**Status:** Draft for development and Chrome Web Store preparation  
**Last updated:** 2026-08-25

## Summary

Corresponding is a local-first browser extension. There is no Corresponding
account and no trial. Author roster data stays on your device by default. The
extension does not transmit author personally identifiable information (PII)
to a Corresponding backend.

## Data we process locally

On your device, the extension may store:

- Saved author rosters (names, emails, affiliations, ORCID, corresponding-author flags, and related scholarly metadata you import or enter)
- Structured author/project metadata extracted locally from a user-selected
  DOCX author table. Full manuscript prose is not retained.
- Column-mapping preferences for CSV/Sheets imports
- Extension settings (e.g., overwrite preference)
- A local count of authors filled on this device, used only to estimate
  lifetime researcher hours saved. Sample authors and development fixtures
  are not counted.

Storage uses Chrome extension local storage APIs.

The optional corresponding.app website keeps a manuscript draft in the
browser (`localStorage`) and may send that roster only to the installed
Corresponding extension on the same device. It does not create an account
and does not upload author information to a Corresponding server.

## Data we do not collect

The extension does **not** intentionally read, store, or transmit:

- Passwords
- Cookies
- Authentication tokens for journal portals
- Unrelated browsing history
- Unrelated page content outside the active submission form interaction
- Manuscript text (unless a future explicit, user-initiated feature requires it — not present in v0)

## Network activity

- Form filling runs in the active tab using on-demand scripting (`activeTab`). Author names, emails, affiliations, and manuscript text are not sent to a Corresponding server.
- After an eligible Fill (not sample authors, not development fixtures), the extension may POST `{ "v": 1, "authors": N }` to the Corresponding hours counter so we can estimate community hours saved for marketing. That request contains no names, emails, ORCID, roster identifiers, page URLs, or manuscript text. It cannot break Fill if it fails.
- DOCX parsing runs locally in the extension. The selected file is not uploaded
  to Corresponding.
- Optional Google Sheets import (when configured) uses Chrome Identity OAuth with the minimum Google Sheets **read-only** scope to fetch sheet rows you explicitly select. Those rows are normalized locally into the author schema. No write access to Google Sheets is requested.
- The extension does not load remotely hosted executable code for its fill logic.

## Permissions

Typical permissions:

- `activeTab` — interact with the current tab when you invoke the extension
- `storage` — save rosters and settings locally
- `scripting` — inject the fill/inspect logic into the active tab on demand

No broad host permissions are required for Nature MTS filling.

## Human-in-the-loop safety

The extension never clicks final submission, certification, copyright acceptance, conflict-of-interest attestations, payment, signatures, or reviewer invitations. You remain responsible for reviewing filled fields and completing legal/submission steps.

## Third parties

- Journal submission portals receive only the form values you choose to fill into their pages (same as manual entry).
- Google (optional Sheets import) receives OAuth consent and read requests for sheets you authorize.
- There is no analytics pipeline that transmits author PII.
- Lifetime hours in the popup footer are a local estimate on this device.
  A separate privacy-safe increment (author count only) updates the
  community hours total used for marketing.

## Contact

For privacy questions, contact the maintainer listed in the Chrome Web Store listing (to be filled before publication).

## Changes

Material changes to this policy will be reflected in this document and the store listing before release.
