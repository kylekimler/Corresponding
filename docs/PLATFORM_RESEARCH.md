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
- **Capture evidence (Bioinformatics, 2026-08-14):** Redacted compatibility capture from
  `mc.manuscriptcentral.com/bioinformatics` confirms email-first author entry:
  `findAuthorEmailId` + `searchAuthorId`, optional `emailSearchModal_yes/no`, then
  `AUTHOR_EMAIL_ADDRESS` / `AUTHOR_FIRST_NAME` / `AUTHOR_LAST_NAME`, affiliation
  slots (`AUTHOR_DEPARTMENT_#`, `CITY_#` including live `CITY_0` /
  `aria-label="City:"`, `COUNTRY_#`, `STATE_#`), CRediT role
  checkboxes, and `AuthAction` including Assign as Corresponding Author.
  Page continuation is `btnSubmit` / `AUTHOR_REVIEWERS` (“Save and Continue”).
- **Adapter status:** Capture-backed ScholarOne adapter implemented. Fill searches
  by email first, waits for lookup settle, creates a new author when the modal
  confirms no match, applies roster values, commits via Add Author, and may set
  corresponding via AuthAction. Never clicks Save and Continue / submit / legal.
  Institution appears to be Ringgold/typeahead (absent from the capture as a
  plain text input) and stays unmapped. CRediT roles stay unmapped until roster
  credit-role data is wired. Linked-account identity conflicts refuse overwrite.
- **Notes for Corresponding:** Multi-step author entry; linked author accounts
  likely. Prefer false negatives. Live smoke on an authenticated Bioinformatics
  submission still required before claiming production validation.




## ScholarOne — labels live in attributes (2026-08-17, second probe)

A probe intended for Editorial Manager was run on ScholarOne instead
(`searchAuthorId`, `emailSearchModal_yes`, Clarivate logos). It still yielded
useful evidence: many ScholarOne anchors have **no text at all** and carry their
label only in `title`/`aria-label` — "Add Author Link", "Institution",
"Quick Fill", "Add Another Institution". Control matching now reads `title` in
addition to `aria-label` and text.

The same probe confirmed `alertButton` ("Ok"), ScholarOne's own alert dialog. A
commit can be refused through that dialog rather than by rejecting a field, so
the commit wait now watches for it and reports the portal's wording verbatim
instead of timing out. The dialog is left open for the person to dismiss.

The fourteen `AUTHOR_CONTRIBUTOR_ROLE_SELECT_#` checkboxes have no
`label[for=...]`; their text sits in adjacent markup, which is why the
label-derivation in the adapter reads surrounding text rather than a label
element.

Observed but not wired, pending a need: "Create Account", "Add Created Author",
"Search Again", "Add Another Institution", "Quick Fill", `modal-yes-button`.

## Editorial Manager — still uncaptured

No Editorial Manager probe has been collected yet. The two gaps remain exactly as
recorded below: the Contributor Roles checkbox panel behind the pencil icon, and
the toolbar save is now `Save This Author` / `data-toolname="AuthorSave"`, and
the next author is parent-page `button.fl-add-btn`.

## ScholarOne — new-co-author path and institution (2026-08-17)

An email search that finds nothing shows an inline banner, "No co-author found.
Please search again using another e-mail address or create a new co-author",
rather than the Yes/No modal. Corresponding now settles on either outcome and
follows the banner link when it appears.

Institution is `name="AUTHOR_INSTITUTION_#"` with a generated
`id="combobox-#-inputEl"`. A 2026-08-18 Bioinformatics capture shows the
Create New Author slot is **0-based**: `id="CITY_0"` / `name="CITY_0"` with
`aria-label="City:"` (no `label[for]`), plus `COUNTRY_0` /
`AUTHOR_DEPARTMENT_0`. Older fixtures used `_1`. Corresponding locates both
indexes, `name^=CITY_` / `AUTHOR_INSTITUTION_`, and aria-labels, including
inside same-origin frames. Some sites still use a readonly ExtJS Institution
combobox; City may be a plain `CITY_0` text box or a combobox disabled until
Country is set. Extra Institution/City boxes already on the page are filled
from later roster affiliations. Add Another Institution is not clicked —
no stable control was in the capture. A free-text name can raise ScholarOne’s
own “Institution not connected to Ringgold” dialog (proceed control labelled
**OKAY**) or the generic “An error has occurred. Please try again.” dialog
(**Close**). Those are dismissed so the create-author form can finish;
unrelated `alertButton` refusals are still reported verbatim and left open.

`AUTHOR_CONTRIBUTOR_DEGREE_OF_CONTRIBUTION_ID_#` (Equal, Lead, Supporting)
remains untouched — the roster has no canonical degree-of-contribution concept.

## Editorial Manager — Authors list vs Add New Author (2026-08-17)

