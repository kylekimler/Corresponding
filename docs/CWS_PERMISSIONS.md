# Chrome Web Store Permission Justification

## Permissions requested

### `activeTab`

Used when the user opens the extension on a page that is not already covered
by the contextual autofill content script. Enables inspecting and filling
author fields in the active tab without broad host access.

### `storage`

Stores saved author rosters and settings locally on the user’s device. Author PII is not transmitted to a journal-autofill backend.

### `scripting`

Injects the content script on demand into the active tab after the user invokes the extension, so form detect/preview/fill/validate can run on pages without a registered journal match. Not used for remote code.

## Host permissions

No separate `host_permissions` array is requested. Registered content scripts
do grant access to their matched sites and can produce Chrome site-access
warnings at installation or update. This is an intentional expansion from the
previous activeTab-only journal workflow; include it in the store review.
See [Chrome permission declarations](https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions).

`externally_connectable` is not a permission. It lets `https://corresponding.app`
save a roster into local extension storage. It does not grant access to journal
sites, and website messages cannot trigger fill.

Content scripts:

- corresponding.app (and local Vite ports, including unpacked production builds) — announces that
  the extension is installed. Does not read author fields or journal pages.
- Known submission hosts already backed by a fill adapter (Editorial Manager,
  ScholarOne / Manuscript Central, bioRxiv / medRxiv submit hosts) plus local
  fixtures — detect author-entry pages and show a small fill control. The
  script does not run on `<all_urls>`, does not store page HTML, and does not
  fill until the user clicks. Live Nature / eJournalPress hosts are not
  guessed; those pages still use the popup + activeTab path.

Optional future Google Sheets import may add OAuth (`identity`) and Google API host access limited to Sheets read-only endpoints — only when credentials are configured and the feature is enabled. Sheets write access will not be requested.

## Single purpose

Help scientists stop retyping author lists into journal submission forms.
Fill author metadata from a local roster, with preview and validation, without
performing final submission or legal attestations. No account. No trial.
