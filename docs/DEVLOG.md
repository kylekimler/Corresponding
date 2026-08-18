# Development Log

Chronological overnight / autonomous iteration log.

---

### 2026-08-18 22:10 UTC
- Bioinformatics Manuscript Central Create New Author still left Institution
  and City empty. A new capture shows the live boxes are **0-based**:
  `id="CITY_0"` / `name="CITY_0"` with `aria-label="City:"` (no `label[for]`),
  and Institution `name="AUTHOR_INSTITUTION_#"`. Fill only looked for
  `CITY_1` / `AUTHOR_INSTITUTION_1` and `<label>City</label>`, so the writes
  never landed.
- Finders now accept slots 0–3, `name^=CITY_` / `AUTHOR_INSTITUTION_`, and
  aria-labels. Country / Department / State use the same 0-or-1 lookup.
  Extra Institution/City boxes already on the page get later roster
  affiliations. Add Another Institution is not clicked — no stable control
  in this capture.
- verification: fixture `affiliationSlot: 0` + `cityAriaLabelOnly`; Ada
  writes AUTHOR_INSTITUTION_0, CITY_0, COUNTRY_0, AUTHOR_DEPARTMENT_0 and
  saves.

### 2026-08-18 21:40 UTC
- PLOS Add New Author now reaches the form (Add Author works) but Save This
  Author still missed. The live floppy is
  `button.fl-tool.fl-flToolSave[data-toolname=AuthorSave]`. The Institution
  Ringgold list is a body-level `.ui-autocomplete` over that toolbox, so the
  first click never reaches Save. After a real Save, PLOS shows
  `role="alertdialog"`: “The Institution could not be identified by the
  system. Proceed with this Institution anyway?” OK is
  `span.ui-button-text` inside the first `.ui-dialog-buttonset` button.
- Fill hides `.ui-autocomplete` before each Save, parks focus on Department,
  clicks the floppy up to three times, and clicks OK on the alertdialog.
  Cancel and the titlebar Close are never clicked. `isShown` now honours
  `display:none` so a hidden template floppy is not the click target.
- verification: fixture overlay blocks Save until the menu is hidden; Ada
  still saves; the proceed-anyway alertdialog OK is clicked and Cancel is not.

### 2026-08-18 21:15 UTC
- PLOS Editorial Manager Add New Author was stalling on the Institution
  Ringgold dropdown (screenshot: “Analytical Engines Institute” typed,
  Safran/MTU suggestions open, City and Department empty, Save not clicked).
  The person does not want a directory pick — type the roster name and click
  Save This Author.
- Fill no longer waits for or clicks typeahead suggestions. It types the
  institution, sends Escape so the list closes without selecting the first
  hit, writes City/Department/zip/country again (Ringgold typing clears
  them), then clicks the floppy. Validation / “Proceed with this Institution
  anyway?” stay OK click-throughs. Cancel is never clicked.
- verification: fixture list includes Safran/MTU decoys for “Engines”; Ada’s
  Analytical Engines Institute is not clicked; City=London and
  Department=Computing Laboratory are present at Save; authorsCount becomes 1.

### 2026-08-18 21:10 UTC
- ScholarOne Create New Author still left Institution and City empty on
  manuscriptcentral. Prefix/email/names wrote; the affiliation boxes did not.
  Live ExtJS keeps Institution `readonly` + `aria-hidden` (`name=`
  `AUTHOR_INSTITUTION_1`, generated `combobox-#-inputEl`) and keeps City
  disabled until Country is chosen (generated id, stable `name=CITY_1`).
- `writeInput` skipped readonly boxes; `isVisible` treated aria-hidden as
  absent; City was written while still disabled. Fill now writes those
  comboboxes even when readonly, ignores aria-hidden for on-page checks,
  waits until City is enabled after Country, and does not blur the widget.
- Fixture `extJsAffiliationWidgets` matches that DOM: a disabled City write
  is discarded. Console probe reports `readonly` / `disabled` / `aria-hidden`
  without reading values.
- verification: Ada + Dr. / London / Analytical Engines Institute saves on
  the ExtJS fixture; Institution stays readonly+aria-hidden and still holds
  the roster name; City `combobox-2001-inputEl` is London after Country.

### 2026-08-18 21:00 UTC
- ScholarOne Bioinformatics Create New Author was reaching Save with three
  required fields empty: Prefix (never written), Institution (written without
  change/blur so the validator saw nothing), City (written before Country, so
  the box was still disabled). The portal banner is “Please fix the following
  issues then click Save or Save & Continue.”
- Fill now writes Prefix from roster `namePrefix` (`AUTHOR_SALUTATION`),
  Country before City, and Institution with a normal input/change/blur so the
  required check sees it, then dismisses Ringgold/generic error if that lookup
  fires. It will not click Save while Prefix/Institution/City are still empty,
  and it never clicks Save & Continue.
- Sample roster gained a Prefix column. Import maps Prefix / Salutation /
  Honorific. A roster without Prefix is told to add that column — the value is
  not guessed.
- verification: fixture `requireCreateFields` matches the live banner; Ada
  with Dr. / London / Analytical Engines Institute saves; missing Prefix throws
  the portal’s “Prefix is required” wording.

### 2026-08-18 20:50 UTC
- Editorial Manager multi-author save was starting inside the Add New Author
  dialog and then failing to reopen the next author, because Add Author lives
  on the Manuscript Data list. Fill now starts from that list: click Add
  Author / Add New Author / `.fl-add-btn` → fill → Save This Author → wait
  for the dialog to close → click Add Author again. The same Add control is
  sought on `window.opener` when Fill ran in the popup window.
- Detect treats the authors list (title Add/Edit/Remove Authors, or a visible
  `fl-add-btn`) as Editorial Manager even when FirstName is not on screen yet,
  so host-family + list-page Fill actually runs instead of refusing.
- Console probe gained a `-- save-add --` section listing floppy / Add Author
  candidates (`data-toolname`, `fl-add-btn`, titles) so a live paste shows
  whether those controls are in the focused document.
- verification: fixture starts with the dialog hidden and label “Add New
  Author”; two-author fillAsync clicks Add twice and Save twice.

### 2026-08-17 22:05 UTC
- PLOS / Editorial Manager: after Fill, Save This Author can succeed with an
  unverified institution and no typeahead pick. The adapter was treating the
  inline “Author Institution is Unverified” state as a hard stop and not
  clicking through “Validation found issues. Review the highlighted counts
  and form.” Fill now OKs that dialog, then OKs “Proceed with this Institution
  anyway?” when it appears, and no longer aborts because the unverified text
  is visible.
- ScholarOne: the Ringgold warning is this portal, not PLOS. Writing
  `AUTHOR_INSTITUTION_1` can raise “Institution not connected to Ringgold”
  (**OKAY**) or the generic “An error has occurred. Please try again.”
  (**Close**). Fill dismisses those, does not blur the ExtJS combobox, waits
  for the create-form email box when it lags the name fields, and still
  reports other `alertButton` refusals verbatim.
- verification: fixture paths for both dialog sequences; unit tests assert
  the click-throughs and a completed save.