A probe from `editorialmanager.com/pgenetics/SubManuscriptData.aspx` titled
Add/Edit/Remove Authors was the **parent Manuscript Data page**, not the Add New
Author dialog. It is full of CKEditor title-toolbar chrome (`cke_*`,
`StepIndicator_*`) and has no `FirstName` / `Email` fields. The author form
still lives in the Add New Author window.

Corresponding now:

- treats that Authors list as the place to start Fill: click Add Author, then
  Save This Author in the dialog, then Add Author again. If the dialog is a
  separate window, Add Author is also sought on `window.opener`
- names that page in Preview when the form is not in this document, instead of the generic "author form was not found"
- skips CKEditor / step-indicator chrome in the built-in console probe, reports
  `hasOpener` / iframe counts, and prefers author-like fields so the next paste
  is not 200 lines of Paste-from-Word buttons
- fills the 14 `ContributorRole_0` … `ContributorRole_13` checkboxes (CRediT
  has fourteen roles; the ids are 0-based), matching by visible label
- opens the panel with `EditButton` (`title="Edit Contributor Roles"`,
  `ToggleToEditMode()`), then commits ticks with the roles floppy
  (`title="Collapse and Save Changes"`, `SaveHandler()`) before the author save
- never treats that roles floppy as the author `SaveButton` — both can share
  the same id
- reports the portal's "Please select at least one Contributor Role" warning
  instead of pretending the save worked

`Zipcode` (`name="ctl01$Zipcode"`) is now filled from the roster postal code.
The field uses Knockout `valueUpdate: 'blur'`, so Corresponding blurs after
writing. The Save-and-Add-Another-Author toolbar icon is still a title/alt
hypothesis.

## Editorial Manager — still needed

Institution is a typeahead (“Author Institution is Unverified”). Corresponding
types the roster name as free text and does **not** click the Ringgold list —
a neighbour like “Safran Aircraft Engines” is worse than the typed name.
Escape on the Institution box is not enough: the live list is a body-level
`.ui-autocomplete` that sits on the toolbox floppy
(`button.fl-flToolSave[data-toolname=AuthorSave]` title/aria-label
“Save This Author”). Fill hides that menu, then clicks Save up to three
times. After Save, PLOS shows `role="alertdialog"` “The Institution could
not be identified… Proceed with this Institution anyway?” — OK is
`span.ui-button-text` in `.ui-dialog-buttonset`. That OK is a click-through on the **parent page** — Fill often runs in the
author-form iframe, and jQuery UI appends the alertdialog to the top
window body. Corresponding looks at parent/top/opener for OK, then Add
Author for the next roster row. Cancel and the titlebar Close are never
clicked. Typing can clear City/Department, so those are written again
before Save. “Validation found issues. Review the highlighted counts and
form.” is the same OK path.

The “Institution not connected to Ringgold” / **OKAY** dialog is ScholarOne,
not Editorial Manager.

`Zipcode` is required and is now filled from the roster postal code (PLOS
Genetics Add New Author, 2026-08-17). The Add New Author dialog can open as its
own window; the popup only reaches the focused window, and the error text now
says so.

## ScholarOne — frames and CRediT

The Bioinformatics capture (`mc.manuscriptcentral.com/bioinformatics`) has the
author form in the top document and one additional readable frame with no
fields. Because `tabs.sendMessage` resolves with whichever frame answers first,
detection has to poll frames and keep the strongest answer; the empty frame
would otherwise report an unsupported page.

Contributor roles are plain checkboxes, `AUTHOR_CONTRIBUTOR_ROLE_SELECT_#`, with
the 14 CRediT labels beside them, plus
`AUTHOR_CONTRIBUTOR_DEGREE_OF_CONTRIBUTION_ID_#` selects offering Equal, Lead,
and Supporting. Corresponding ticks roles by matching the visible label, ticks
only, and never touches the degree-of-contribution selects: the roster has no
canonical concept for them yet.

## Editorial Manager — Contributor Roles (CRediT)

Observed 2026-08-17 on the Add New Author dialog. The form marks these required
with an asterisk: Given/First Name, Family/Last Name, E-mail Address,
Institution, Department, Zip or Postal Code, Country or Region, and
**Contributor Roles**. An author will not save until at least one CRediT role is
selected.

Contributor Roles is not a plain input. A pencil icon opens a panel of 14
checkboxes matching the CRediT taxonomy exactly, with its own save and back
controls.

Corresponding therefore:

- carries `creditRoles` and `postalCode` as canonical author data
- maps `Contributor Roles`, `CRediT`, and `Zip or Postal Code` columns on import
- reports missing required fields before Fill, naming the field and the affected
  authors, and still fills everything the portal does accept

It does **not** select the checkboxes. That needs a redacted capture of the
expanded Contributor Roles panel; the screenshots show labels but no element
identifiers, and this repository does not invent selectors.

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
