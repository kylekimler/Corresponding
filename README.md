<p align="left">
  <img src="public/icons/corr-128.png" alt="Corresponding" width="96" height="96" />
</p>

# Corresponding

**Stop entering every author into journal submission forms by hand.**

Corresponding is a free, open-source Chrome extension that takes the author list you already have and fills journal submission forms for you.

> If you have ever entered 20, 50, or 100+ coauthors one at a time, this is for you.

## See it work

### Editorial Manager / PLOS

<img src="docs/media/plos-one.gif" width="400" alt="Editorial Manager filling a PLOS ONE author form">

### ScholarOne / Bioinformatics

<img src="docs/media/scholarone.gif" width="400" alt="ScholarOne filling a Bioinformatics author form">

### bioRxiv / medRxiv

<img src="docs/media/medrxiv.gif" width="400" alt="medRxiv filling an author form">

## Supported platforms

| Platform | Status |
| --- | --- |
| Nature Portfolio | Supported! |
| bioRxiv / medRxiv | Supported! |
| Editorial Manager | Supported! |
| PLOS | Supported! |
| ScholarOne / Manuscript Central | Supported! |
| Cell Press | Not yet |
| Wiley | Not yet |
| Frontiers | Not yet |
| eLife | Not yet |

**If you would really like your journal supported** [Open an issue](https://github.com/kylekimler/Corresponding/issues/new?template=add-journal.yml)

## How it works

1. Install the Corresponding Chrome Extension
2. Open a manuscript submission portal.
3. Open Corresponding.
4. Import your author roster by copy+pasting a table or the top of your article or uploading a tabular format file (csv, tsv, etc)
5. Confirm the column mapping if needed.
6. Click **Fill**.
7. Review the result.
8. Finish the submission yourself.

## To contribute a journal yourself:

Many author forms can be described with a small adapter like:

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

Add the adapter under [`sites/`](https://github.com/kylekimler/Corresponding/tree/main/sites).
Open a Pull Request with your addition.
See [`docs/ADDING_AN_ADAPTER.md`](https://github.com/kylekimler/Corresponding/blob/main/docs/ADDING_AN_ADAPTER.md) for the fixture and adapter workflow.

Again, if you don't want to write code, open an issue and I'll try to add your journal :)

## Data safety

**Corresponding does not collect your information**, 
**Corresponding does not give your information to any AI** (even though it was coded with AI help)

## License

[MIT](https://github.com/kylekimler/Corresponding/blob/main/LICENSE).

### Support Corresponding

If Corresponding saved you some time, you can [leave a tip](https://github.com/sponsors/kylekimler).