### 2026-08-17 19:25 UTC
- Editorial Manager save was shaking because Institution is a Ringgold typeahead, not a plain text box. The screenshot shows “Author Institution is Unverified” / “Start typing to display potentially matching institutions.” Setting the value and blurring immediately never opens the list, so the portal treats the name as invalid and the dialog shakes instead of offering “Proceed anyway?”
- Fill now types into Institution (input/keydown/keyup), waits for a suggestion whose text equals the roster name, and clicks only that exact match. A neighbour in the list is never chosen. If nothing matches, the typed value stays and Save + OK on the proceed warning is the fallback; a second save is tried if the first only shakes.
- Institution is not blurred in the generic field writer. Zipcode still blurs for Knockout.
- verification: fixture typeahead with a decoy plus “University of London”; exact match is picked; unmatched names still take the OK path.

### 2026-08-17 18:50 UTC
- Save This Author on Editorial Manager is followed by a jQuery UI warning: "The Institution could not be identified by the system. Proceed with this Institution anyway?" OK is `<span class="ui-button-text">OK</span>` in a second `ui-dialog` (div[14]); Cancel must never be clicked. Fill now dismisses that warning with OK after the floppy click, then waits for the author dialog to close.
- Save finding prefers the visible toolbox floppy: `.fl-toolbox [data-toolname=AuthorSave]` / `button.fl-flToolSave`, and the click is a full mouse sequence (pointer/mouse down-up plus click) because the toolbox is a CSS icon button with no text.
- verification: new fixture path for the institution warning; OK is clicked, Cancel is not, author count becomes 1.

### 2026-08-17 18:20 UTC
- One-author fill on Editorial Manager was succeeding, then stopping, because author save looked for `id=SaveButton` (also the CRediT collapse floppy). The real control is `<button class="fl-tool fl-flToolSave" title="Save This Author" data-toolname="AuthorSave">` in the dialog (`div[11]`). Add Another Author is a parent-page `<button class="fl-add-btn">Add Another Author</button>`, only clickable after that save closes the dialog.
- Fill now: save via AuthorSave / "Save This Author" → wait until the dialog is hidden or the given name clears → click `.fl-add-btn` → wait for the form to reopen → next author. XPaths were location context only.
- Fixture mirrors both controls and hides `#author-dialog` on save so the wait/reopen path is tested. Three-author fillAsync clicks Save This Author three times and Add Another Author twice.
- verification: EM unit tests, then full suite / typecheck / build / e2e.

### 2026-08-17 17:10 UTC
- CRediT on Editorial Manager is a two-control sequence, not a checkbox row sitting on the form. The pencil is `input type=image id=EditButton title="Edit Contributor Roles"` (`ToggleToEditMode()`). After ticking, the floppy `title="Collapse and Save Changes"` (`SaveHandler()`) commits the grid. That floppy also uses `id=SaveButton`, so author save now skips any control whose title is the collapse phrase.
- There are 14 CRediT roles, so the boxes are `ContributorRole_0` through `ContributorRole_13` (0-based, not 13 boxes). Names live under `ContributorRolesGridView`. XPaths were location context only.
- Fill now: open EditButton if no visible boxes → tick by label → collapse-and-save roles → author save. The older "Click here to select roles" text remains a fallback.
- verification: EM fixture mirrors both image inputs; the pencil/floppy test asserts 14 ids, both clicks, and that the grid is collapsed afterwards.

### 2026-08-17 17:00 UTC
- PLOS Genetics Add New Author inspection (ids, not the structural probe): `ContributorRole_0` / `ContributorRole_1` with names under `ContributorRolesGridView`, confirming the 2026-08-15 prefix. XPaths were recorded only as location context and are not used as selectors.
- `id="Zipcode"` / `name="ctl01$Zipcode"` is the required postal field. It is now filled from `affiliation.postalCode`. The input is Knockout-bound with `valueUpdate: 'blur'`, so every EM text write now dispatches blur after input/change; without that the model would keep an empty zip even when the box looked filled.
- verification: unit tests for Zipcode write + blur, plus the existing EM / probe suites.

### 2026-08-17 16:50 UTC
- The latest Editorial Manager probe was `SubManuscriptData.aspx` titled Add/Edit/Remove Authors — the parent Manuscript Data page, not the Add New Author dialog. CKEditor toolbars drowned the output; no author-form ids were in it.
- The built-in console probe now skips `cke_*` / `StepIndicator_*` chrome, reports `hasOpener` and iframe counts, and prefers author-like fields so a parent-page paste no longer hides the form.
- Preview/Fill on that parent page now says it is the Authors list and that the form lives in the Add New Author window, instead of the generic not-found sentence.
- CRediT: the 2026-08-15 PLOS ONE capture already had `ContributorRole_#` checkboxes; they are now ticked from roster roles, matching by visible label. If the panel is collapsed, Fill clicks "Click here to select roles" (screenshot text) and waits for the boxes. A save that the portal refuses with "Please select at least one Contributor Role" is reported in those words. Visibility checks are realm-safe — iframe documents have their own `HTMLElement`, so `instanceof` was treating a visible warning dialog as invisible.
- verification: lint (eval warnings in the probe tests only), typecheck, 281 Vitest tests, production build, and six Playwright MV3 journeys passed.

### 2026-08-17 16:00 UTC
- A probe meant for Editorial Manager was run against ScholarOne, so Editorial Manager's two gaps are still uncaptured. The ScholarOne evidence was used rather than discarded.
- ScholarOne control matching now reads `title`, not just `aria-label` and text. The probe showed many anchors carry their label only in attributes and have no text ("Add Author Link", "Institution", "Quick Fill"), which would have made the page-level Add Author control unfindable.
- ScholarOne commit now watches for `alertButton`, the portal's own alert dialog, and reports its text verbatim. Previously a dialog-refused save would have run out the clock and produced a generic "did not add the author" message — the same unhelpful failure shape Editorial Manager's Contributor Roles warning produced. Casing is preserved because the text is shown to the person, and the dialog is left open for them to dismiss.
- removed two dead timing constants that lint had been failing on.
- verification: lint (one pre-existing warning), typecheck, 277 Vitest tests, production build, and six Playwright MV3 journeys passed.

### 2026-08-17 14:00 UTC
- ScholarOne, from the 2026-08-17 capture: institution is `name="AUTHOR_INSTITUTION_1"` with a generated combobox id, so it is now located by name and filled. It had previously been reported unmapped because the earlier capture lacked the field.
- ScholarOne new-co-author path: an unknown email produces an inline "create a new co-author" banner rather than the Yes/No modal. Lookup now settles on either outcome and follows the banner link, so an unrecognised email no longer stalls.
- Editorial Manager: the reported failure is not a fill failure. The screenshots show the open form correctly filled and the portal refusing only on Contributor Roles. Two gaps remain, both needing capture evidence rather than guessed ids: the roles panel behind the pencil icon, and the unlabelled toolbar icon for Save and Add Another Author. Control matching now also reads `title` and `alt`, which is how icon buttons carry labels, and clicks the nearest actionable ancestor; this is a hypothesis pending a capture.
- Editorial Manager message: the author-form-not-found error now names the separate-window case, which is what the popup actually hits when Add New Author opens its own window.
- known gap: `Zip or Postal Code` is required on the Editorial Manager form but absent from the captured ids, so the requirement is reported and cannot yet be filled.
- copy: "This app is free!" became "Free for scientists forever!", with the `radicallyFree` guard updated to match.
- verification: 276 Vitest tests, typecheck, production build, and six Playwright MV3 journeys passed.

