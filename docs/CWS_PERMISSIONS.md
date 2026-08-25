# Chrome Web Store Permission Justification

## Permissions requested

### `activeTab`

Used only when the user opens the extension on a manuscript submission page. Enables inspecting and filling author fields in the active tab without broad host access.

### `storage`

Stores saved author rosters and settings locally on the user’s device. Author PII is not transmitted to a journal-autofill backend.

### `scripting`

Injects the content script on demand into the active tab after the user invokes the extension, so form detect/preview/fill/validate can run. Not used for remote code.

## Host permissions

None required for Nature MTS filling (activeTab model).

`externally_connectable` is not a permission. It lets `https://corresponding.app`
save a roster into local extension storage. It does not grant access to journal
sites, and website messages cannot trigger fill.

A content script runs only on corresponding.app (and local Vite ports in
development). It announces that the extension is installed. It does not read
author fields or journal pages.

Optional future Google Sheets import may add OAuth (`identity`) and Google API host access limited to Sheets read-only endpoints — only when credentials are configured and the feature is enabled. Sheets write access will not be requested.

## Single purpose

Help scientists stop retyping author lists into journal submission forms.
Fill author metadata from a local roster, with preview and validation, without
performing final submission or legal attestations. No account. No trial.
