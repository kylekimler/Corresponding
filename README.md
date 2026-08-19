<p align="center">
  <img src="public/icons/corr-128.png" alt="Corresponding" width="96" height="96" />
</p>

# Corresponding

**Stop entering every author into journal submission forms by hand.**

Corresponding is a free, open-source Chrome extension that takes the author list you already have and fills journal submission forms for you.

Import a spreadsheet. Check the preview. Fill the form. Review it. Submit the paper yourself.

No account. No backend. No author data leaves your device.

> If you have ever entered 40, 70, or 100+ coauthors one at a time, this is for you.

MIT license. No account. No trial. No freemium gate.

## See it work

Demo recordings are incoming. Drop local files in [`docs/media/`](docs/media/) (gitignored) as:

- `docs/media/scholarone-demo.mov`
- `docs/media/plos-one-demo.mov`
- `docs/media/medrxiv-demo.mov`

Public GitHub attachment links will replace the placeholders below.

### Nature Portfolio

<!-- https://github.com/user-attachments/assets/NATURE_DEMO_PLACEHOLDER -->

### Editorial Manager / PLOS

<!-- https://github.com/user-attachments/assets/PLOS_DEMO_PLACEHOLDER -->

### ScholarOne / Bioinformatics

<!-- https://github.com/user-attachments/assets/SCHOLARONE_DEMO_PLACEHOLDER -->

### bioRxiv / medRxiv

<!-- https://github.com/user-attachments/assets/BIORXIV_DEMO_PLACEHOLDER -->

## Supported platforms

| Platform | Autofill |
| --- | --- |
| Nature Portfolio | ✅ |
| bioRxiv / medRxiv | ✅ |
| Editorial Manager | ✅ |
| ScholarOne | ✅ |
| Elsevier | ⬜ |
| Wiley | ⬜ |
| Frontiers | ⬜ |
| PLOS | ✅ |
| eLife | ⬜ |

Support is tested against real author-entry workflows and redacted fixtures. Journal configurations vary, so a supported platform does not guarantee every journal on that platform behaves identically.

**Your journal isn't supported? Open an issue and paste a screenshot.**

[Open an issue — add a journal](https://github.com/kylekimler/Corresponding/issues/new?template=add-journal.yml)

Redact names, emails, and manuscript text. The author-form layout is enough.

A checkmark means a fixture-tested author-form fill. It does not mean every title under that publisher, and it never means the extension submits the paper.

### Every publisher is a release

| Version | Unlock |
| --- | --- |
| v0.1 | Nature Portfolio |
| v0.1 | bioRxiv / medRxiv |
| v0.2 | Editorial Manager / PLOS author form |
| v0.2 | ScholarOne / Bioinformatics |
| v0.7 | Cell Press |
| v0.8 | Wiley |
| v0.9 | 100 journals |

See [CHANGELOG.md](CHANGELOG.md). Empty squares move to ✅ only after a redacted fixture and a tested adapter.

## How it works

1. Open a manuscript submission portal.
2. Open Corresponding.
3. Import your author roster.
4. Confirm the column mapping if needed.
5. Preview what Corresponding found.
6. Click **Fill**.
7. Review the result.
8. Finish the submission yourself.

Corresponding currently accepts CSV rosters and saved local rosters. It can also extract structured author tables from `.docx` manuscripts when given-name and family-name columns are explicit.

Install the extension → import a spreadsheet or ORCIDs → fill the form → submit the paper yourself.

## What Corresponding fills

Corresponding is deliberately narrow.

It handles author metadata such as:

- given name
- family name
- email
- affiliation fields
- other author fields supported by the detected portal

It does **not** submit manuscripts, accept legal terms, sign forms, make declarations, invite reviewers, pay fees, or complete copyright and certification steps.

Those actions always stay with you.

## Local by default

Author lists contain personal information. Corresponding keeps them local.

- No Corresponding account
- No author database
- No autofill backend
- No passwords or cookies collected
- No unrelated browsing history collected
- No broad host permissions for form filling

The extension uses Chrome's `activeTab`, `storage`, and `scripting` permissions and runs when you invoke it on the current page.

## Why this exists

The manuscript is finished. The figures are finished. Seventy-four people have somehow agreed on the author order.

Then the submission system asks:

> Given name  
> Family name  
> Email  
> Affiliation  
> Department  
> City  
> Country  
> ORCID  
> Corresponding author?

And then it asks again for author 2.

And author 3.

And author 74.

Corresponding exists because this should take a few seconds.

## Install

Corresponding is still under active development.

### From source

```bash
git clone https://github.com/kylekimler/Corresponding.git
cd Corresponding
npm install
npm run build
```

Then open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select:

```text
.output/chrome-mv3
```

A packaged release / Chrome Web Store install will replace this section when available.

## Contributing a journal

Submission systems are messy, but many author forms can be described with a small adapter.

Your journal broken? Add support in ~10 lines.

```json
{
  "id": "example-society",
  "label": "Example Society Journal",
  "autofill": true,
  "detect": { "ids": ["author_1_first"] },
  "authors": {
    "slot": "author_{n}_first",
    "fields": {
      "givenName": "author_{n}_first",
      "familyName": "author_{n}_last",
      "email": "author_{n}_email"
    }
  }
}
```

Add the adapter under [`sites/`](sites/). IDs only — no clicks, no guessed selectors.

See [`docs/ADDING_AN_ADAPTER.md`](docs/ADDING_AN_ADAPTER.md) for the fixture and adapter workflow.

If you do not want to write code, open an issue with a redacted screenshot of the author-entry form. That is enough to start.

## Development

```bash
npm install
npm test
npm run typecheck
npm run build
npm run dev
```

`npm run dev` launches a dedicated Chrome test profile with Corresponding installed.

For automated browser tests:

```bash
npx playwright install chromium
npm run test:e2e
```

| Command | Purpose |
| --- | --- |
| `npm run test:e2e` | Full Chromium extension flow |
| `npm run test:e2e:headed` | Watch the browser test |
| `npm run test:e2e:ui` | Playwright UI |
| `npm run test:adapters` | Adapter contract tests |
| `npm run test:fixtures` | Fixture recognition |
| `npm run test:fuzz` | Property and chaos tests |
| `npm run benchmark` | Synthetic performance checks |
| `npm run test:coverage` | Coverage report |
| `npm run typecheck` | TypeScript checks |

More implementation and testing notes live in [`docs/`](docs/).

## Safety boundary

Corresponding never automates:

- final submission
- certification
- copyright acceptance
- conflict-of-interest attestations
- payment
- signatures
- reviewer invitations

If Corresponding cannot confidently understand an author form, it should fail closed rather than guess.

## License

[MIT](LICENSE).

Use it. Share it. Fork it. Add your journal.