### 2026-08-17 13:15 UTC
- ScholarOne recognition, root cause: `DETECT`, `PREVIEW`, and `FILL` were broadcast to every frame with `tabs.sendMessage`, and Chrome resolves with whichever frame replies first. The `mc.manuscriptcentral.com/bioinformatics` capture shows a second readable frame with zero fields, so that frame could answer "unknown" and win the race even though the top frame scored ~0.95. Diagnostics already walked frames; the fill path did not.
- fix: detection now asks every injectable frame and keeps the strongest answer, preferring a real platform match over the highest raw confidence. The winning frame id is remembered per tab and reused for Preview, Fill, and Validate through `TabTarget.frameId`, so operations target the frame that recognised the portal. The adapter ids and thresholds were already correct and are unchanged.
- ScholarOne CRediT roles: the capture supplies `AUTHOR_CONTRIBUTOR_ROLE_SELECT_#` checkboxes with all 14 labels, so roles are now filled from the roster. Matching is by visible label through the shared CRediT parser, which folds the capture's hyphen and ampersand spellings. Ticking only: a role a person already selected is never cleared, and an unrecognised label is skipped rather than guessed. Rosters without roles report `missing_source` and leave the boxes for manual selection.
- requirements: ScholarOne contributes a non-blocking contributor-roles notice; Editorial Manager's remains blocking-flagged but still reported rather than enforced.
- copy: "Free. No account. No trial." became "This app is free!", and the unsupported-journal line now points at GitHub or the capture route. The `radicallyFree` guard was updated to assert the new sentence rather than dropped.
- Advanced gained a GitHub section at the top with a button opening the repository.
- cleanup: removed the duplicated frame-listing try/catch in `tabBridge`, which also cleared a pre-existing `no-useless-assignment` error in that file.
- verification: 274 Vitest tests, typecheck, production build, and six Playwright MV3 journeys passed. `npm run lint` still reports two pre-existing unused-constant errors in the bioRxiv adapter, untouched here.

### 2026-08-17 12:50 UTC
- environment note: the workspace came back at a commit from the first session while `origin/main` was 27 commits ahead with capture-backed Editorial Manager and ScholarOne adapters. Resynced to `origin/main` before touching code, so this work builds on the current adapters instead of duplicating them.
- CRediT: Added `src/schema/credit.ts` with the 14-role taxonomy, display labels, and a parser that folds en dashes, ampersands, and shorthands. Unrecognized text is dropped rather than guessed. Identity v2 now re-uses this vocabulary instead of declaring its own copy.
- canonical data: `Author.creditRoles` and `Affiliation.postalCode`, both required by Editorial Manager's author form. Import maps `Contributor Roles`, `CRediT`, `Contributions`, and `Zip or Postal Code` columns.
- requirements model: `src/adapters/requirements.ts` declares per-portal required fields from captured forms only, with a short explanation each. Editorial Manager covers contributor roles, department, postal code, country, email, and institution; bioRxiv covers email and institution.
- reported, not enforced: unmet requirements travel on `FillReport.requirements` and render as a briefly reddish notice naming the field and affected authors. Filling still proceeds, so a person keeps the values the portal does accept and only completes the rest. An earlier draft blocked the fill outright and broke three existing Editorial Manager tests, which was the right signal that blocking was too aggressive.
- example roster: gained departments, postal codes, and CRediT roles so the six-author example satisfies Editorial Manager rather than tripping the warning it demonstrates.
- deliberate limit: the Contributor Roles checkboxes are not selected. That needs a redacted capture of the panel behind the pencil icon; the screenshots show labels but no identifiers.
- verification: 268 Vitest tests, typecheck, production build, and six Playwright MV3 journeys passed. `npm run lint` reports three pre-existing errors on `main` (unused constants in the bioRxiv adapter, a redundant assignment in `tabBridge`) that predate this change and are untouched here.

### 2026-08-15 04:55 UTC
- Merged open PRs onto main in an order that keeps capture-backed IDs and the honest scoreboard: #30 FILL INFO, #26 fill delight, #29 declarative sites (includes #27 radically-free and #28 scoreboard), #31 Editorial Manager iframe adapter, #32 ScholarOne Bioinformatics adapter.
- Conflicts were only docs / README / registry. Resolution: `sites/*.json` stay detect-only; TypeScript adapters win on id collision; host-family detect remains for `*.editorialmanager.com` and `*.manuscriptcentral.com`.
- Skipped #25 (guessed EM + ScholarOne selectors + COI schema). It would have overwritten the PLOS and Bioinformatics captures.
- Scoreboard now marks Nature, bioRxiv/medRxiv, Editorial Manager, ScholarOne, and PLOS ✅. Elsevier, Wiley, Frontiers, and eLife stay ⬜.
- verification: 257 Vitest tests, typecheck, and production build passed.

### 2026-08-15 04:40 UTC
- Console probe from PLOS ONE found the author form in a same-origin iframe: `RequiredRegistrationQuestions.aspx`, IDs `FirstName`, `LastName`, `Email`, `Institution`, `Department`, `Affiliation`, `CountryCode`, `CorrespondingAuthorCheckbox`, plus author `SaveButton`. Manuscript title/abstract editors share that page and are never written.
- Editorial Manager adapter fills the open Add/Edit Author form through the iframe, saves one author at a time, and clicks Add Another Author only when that control’s accessible name is present. Identity conflicts are not overwritten. Session IDs in URLs are redacted.
- verification: 229 Vitest tests, typecheck, and production build passed.

### 2026-08-15 04:25 UTC
- Fourth PLOS Genetics capture was still the old top-document format (no `iframeSeen`). The installed extension has not picked up the iframe/all-frames work.
- Added a copy-paste structural console probe (Advanced → Copy console frame probe). It walks readable frames, omits values/passwords/hidden auth, and is meant to be run on the Add Author document itself via the DevTools context picker or the popup window.

### 2026-08-14 23:20 UTC
- PLOS Genetics capture from `editorialmanager.com/pgenetics/default2.aspx` after clicking inside Add New Author was still RoleDropdown chrome. That is Editorial Manager, not ScholarOne (`manuscriptcentral.com`). The installed capture also lacked `iframeSeen`, so it came from a build that never left the top frame.
- Detection now uses the tab hostname: `*.editorialmanager.com` → Editorial Manager, `*.manuscriptcentral.com` → ScholarOne. Stub HTML hints stay below the fill threshold; host family is labeled but Fill stays off until an author-form fixture exists.
- Diagnostic injection uses `allFrames: true` and merges every injectable frame capture. If Add Author is a separate window, the capture must be taken while that window is focused. Still no PLOS/EM field selectors.
- verification: 219 Vitest tests, typecheck, and production build passed.

