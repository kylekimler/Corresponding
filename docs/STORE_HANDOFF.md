# Chrome Web Store and download handoff

Prepared September 13, 2026. No listing URL is configured in this repository;
no public GitHub release exists. A public search found no matching listing; this does not prove absence.
Store dashboard status has not been inspected.
This is an upload/reviewer packet, not a claim of approval or publication.

## Build and identify the candidate

From the reviewed source with Node 22.13+:

```sh
npm ci
npm test
npm run typecheck
npm run lint:security
npm run build
npm run build:web
npx playwright test
npm run zip
shasum -a 256 .output/corresponding-0.1.0-chrome.zip
```

The current extension is version 0.1.0. Inspect the ZIP's root manifest; it must
contain no live OAuth credentials, broad host permissions or remote executable
code. Default permissions: activeTab, storage, scripting. Narrow content-script
matches also grant site access: disclose those, not just the three API names.
Use [CWS_PERMISSIONS.md](CWS_PERMISSIONS.md) for exact rationale and
[PRIVACY.md](PRIVACY.md) for processing and optional integrations.

## Listing materials

- Name: Corresponding.
- Single purpose: fill scientific author metadata from a local roster into
  supported submission forms, with human review and no final submission.
- Description facts: free, MIT, no Corresponding account; roster preparation;
  supported platform/fixture limitations from README; preservation by default;
  institution/CRediT/manual-review caveats; no universal accuracy or measured
  time-saving promise. Google Sheets OAuth is not configured in the default build.
- Support: corresponding.app@gmail.com and public GitHub issues, once accessible.
- Homepage: https://corresponding.pages.dev (must resolve before submission).
- Privacy URL: public docs/PRIVACY.md URL after visibility/privacy gate clears,
  or a reviewed publicly hosted policy. Remove draft status only after review.
- Data disclosures: author/contact/affiliation data is processed and stored on
  device; website draft uses localStorage; extension uses chrome.storage.local.
  Filling writes data to the journal page. Optional eligible-fill request body
  is `{ "v": 1, "authors": N }`; v is protocol version, not extension version.
  Ordinary network requests expose connection metadata such as source IP to the
  receiving service; author-count-only describes the body, not network anonymity.
  Review actual host retention and the current dashboard's categories before
  making privacy declarations. Never certify disclosures automatically.
- Screenshots still require owner review before upload: capture the actual
  packaged extension with synthetic authors, including Preview, review warnings,
  and the post-fill state. Browser-test homepage images are QA evidence, not a
  complete store screenshot set. Do not reuse historical unreviewed portal shots.

## Reviewer test instructions

No journal credentials are needed for a local fixture trial. This exercises
real adapter code against synthetic HTML and does not certify a live publisher.

1. Load the submitted extension (or unpack its ZIP and Load unpacked during
   rehearsal). Keep this exact package; do not substitute the development extension.
2. Check out the same reviewed source. Start `npm run dev:web`, open
   http://localhost:5173, create a manuscript, and import `fixtures/sample-authors.csv`.
   Confirm local extension synchronization. All addresses use example.org.
3. With Python 3 available, from the source root run
   `python3 -m http.server 3000 --bind 127.0.0.1` in a separate terminal. This is
   a local test server; stop it after review. Open
   http://localhost:3000/fixtures/nature-mts-sample.html in Chrome.
4. Open Corresponding's toolbar popup. Preview, inspect the planned values,
   then Fill. Compare the three author blocks against the CSV; inspect warnings
   and existing-field preservation. Never click Submit, certification, copyright,
   payment or other protected controls. The fixture is synthetic Nature coverage.
5. For no-extension website review, click Try a sample roster, edit an email,
   and reload. That six-author sample is intentionally blocked from live fills.

Before selecting a launch date, the owner must inspect the store dashboard,
complete its current listing/privacy/distribution/test-instruction requirements,
and choose review/publishing timing. [Chrome's publishing guide](https://developer.chrome.com/docs/webstore/publish/)
allows deferred publishing after review; review duration is variable.
