# Excel / XLSX import

## Goal

Scientists should be able to upload `.xlsx` author tables the same way they upload CSV.

## Dependency assessment (do not add until decided)

| Library | Maintained | Approx. browser bundle | License | Notes |
|---------|------------|------------------------|---------|-------|
| **SheetJS Community (`xlsx`)** | Active (community) | ~200–400 KB min+gz depending on features | Apache-2.0 (community build) | Widest format support; watch npm package provenance (`xlsx` vs `sheetjs`) |
| **ExcelJS** | Active | Larger; more Excel styling APIs than we need | MIT | Overkill for header+rows import |
| **read-excel-file** | Active | Smaller read-only | MIT | Attractive size; fewer edge formats |

### Security / product fit

- Prefer a **read-only** parse path; never evaluate formulas.
- Pin an exact version; run `npm audit` before enabling.
- Proprietary commercial product: MIT / Apache-2.0 are acceptable; avoid GPL.
- Browser MV3: parse in the popup (or offscreen document) — no Node `fs`.

### Recommendation

**Defer enabling Excel in the shipped build** until a pinned package is chosen after a fresh size + audit pass.

Ship now:

1. UI entry: “Upload Excel” with a clear “coming soon / use CSV or paste” state.
2. `detectImportFileKind()` recognizing `.xlsx` / `.xls`.
3. Paste-from-spreadsheet and CSV as the supported paths.

When enabling: prefer **`read-excel-file`** (MIT, small) or a carefully pinned SheetJS community build if broader format support is required. Re-evaluate bundle impact against the popup budget.

## Abstraction

```ts
// Conceptual
type ImportedTable = { headers: string[]; rows: string[][]; source: 'excel' };
async function parseExcelFile(file: File): Promise<ImportedTable>;
```

Downstream reuses `suggestColumnMapping` + `rowsToRoster` unchanged.