### 2026-08-14 23:19 UTC
- evidence: Redacted Bioinformatics ScholarOne capture (`mc.manuscriptcentral.com/bioinformatics`) confirms email-first author entry — `findAuthorEmailId` / `searchAuthorId`, `emailSearchModal_yes/no`, `AUTHOR_EMAIL_ADDRESS` / `AUTHOR_FIRST_NAME` / `AUTHOR_LAST_NAME`, affiliation `_*` slots, CRediT role checkboxes, AuthAction corresponding assignment, and forbidden `btnSubmit` Save and Continue.
- adapter: Replaced the ScholarOne stub with a capture-backed fillAsync orchestrator. Fill opens Add Author, searches by email, waits for lookup settle (never writes names mid-lookup), confirms create-new when the modal appears, refuses linked-account identity conflicts, commits via Add Author, and may assign corresponding via AuthAction.
- safety: Never clicks Save and Continue / submit / legal. Institution (likely Ringgold) and CRediT roles stay unmapped without value-field evidence / roster credit data.
- recognition: Email lookup/search boxes are demoted so `AUTHOR_EMAIL_ADDRESS` wins over `findAuthorEmailId`.
- fixtures/tests: Capture-derived harness, corpus entry, sample HTML, and unit coverage for multi-author create, linked match, conflict refusal, and zero submit clicks.
- status: Authenticated live Manuscript Central smoke still required before claiming production validation.

### 2026-08-14 22:55 UTC
- PLOS ONE live captures from `editorialmanager.com/pone/default2.aspx` (before and after “+ Add Another Author”) were identical chrome: `RoleDropdown` Author/Reviewer, hamburger, user icon. No author fields. That is the EM home/role shell, not Manuscript Data → Authors.
- Diagnostic capture now walks nested same-origin `iframe` / `frame` documents and reports `iframeSeen` / `iframeReadable` / `iframeBlocked` with redacted `srcPattern`. Cross-origin frames are counted, never read. No PLOS or EM fill selectors were added.
- Chrome-only EM captures add a note to open the author-entry step and click inside an author field. Advanced explains the same. Still need a capture that lists Given/First, Family/Last, Email, affiliation.
- verification: 209 Vitest tests, typecheck, and production build passed. Nested frames are matched by tag name so iframe realms cannot hide them.

### 2026-08-14 16:55 UTC
- reported: bioRxiv Fill stopped after 0 authors with `bioRxiv reported: check_circlefound author … click to fetch author data … fill info`.
- root cause: the email-lookup offer is a Vuetify `v-alert` / `role="alert"` with a Material `check_circle` ligature. After Save, `portalErrorText` treated that informational panel as a new fatal banner.
- fix: ignore lookup-offer text (`found author`, `fetch author data`, `fill info`, `overwrite any existing fields`) when reading portal errors. Real banners such as the hash mismatch still stop the run. FILL INFO is still never clicked.
- fixture now renders the offer as a `v-alert` so this cannot regress silently.
- verification: 204 Vitest tests, typecheck, and production build passed.

### 2026-08-14 05:00 UTC
- Journal coverage is now a folder of tiny JSON files in `sites/`. Nature MTS is `sites/nature.json` driven by a shared declarative engine. Existing Nature contract, chaos, and property tests still run against that file.
- ScholarOne, Editorial Manager, and generic eJournalPress are detect-only JSON. No field IDs were guessed. bioRxiv stays a TypeScript adapter because it is a repeated dialog with a directory lookup.
- Site files may only name element IDs. CSS selectors and click actions are rejected so a drive-by PR cannot submit a manuscript.
- README: `Your journal broken? Add support in ~10 lines.` plus the example society file. That is the contributor flywheel.
- verification: 214 Vitest tests, typecheck, production build, and six Playwright MV3 journeys passed.

### 2026-08-14 04:50 UTC
- Compatibility is now the public game: a giant Platform / Autofill table near the top of the README, plus "Your journal isn't supported? Open an issue and paste a screenshot."
- Checkmarks are honest. Nature Portfolio and bioRxiv / medRxiv are ✅. Editorial Manager, ScholarOne, Elsevier, Wiley, Frontiers, PLOS, and eLife stay ⬜ until a redacted fixture exists. A test fails if the README claims a stub can fill.
- Unlock events are listed as recurring circulation: next EM / ScholarOne, later v0.7 Cell Press, v0.8 Wiley, v0.9 100 journals.
- Unknown-portal popup copy asks for a redacted author-form capture as the way the next platform unlocks.
- verification: 209 Vitest tests, typecheck, production build, and six Playwright MV3 journeys passed.

### 2026-08-14 04:45 UTC
- Corresponding Fill is now radically free: MIT license, no account, no trial, no freemium gate.
- README leads with the hated-form hook: `Stop entering 74 authors into journal submission forms by hand.`
- The entitlement stub (free/pro/team plans, author caps) is gone. Access is a locked `FREE_ACCESS` object so a paywall cannot grow by accident.
- Popup header says `Free. No account. No trial.` Store description and privacy copy match.
- verification: 206 Vitest tests, typecheck, production build, and six Playwright MV3 journeys passed.

### 2026-08-14 04:30 UTC
- After a successful fill the popup now says, for example, `73 authors filled. You just got 49 minutes of your life back.` The estimate is 40 seconds per author actually written or planned on this page.
- The main popup footer shows `Lifetime researcher hours saved: N` in small grey text. That number is a local estimate on this device, stored in `chrome.storage.local`.
- Sample roster fills and development-fixture tabs never increment the lifetime counter. Unit tests and e2e journeys stay at zero.
- No backend, no opt-in telemetry, no community-wide number. There is no analytics pipeline, so a global screenshot number would be invented.
- verification: 209 Vitest tests, typecheck, production build, and six Playwright MV3 journeys passed.

### 2026-08-13 18:20 UTC
- root cause found, from a user screenshot: entering an author email makes bioRxiv look the author up in its own directory. When the result arrives it re-renders the dialog and offers "fetch author data" via FILL INFO. Everything written during that window is discarded, which is exactly the "typed then vanished, first name required" failure. Earlier fixes treated the symptom.
- fix: Email is now written alone, then Corresponding waits for the whole dialog to stop changing — element count, text length, input values, and the presence of the offer panel — before writing names and institution. Fields are re-resolved afterwards because the lookup can replace the input elements.
- never accept the offer: FILL INFO would replace roster values with the portal's record, so it is never clicked. A warning reports how many emails bioRxiv recognised and states that roster values were kept.
- CSV verified against the real 76-author file: 28 columns including trailing blanks, a multi-line quoted funding statement, and a leading blank column all parse correctly into 76 authors with name, ORCID, affiliation, funding, disclosure, and email mapped. The reported "only did the first one" was the bioRxiv fill, not the import.
- regression test strengthened: the first version still passed with the wait removed because the verify-and-rewrite loop masked it. It now asserts the ordering invariant directly — zero name writes while a lookup is in flight — which fails with 9 racing writes when the wait is removed.
- verification: 203 Vitest tests, typecheck, production build, zero-warning security lint, and six Playwright MV3 journeys passed.

### 2026-08-13 18:05 UTC
- reported: the six-author example set was still not visible. Confirmed the production bundle contained both the new data and label, so this was reachability, not a build problem.
- root cause: the example-authors button only ever rendered inside the empty state. Once any roster is saved — which is the normal state after testing — that branch never renders and the button cannot be reached.
- fix: Added "Add example authors" to the roster menu so it is reachable whenever a roster already exists.
- stale copies: Importing the example set now replaces any previously stored example roster, so a 3-author copy saved earlier cannot shadow the current 6-author set. Imported rosters of the user's own are untouched.
- wording: Development-only phrasing replaced now that the example set is available in every build.
- tests: Replacement of a stale example roster while preserving user imports, plus a browser journey that imports a CSV first and then reaches the example set through the menu.
- verification: 201 Vitest tests, typecheck, production build, zero-warning security lint, and six Playwright MV3 journeys passed.

