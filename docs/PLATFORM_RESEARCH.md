# Public platform research (planning only)

**Rule:** Do not implement selectors from screenshots, tutorials, or guesses. Real anonymized fixtures required before adapter work. The public README scoreboard may show ⬜ for a publisher people want; it may not show ✅ until this rule is met.

Research date: 2026-08-12. Based on public documentation and vendor marketing pages — not authenticated portal access.

## bioRxiv / medRxiv

- **Current status:** Capture-backed adapter implemented; synthetic modal
  fixture and automated browser journey pass. First live smoke is pending.
- **Observed workflow evidence:** Redacted closed/open captures confirm the
  `.v-dialog.v-dialog--active` editor, visible external Add Author action,
  dialog Save action, stable `firstName`/`lastName`/`affiliation` names, and
  page-level `CA_continue`.
- **Interaction shape:** Deterministic one-author-at-a-time state machine.
  Preview never opens the dialog. Fill preflights the complete roster, refuses
  pages with existing author rows, then opens, fills, and saves one dialog per
  author.
- **Email lookup:** Entering an author email triggers a directory lookup that
  re-renders the dialog and offers "fetch author data" via a FILL INFO control.
  Anything written during that window is discarded, so email must be entered
  first and the lookup must finish before the remaining fields are written.
  Corresponding never accepts the offer: it would replace roster values with the
  portal's own record.
- **Import Authors:** The page also exposes a bulk Import Authors control. That
  is the portal-supported route for large rosters and is the most promising next
  step; it needs its own redacted capture before implementation.
- **Safety:** Never save an incomplete author merely to capture the page. Never
  touch manuscript submission, certification, license, or payment controls.

## ScholarOne Manuscripts (Clarivate)

- **Terminology:** Manuscript Central, ScholarOne Manuscripts, center sites often `*.manuscriptcentral.com`.
- **Host patterns (publicly known):** `manuscriptcentral.com` and publisher-specific subdomains.
- **Public APIs:** Clarivate documents publisher/integrations at a business level; no public browser-form selector documentation suitable for autofill.
- **Integration opportunities:** Future adapter after diagnostic capture; possible institutional SSO considerations (must never touch auth tokens).
- **Notes for Corresponding:** Expect multi-step author entry; linked author accounts likely. Capture with Diagnostics on the author step only.

## Editorial Manager (Aries / Elsevier ecosystem)

- **Terminology:** Editorial Manager (EM), often branded per journal.
- **Host patterns:** Commonly `*.editorialmanager.com` (publicly referenced in journal instructions).
- **Public APIs:** Aries/EM publish system overviews for publishers; no stable public DOM contract for third-party extensions.
- **Integration opportunities:** Adapter after redacted fixture; careful with corresponding-author and affiliation widgets.
- **Notes:** Do not scrape reviewer or decision pages.

### PLOS Genetics live shell capture (2026-08-14)

A third redacted capture from `https://www.editorialmanager.com/pgenetics/default2.aspx`
was taken after clicking inside an author field in the Add New Author popup. It
was still chrome only (`RoleDropdown`, hamburger, user icon) and still lacked
`iframeSeen` lines, which means the installed build was the pre-iframe-walk
extension and the content script only saw the top document.

This is **Editorial Manager**, not ScholarOne. ScholarOne hosts are
`*.manuscriptcentral.com`. PLOS titles (ONE, Genetics, and others) use Aries
Editorial Manager. Host-family detection now labels `editorialmanager.com` as
Editorial Manager without inventing field selectors.

A fourth capture (2026-08-15) from the same PLOS Genetics URL was still the
pre-iframe-walk format (no `iframeSeen`). The installed extension is still the
old top-document build. Use the structural console probe on the Add Author
document itself (DevTools context picker, or F12 on the popup window).

If a later capture still shows only the role dropdown after all-frame injection,
the Add Author UI is likely a **separate browser window**. Capture while that
window is focused.

### PLOS ONE live shell capture (2026-08-14)

Two redacted compatibility captures from `https://www.editorialmanager.com/pone/default2.aspx`
(before and after opening “+ Add Another Author”) were **identical**. Both were
structural chrome only:

- `fieldCount: 1`, `controlCount: 2`, `authorGroupCount: 0`
- `select RoleDropdown` options `Author` / `Reviewer`
- `div hamBurger` and `div userIcon` (open-menu controls)
- No given/family/email/affiliation fields, no author groups

This is the Editorial Manager post-login role/home shell, not the author-entry
form. Opening “+ Add Another Author” did not add inputs to the top document the
diagnostic could see. Likely causes, in order:

1. Capture was not on Manuscript Data → author-entry.
2. Author fields live in a nested iframe (common for EM). The diagnostic now
   walks same-origin `iframe` / `frame` documents and reports
   `iframeSeen` / `iframeReadable` / `iframeBlocked`.
3. The add-author UI is an overlay that was not in the captured top DOM.

### PLOS ONE author-form console probe (2026-08-15)

A same-origin iframe walk from `default2.aspx` reached:

`RequiredRegistrationQuestions.aspx` (title Add/Edit/Author) with stable IDs:

- Author: `FirstName`, `MiddleName`, `LastName`, `Email`, `Affiliation`,
  `Institution`, `Department`, `City`, `State`, `CountryCode`,
  `CorrespondingAuthorCheckbox`
- Author actions: `SaveButton`, `CancelButton`, `EditButton` (image inputs)
- Same page also has manuscript editors (`txtFullTitle`, `txtAbstract`,
  CKEditor frames) and CRediT `ContributorRole_#` checkboxes — never filled
  or clicked by Corresponding
- Session query parameters (`SessionThreadIdField`) are redacted and never stored

Adapter implemented from these IDs. Do not add address/ZIP/degree/title
salutation or CRediT writes without a roster mapping and another capture.

## eJournalPress

- **Terminology:** eJournalPress (eJP); used by multiple publishers including some Nature-family workflows historically observed in this repo’s Nature MTS notes.
- **Host patterns:** Publisher-specific; often custom domains fronting eJP.
- **Public APIs:** Limited public developer docs for form DOM.
- **Integration opportunities:** Generic eJournalPress stub already registered; Nature MTS is the first concrete eJP-family adapter based on observed IDs.
- **Notes:** Numeric `contrib_auth_{n}_*` patterns may generalize — still require fixtures per variant.

## Springer Nature submission systems

- **Terminology:** Snapp / Springer Nature Article Processing Platform (public branding), plus legacy systems; Nature titles may still reference MTS/eJP depending on journal.
- **Host patterns:** Mixed — Nature MTS domains and Springer Nature submission portals appear in author instructions.
- **Public APIs:** Publisher integration programs exist; not a substitute for DOM fixtures.
- **Integration opportunities:** Keep Nature MTS adapter scoped; treat Snapp as a separate platform family until fixtures exist.
- **Notes:** Product messaging should say “tested portal” not “all Springer Nature journals.”

## Likely Corresponding integration strategy

1. Diagnostics capture on author-entry step only.
2. Corpus fixture + replay metrics.
3. Adapter contract suite opt-in.
4. Exact selectors first; semantic recognizer as assistive Preview only until confidence ≥ fill threshold.
