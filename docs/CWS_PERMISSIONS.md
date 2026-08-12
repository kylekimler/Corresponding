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

Optional future Google Sheets import may add OAuth (`identity`) and Google API host access limited to Sheets read-only endpoints — only when credentials are configured and the feature is enabled. Sheets write access will not be requested.

## Single purpose

Help scientists fill author metadata on journal submission forms from a local canonical roster, with preview and validation, without performing final submission or legal attestations.