### 2026-08-13 17:45 UTC
- diagnostic resolved: `fields at Save: Email=present, First Name=present, Last Name=present, Institution=present` with bioRxiv still reporting the first name missing proves the DOM held the values while the portal's model did not. `execCommand` also needs a focused document, which an open popup denies, so the earlier change silently fell back to the previous behaviour.
- bioRxiv: Input strategies now escalate — `insertText`, native setter, `setRangeText`, then per-character key events — and the portal's own field validation decides whether a strategy was accepted. Values present in the field while validation still says "required" now advance to the next strategy instead of saving.
- exhaustion path: When no strategy is accepted, the error names that and points at bioRxiv's own Import Authors control, which is the portal-supported bulk route.
- CSV stall root cause: Chrome destroys an extension popup when the native file dialog takes focus, so the chosen file was never read. Added an `import.html` extension page that reuses the same UI and storage; the popup now opens it for file selection and keeps working drag-and-drop.
- sample availability: Example authors are available in every build, relabelled "Try six example authors". Filling them into a non-fixture page now asks for confirmation instead of being blocked outright, which had made real end-to-end testing impossible.
- fixture realism: The author dialog now clears a field's validation message once valid input arrives, matching reactive frameworks and making strategy escalation testable.
- verification: 200 Vitest tests, typecheck, production build, zero-warning security lint, and five Playwright MV3 journeys passed. Manifest permissions unchanged; creating a tab needs no extra permission.

### 2026-08-13 17:20 UTC
- sample roster: Extended to six authors shaped like a real paper — two shared first authors, ordered third and fourth, then two shared corresponding senior authors. Includes an accented name for encoding coverage.
- schema: Added canonical optional `equalContribution`, and mapped the workbook columns that already carry it (`Equal contribution`, `Co-first author`, `Shared first author`) instead of discarding them. Shared first authorship now appears in the read-only import review.
- deliberate limit: No portal field is filled from `equalContribution`. Nature and bioRxiv fixtures show no such control, so it stays canonical data until fixture evidence exists.
- multiple corresponding authors: Documented as supported. The Nature adapter still fills its single corresponding block from the first flagged author; bioRxiv marks each flagged author individually.
- verification: 200 Vitest tests, typecheck, production build, zero-warning security lint, and all four Playwright MV3 journeys passed.

### 2026-08-13 17:15 UTC
- live result: Author 2 still rejected with "the first name field is required" after the retry. Not a sample-data problem: the sample author has a first name, and author 1 saves from the same roster.
- input fidelity: Writing now tries `document.execCommand('insertText')` first, which routes through the browser's own editing pipeline so reactive bindings observe it as real typing, then falls back to the native setter and `setRangeText`. Each strategy is verified against the field before moving on.
- self-diagnosis: A rejected author now reports whether each required field was present or empty at the moment Save was clicked. That separates "our text never landed" from "the portal ignored text that was visibly present", so the next fix is evidence-led rather than another guess.
- honest status: Two prior hypotheses for this failure were wrong. This change improves the most likely mechanism and instruments the rest instead of claiming a certain fix.
- verification: 199 Vitest tests, typecheck, production build, zero-warning security lint, and all four Playwright MV3 journeys passed. jsdom lacks `execCommand`, so unit runs exercise the fallback path and Chrome exercises the primary path.

### 2026-08-13 16:50 UTC
- live result: Author 1 saved. Author 2's details were visibly typed in, then vanished, and bioRxiv reported "the first name field is required."
- root cause: The portal's own model did not receive the values, so its re-render discarded them while the DOM still looked correct. Verification passed against the DOM, Save was clicked, and validation then failed against the empty model.
- input fidelity: Values are now written the way a person enters them — focus, native setter, an `InputEvent` carrying `inputType`, then change and blur — so reactive bindings update their model instead of overwriting our text.
- same `querySelector` class of bug as the author table: `activeDialog` returned null whenever the first `.v-dialog--active` was hidden. It now selects the first visible active dialog.
- error handling split: Page banners stay fatal, while field validation inside a still-open dialog is treated as recoverable, because an open dialog means nothing was committed. The author is re-entered once and only then reported as rejected.
- verification timing: The post-write settle is longer than a frame so a late re-render is caught before Save rather than after it.
- tests: Model desync at Save with a late dialog wipe (verified failing when the retry is removed), proving the author is re-entered rather than saved empty.
- verification: 199 Vitest tests, typecheck, production build, zero-warning security lint, and all four Playwright MV3 journeys passed.

### 2026-08-13 14:55 UTC
- live result: Author saved correctly and appeared in bioRxiv's list, but Corresponding reported "did not confirm the saved author". A screenshot proved the fill succeeded and only detection failed.
- root cause: `existingAuthorCount` used `querySelector`, taking the first `table.v-datatable` in the document. bioRxiv's Import Authors feature contributes a hidden preview table, so the visible author list was never counted and the gate could never observe the commit.
- fix: Select the first visible, non-dialog author table instead of the first match, and add a markup-independent second signal that counts visible edit/delete row-action pairs.
- policy fix: A detection failure is no longer reported as a fill failure. When the dialog closes with no portal error, Corresponding settles, continues, and warns that it could not read the author list. A dialog still open after Save remains a genuine error.
- pacing: The first unreadable commit shortens later confirm waits, so an undetectable page does not pay the full timeout per author.
- tests: Hidden import-preview table with icon-only row actions (verified failing against the previous detection), and an uncountable author list that still completes with a warning.
- verification: 198 Vitest tests, typecheck, production build, zero-warning security lint, and all four Playwright MV3 journeys passed.

### 2026-08-13 04:50 UTC
- live result: Authors now fill correctly, but bioRxiv showed its own red banner, "Author does not exists hash do not match", when the second dialog opened.
- root cause: `saveAuthorDialog` treated dialog closure as success. Closure is client-side only; bioRxiv commits the author asynchronously afterwards. Clicking Add Author inside that window made the portal reconcile against a record it had not stored yet.
- fix: Saving now waits for the author to appear in bioRxiv's own author table before the next dialog is opened, instead of trusting dialog closure.
- portal errors: Corresponding now reads bioRxiv's visible error banner, stops immediately, and surfaces the portal's wording instead of continuing and compounding the failure. A banner present before Fill starts is treated as baseline so unrelated notices cannot block a run.
- tests: Asynchronous commit with an early-add error banner (verified failing when the commit gate is removed), and abort-on-banner coverage that proves no further authors are attempted.
- verification: 196 Vitest tests, typecheck, production build, zero-warning security lint, and all four Playwright MV3 journeys passed. Live bioRxiv retry still required.

### 2026-08-13 04:40 UTC
- live result: Add Author matching now works; the second dialog opens. The next author was saved with the previous author's data.
- root cause: bioRxiv reuses one dialog element, so a reopened dialog still holds the previous author's values. The fill loop applied the preserve rule (`current && !overwrite → skip`), which is meant to protect user-typed portal data, to stale UI state in a dialog Corresponding had just opened for a new author.
- fix: Distinguish a dialog Corresponding opened from one the user already had open. For dialogs we open, write every roster value authoritatively and clear managed fields with no value, so nothing leaks between authors. Preserve/overwrite semantics still apply to a pre-existing dialog.
- race hardening: Wait for the reused dialog's inputs to stop changing before writing, so an asynchronous framework reset cannot wipe values mid-fill.
- correctness gate: Re-read and verify every managed field after writing, retry once, and refuse to click Save when the dialog does not match the roster author. Prefers a stopped fill over a wrong author.
- tests: Reused-dialog leakage (verified failing against the previous behavior), delayed asynchronous reset, and refusal to save when a field rejects programmatic input.
- verification: 194 Vitest tests, typecheck, production build, zero-warning security lint, and all four Playwright MV3 journeys passed. Live bioRxiv retry still required.

### 2026-08-13 04:30 UTC
- diagnosis from live capture: The previous remount theory was wrong. A post-failure capture showed the real Add control renders as `[redacted] Add Author` — a Material icon ligature text node precedes the label — so exact whole-text matching could never find it. The capture also showed three `edit`/`delete` row pairs, i.e. earlier partial runs each left one saved author behind.
- defect 1 (label): Button matching now reads a label from `aria-label`, or from a detached clone with icon/`svg`/`aria-hidden` nodes removed, and scans words for add + author/co-author. The portal DOM is never mutated to read a label.
- defect 2 (visibility): `isVisible` only checked the element's own computed style, so children of `display: none` dialogs counted as visible and could be clicked. Visibility is now ancestor-aware.
- hardening: Add Author candidates must also be enabled and non-forbidden. Word scanning replaces a backtracking-prone regex flagged by security lint.
- recovery UX: The existing-authors refusal now names bioRxiv's own Delete controls, since partial runs leave rows behind.
- tests: Added icon-ligature matching across repeated saves, hidden-decoy rejection, and recovery-message coverage; browser fixture now renders the icon ligature and a hidden decoy.
- verification: 191 Vitest tests, typecheck, production build, zero-warning security lint, and all four Playwright MV3 journeys passed. Live bioRxiv retry still required.

### 2026-08-13 03:45 UTC
- bioRxiv live follow-up: After one saved author, the portal closes the dialog before remounting its Add control. The orchestrator now waits for the refreshed external action and accepts the observed “Add Another Author” state instead of failing immediately.
- popup: Removed the optional-Preview subtitle entirely.
- manuscript import phase 1: Added local DOCX archive parsing with `fflate`, strict compressed/XML size limits, and deterministic extraction of structured author tables. The parser returns only the selected table; manuscript prose is discarded and never stored.
- fail-closed scope: DOCX tables must expose separate given/family columns. Paragraph front matter, superscript-only layouts, PDF, and OCR remain blocked pending anonymized fixtures.
- tests: Added delayed post-save Add remount coverage, label-variant coverage, DOCX selection among unrelated tables, blank-column preservation, paragraph-layout refusal, malformed archive refusal, and production popup DOCX upload.
- verification: 188 Vitest tests, typecheck, production build, zero-warning security lint, zero production dependency vulnerabilities, and all four Playwright MV3 journeys passed.

### 2026-08-13 02:50 UTC
- copy: Changed the popup purpose line to “Giving scientists more time to do science.” Replaced mandatory-sounding safety copy with optional Preview guidance.
- direct Fill: Fill no longer requires a user-triggered Preview. It reuses a matching clean Preview when available; otherwise it performs a fresh internal dry-run bound to the current roster/version, overwrite setting, and tab before any mutation. Blocking adapter errors still stop Fill.
- sample UX: Development sample rosters now expose a prominent one-click removal control instead of appearing permanently stuck in local storage.
- discovery: Added local DOCX front-matter author/affiliation extraction to the backlog for fixture-first assessment; no manuscript parser was introduced without evidence.
- verification: 185 Vitest tests, typecheck, production build, zero-warning security lint, and all three Playwright MV3 journeys passed. Nature exercises visible Preview invalidation followed by direct Fill; bioRxiv exercises direct Fill with internal preflight.

### 2026-08-13 02:40 UTC
- bug: Spreadsheet paste used `trim()`, which removed a leading tab from an unlabeled header column but not from following rows. Wide Google Sheets data shifted one column right, produced incorrect mappings (for example publication name as ORCID), then failed import validation without surfacing the rejected promise.
- fix: Preserve leading/trailing tab structure, keep blank headers as Ignore, and catch mapping-import validation failures beside the Import action.
- schema/import: Added optional project-level `fundingStatements` and `disclosureStatements` to rosters and identity-v2 round trips. Support/Funding and Conflicts/Competing Interests columns map explicitly instead of false-matching author state.
- UX: Read-only roster review summarizes imported project statements. Adapters do not fill them until portal fixtures prove the corresponding fields, and no certification/attestation is automated.
- tests: Added the reported leading-blank-column shape, project metadata mapping/deduplication, identity migration preservation, and production popup E2E coverage.
- verification: 185 Vitest tests, typecheck, production build, zero-warning security lint, and all three Playwright MV3 journeys passed.

### 2026-08-13 02:30 UTC
- branding: Added a “Corr” extension icon using the popup's mint, cream, parchment, and pale-sage gradient with dark forest serif lettering.
- assets: Retained 1024px source artwork under `assets/brand`; generated Lanczos-resized Chrome icons at 16/32/48/128px and wired both extension and toolbar manifest icons.
- verification: Production build ships all four icon sizes; 183 Vitest tests, typecheck, zero-warning security lint, and all three Playwright MV3 journeys passed. Permissions remain `activeTab`, `storage`, and `scripting`.

### 2026-08-13 02:20 UTC
- bug: Extension reload/update could leave a popup promise with an undefined or malformed tab response, and an anonymous popup path still read `.type` directly.
- fix: Every popup request now normalizes responses again at the component boundary; response envelopes require their expected payload; interrupted update messaging becomes a user-facing reconnect instruction. Diagnostic capture now catches rejected browser calls instead of producing an unhandled promise.
- tests: Added undefined, null, missing-type, missing-result, and malformed-error response coverage.
- verification: 183 Vitest tests, typecheck, production build, zero-warning security lint, and all three Playwright MV3 journeys passed.

### 2026-08-13 02:10 UTC
- evidence: Reviewed redacted bioRxiv author-page captures with the repeated editor closed/open plus values-free visibility/ancestry output. Confirmed the active Vuetify dialog, stable field names/labels, external Add Author, dialog Save, empty author table, and page-level `CA_continue`.
- adapter: Added `biorxiv` detection, dry Preview, complete-roster preflight, and an asynchronous one-dialog-per-author Fill orchestrator. It refuses to append when author rows already exist, requires names/email/institution before mutation, preserves an already-open first dialog, and never automates ORCID authorization.
- safety: All submit-type controls are now forbidden regardless of label. `CA_continue` is detected but never clicked. The popup blocks Fill when Preview reports adapter errors.
- fixtures/tests: Added capture-derived unit and browser fixtures covering closed/open dialogs, multi-author order, corresponding status, existing-author refusal, missing-data refusal, validation, and zero page-continuation clicks.
- verification: 182 Vitest tests, typecheck, production build, zero-warning security lint, and three Playwright MV3 journeys passed, including production popup → bioRxiv Preview → three modal saves → validation with zero `CA_continue` clicks.
- status: First authenticated live bioRxiv smoke remains required before claiming live validation.

### 2026-08-13 01:30 UTC
- import reliability: Reproduced the supplied HGCA workbook's 17-column header shape. Unknown, ambiguous, duplicate-affiliation, and administrative columns now default to Ignore; required name columns remain detected. Mapping updates use functional state so a final selection cannot be lost before Import.
- interaction feedback: Preview/Fill show working labels, busy states, and tactile button response. Inline input/action errors use a brief low-intensity red pulse with reduced-motion support.
- example fixture: Removed the deliberately linked second-author PID from the default Nature demo so the ordinary three-author example is a successful fill; linked-account refusal remains covered by dedicated adapter/security tests.
- workflow simplification: Replaced roster CRUD/edit/export controls with a read-only imported-author review and issue summary. Source corrections happen in the spreadsheet followed by re-import.
- Sheets: Made clipboard import explicitly Google Sheets/Excel friendly. Configured builds now support read-only Google Sheet URL import through Chrome Identity; unconfigured builds retain the three-permission/no-host-permission manifest and direct users to private clipboard paste.
- bioRxiv intake: Added reviewed capture download, an unsupported-portal capture entry point, and two-state instructions for the author page plus empty repeated-author dialog. No selectors were guessed without the captures.
- verification: 175 Vitest tests, typecheck, production build, zero-warning security lint, and two Playwright MV3 journeys passed. Default manifest remains `activeTab`/`storage`/`scripting` with no host permissions; a dummy configured build added only `identity`, `https://sheets.googleapis.com/*`, and `spreadsheets.readonly`.

### 2026-08-13 01:00 UTC
- changed: Added an official Playwright MV3 end-to-end environment for remote Cursor terminals. It launches current bundled Chromium with an isolated persistent context, loads a test copy of the production extension, and intercepts the pinned localhost fixture without another server.
- safety gate: E2E setup rejects production manifests with host permissions, automatic content scripts, or permissions beyond `activeTab`, `storage`, and `scripting`. Only the ignored `.wxt/` test copy receives a localhost host grant because programmatic popup tabs do not receive a toolbar `activeTab` gesture.
- browser journey: Production popup imports CSV, proves Preview is dry, proves overwrite changes invalidate Preview, fills only safe author blocks, validates the linked conflict, and confirms submit/certify/copyright/payment controls were never clicked.
- developer experience: `test:e2e`, headed, UI, and report scripts; retained trace/screenshot/video on failure; README guidance for remote testing and safe bioRxiv compatibility capture.
- verification: Playwright 1.62.1 with Chrome for Testing 151; E2E passed. Typecheck, 173 Vitest tests, production build, and lint passed.

### 2026-08-12 23:20 UTC
- changed: Bound every successful Preview to roster ID + `updatedAt`, overwrite setting, and the active tab ID + URL. Fill stays disabled for stale/missing Preview state, and the bridge rechecks the expected tab immediately before sending a mutating request.
- UX: Sample onboarding is development-build only; selector confidence is shown separately from block completeness; every author block remains inspectable in a bounded scroll region; action errors now appear beside Preview/Fill in an accessible live region.
- correctness/privacy: Validation transport errors no longer read as successful validation. Local activity copy now accurately names stored timestamp, operation, portal family, roster ID, and aggregate counts.
- tests added: stale roster/version/setting/tab Preview checks, expected-tab enforcement including a pre-send tab switch, and exact-selector/incomplete-block separation.
- verification: typecheck, 173 tests, production build, and lint passed. Production manifest contains only `activeTab`, `storage`, and `scripting`, with no host permissions or content-script registration. Fresh WXT browser used `.wxt/chrome-data` and opened the pinned fixture; detection, sample load, dry Preview, Fill, validation, confidence/completeness, and protected-control checks passed. The fixture's linked/conflicting Alan Turing block was intentionally preserved while the two safe blocks filled.

### 2026-08-12 16:20 UTC
- commits: `0d284b0` founder context and strategic backlog alignment; `9770509` one-click sample roster
- changed: Added `docs/FOUNDER_CONTEXT.md`; made it required reading in `AGENTS.md`; aligned product/privacy naming; added Now/Soon/Later/Explicitly deferred opportunities to roadmap and backlog without removing existing tasks.
- architecture review: Current local-first canonical schema, deterministic adapter interface, confidence hierarchy, dry-run, and validation align with founder direction. No large redesign needed.
- user-visible: Empty state now offers “Try a sample roster”; creates three canonical example authors, saves/selects locally, and leads directly to Preview → Fill → validate on the synthetic Nature fixture.
- tests: canonical sample/storage/fresh-ID coverage; first-use sample journey proves Preview does not mutate, then Fill and validation succeed; full suite 155 passed, typecheck and build passed.
- follow-up commits: `163fba4` persists the selected roster in local extension storage; `3cc1990` tightens storage-backend typing.
- repeated-use workflow: reopening the popup restores a valid remembered roster, falls back safely after deletion, and clears the preference when no rosters remain.
- Preview commit: `7e6a96d` groups mappings by author sequence and shows Exact/tested, Semantic, or Unresolved badges plus missing/conflict counts. Exact classification is platform-scoped to tested Nature IDs.
- audit commit: `28f0521` switches the popup from memory-only to local `chrome.storage.local` activity metadata and aggregate counts; records Preview and Fill separately, refuses PII-like entries, caps at 200, and exposes a clear control under Advanced. Audit failure cannot break Preview/Fill.
- adversarial/privacy follow-up: `9a96b08` marks sample rosters explicitly, requires successful Preview, blocks sample Fill outside the pinned localhost Nature fixture, adds an atomic double-click guard, and treats optional ORCID as advisory rather than “not ready.”
- quality follow-up: `6007eae` preserves the caught injection error cause, clearing the inherited ESLint failure.
- verification: preference, Preview confidence, persistent audit, sample safety, double-click, and fixture-URL tests; full suite 163 passed; typecheck, build, and lint passed.
- next: Hands-on browser smoke review, then safe XLSX dependency decision or bioRxiv/eLife fixture investigation.

### 2026-08-12 16:15 UTC
- commit: `c7e2fdc` `npm run dev` opens Nature fixture via `webExt.startUrls`
- changed: Pin WXT Vite port 3000 (`strictPort`); Vite middleware serves `fixtures/` at `/fixtures/*` on the existing server; `webExt.startUrls` → `http://localhost:3000/fixtures/nature-mts-sample.html`. Document that `--disable-blink-features=AutomationControlled` comes from web-ext (not our chromiumArgs). No production permission changes; no second server.
- tests: typecheck, suite, build; verify Chrome opens fixture URL + `--load-extension=...chrome-mv3-dev`.
- next: Kyle Preview/Fill against auto-opened fixture.

### 2026-08-12 16:00 UTC
- commit: `898e41d` persistent Chromium profile for `npm run dev`
- changed: `wxt.config.ts` `webExt.chromiumArgs` → `--user-data-dir=./.wxt/chrome-data` (official WXT Mac/Linux pattern). Added `web-ext` **10.6.0** as a devDependency so WXT auto-opens Chrome (without it, WXT falls back to “load unpacked manually”). README “Kyle's testing workflow”. `.wxt` already gitignored; no extension permission changes.
- verified: first `npm run dev` created `.wxt/chrome-data` + Default/Cookies; after Ctrl+C and second `npm run dev`, marker file + Cookies inode unchanged; Chrome cmdline includes `--user-data-dir=./.wxt/chrome-data`.
- audit note: `npm audit --omit=dev` stays clean; full `npm audit` may report `web-ext` → `addons-linter` → `image-size` highs (dev-only launcher).
- tests: typecheck, full suite, build.
- next: Kyle day-to-day testing against Nature MTS with surviving rosters/cookies.

### 2026-08-12 15:30 UTC
- commit: `8283484` popup crash fix — `Cannot read properties of undefined (reading 'type')`
- changed: `sendToActiveTab` now always returns a typed `ExtensionResponse`. Chrome `tabs.sendMessage` can resolve to `undefined` when the content script does not reply; callers were reading `res.type` and crashing the popup on load (DETECT). Added `normalizeTabResponse`, safer ensure/inject/retry, unit tests.
- tests: tabBridge unit tests + full suite.
- next: User must rebuild (`.output/chrome-mv3`) and reload the unpacked extension; stale builds still show old tagline/Sheets OAuth UI.

### 2026-08-12 15:20 UTC
- commit: `b4f1200` (harmonize merge of PR #2 + PR #3 into main)
- changed: Merged security hardening (Semgrep/ESLint, roster quarantine, linked-PID/corr conflicts, diagnostic redaction, CSV formula escape, message Zod, WXT audit fix) with first-use UX (compact popup, Preview results, paste/CSV import, Manage roster, Sheets/Excel architecture).
- tests: full suite after merge.
- next: Persist selected roster; sample import; live Sheets when credentials arrive.

### 2026-08-12 15:15 UTC
- commit: `6253f5261fb6700c2b07d9897eb14691fdc87556`
- changed: First-use UX — compact main popup; Preview result card (exact/semantic/preserved/unresolved/conflicts) with dry-run safety; detection error recovery; Manage roster secondary view; unified Import authors (paste TSV, CSV drag-drop, Excel stub, Sheets “Choose Google Sheet” coming-soon); attention-first author list; Advanced diagnostics; Sheets/Excel architecture docs. No package dependency changes.
- tests: `npm test` (128 passed), `npm run typecheck`, `npm run build`. New: pasteTable, previewSummary, authorAttention, fileKinds, first-use journey (3/75/500).
- limitations: Excel parse deferred (docs/EXCEL_IMPORT.md); Google Picker + OAuth credentials still blocked for live Sheets; no sample-roster one-click yet.
- next: Persist selected roster; sample import; live Sheets when credentials arrive.

### 2026-08-12 15:00 UTC
- commit: `c2aad211eb6bd5ce1fc0aea124ba8d330aec6a02`
- tooling decision: **Semgrep CE** as primary OSS SAST (`p/javascript`, `p/typescript`, `p/security-audit`) + **ESLint eslint-plugin-security** for IDE/CI + **npm audit** for deps + **Gitleaks** for secrets. CodeQL deferred (needs GH Advanced Security workflow); Snyk/Sonar commercial skipped.
- changed: WXT `0.19.29` → `0.21.4` (clears npm audit CVEs). Hardening: roster storage no longer silent-wipes invalid docs (salvage + durable quarantine key); linked-PID conflict when roster email missing or portal identity blank; corresponding block skips on contrib conflict; inspect strips field values; safety normalizes snake_case (`final_submit`); diagnostic label/option/URL hash/userinfo redaction with fail-closed `redactionComplete` + UI export block; CSV formula neutralization + import denature; Zod validation of extension messages; Sheets API errors sanitized; skip disabled/readOnly fields; safer country select matching; inject only http(s) tabs.
- tests: `npm test` (126 passed), `npm run typecheck`, `npm run build`, `npm audit` (0), `npm run lint:security` (0), `npm run semgrep` (0 findings), gitleaks (no leaks).
- next: wire audit log to chrome.storage; empty-state sample roster; live Nature MTS HTML when available.

### 2026-08-12 04:28 UTC
- commit: `aa054cb924ee04dd6f32258dcbc128c5639d0745`
- changed: Greenfield scaffold of journal-autofill as WXT + React + TS MV3 extension; canonical Zod author schema; adapter interface + Nature MTS adapter with synthetic fixture; CSV import + column mapping; local roster storage; Google Sheets read-only abstraction/mocks; diagnostics probe; adapter registry + stubs; popup Preview/Fill UX; commercial docs (privacy, threat model, CWS permissions, release checklist, Sheets setup). Manifest ships without automatic `content_scripts` (activeTab inject only).
- tests: `npm test` (37 passed), `npm run typecheck`, `npm run build` → `.output/chrome-mv3` with permissions `activeTab`, `storage`, `scripting` only.
- limitations: Nature MTS based on observed IDs (synthetic fixture, not live HTML); Google OAuth credentials unavailable; popup roster CRUD UI incomplete (storage API ready); Sheets UI not yet in popup.
- next: Popup roster management UI; Sheets import UI over mocks; real Nature MTS HTML fixture from Kyle.

### 2026-08-12 04:31 UTC
- commit: `762d98d42802ccc9236420dc193c2cea82206515`
- changed: Popup roster CRUD (create/rename/duplicate/delete/export JSON|CSV, author edit/reorder); Sheets import flow + popup UI gated on OAuth config; local HTML/CSV fixtures; `docs/BLOCKERS.md`; richer preview conflict/missing lists.
- tests: `npm test` (44 passed), `npm run typecheck`, `npm run build`.
- limitations: Sheets still blocked without Kyle OAuth credentials; Nature MTS still synthetic; no live portal validation.
- next: OAuth credentials; live Nature MTS HTML; portal diagnostic captures for ScholarOne/EM.

### 2026-08-12 04:32 UTC
- commit: `d2d1e82495c714fff4d111f8bf6c4e07b8dba231`
- changed: ORCID normalization on import/edit; add/remove author rows in popup; mutation tests.
- tests: `npm test` (48 passed), `npm run typecheck`, `npm run build`.
- limitations: Further reliable portal adapters blocked on real DOM fixtures and OAuth credentials from Kyle.
- next: Stop on external blockers; Kyle provides OAuth + live HTML captures.

### 2026-08-12 05:30 UTC
- changed: Identity schema v2 (`identityV2.ts`) with optional expansions; v1↔v2 migration bridges (`migrate.ts`); provenance model; local-only audit log (`audit/localLog.ts`) with PII redaction invariants; schema/audit tests.
- tests: `npm test` (112 passed), `npm run typecheck`.
- next: Wire audit log into fill flow; optional v2 import/export in popup.

### 2026-08-12 05:35 UTC
- commit: `e04b18dd433c69461ace7bb1b01f95ae54a44b7e`
- changed: Overnight reliability build — semantic recognition + confidence hierarchy; author-group detection; fast-check property tests; DOM chaos harness; adapter contract suite; compatibility capture/redaction; fixture corpus replay; identity v2 + provenance; local audit trail; failure states; Corresponding branding/UX tokens; perf benchmarks; platform research; DX scripts/template; coverage report.
- tests: `npm test` (106 passed), `npm run typecheck`, `npm run build`, `npm run test:coverage`.
- reports: chaos 40/40 correct unsafe=0; fixture replay detection/mapping/unsupported pass rate 1.0; perf 10→1000 authors within thresholds.
- limitations: External OAuth + live portal fixtures still required for Sheets and new adapters; popup UI largely untested by unit coverage.
- next: First-run empty-state UX; Preview confidence badges; raise coverage on chromeClient/popup.
