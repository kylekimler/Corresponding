import { useEffect, useMemo, useState } from 'react';
import type { DetectResult, FillReport, ValidateReport } from '@/adapters/types';
import { parseCsv } from '@/import/csv';
import {
  mappingIsComplete,
  suggestColumnMapping,
  type CanonicalColumn,
  type ColumnMapping,
} from '@/import/columnMap';
import { rowsToRoster } from '@/import/rosterFromTable';
import {
  addAuthor,
  createEmptyRoster,
  removeAuthor,
  reorderAuthors,
  renameRoster,
  setCorrespondingAuthor,
  updateAuthor,
} from '@/roster/mutations';
import { normalizeOrcid } from '@/schema/orcid';
import { createRosterStore } from '@/roster/storage';
import type { Author, Roster } from '@/schema/author';
import { previewCapture } from '@/diagnostics/capture';
import { createChromeGoogleSheetsClient } from '@/sheets/chromeClient';
import {
  loadSheetPreview,
  rosterFromSheetPreview,
  type SheetsImportPreview,
} from '@/sheets/importFlow';
import { SheetsNotConfiguredError } from '@/sheets/types';
import { failureState, formatFailure } from '@/failure/states';
import { createMemoryAuditLog } from '@/audit/localLog';
import { sendToActiveTab } from './tabBridge';

const store = createRosterStore();
const sheetsClient = createChromeGoogleSheetsClient();
const auditLog = createMemoryAuditLog();

function ColumnSelect(props: {
  value: CanonicalColumn | '';
  onChange: (v: CanonicalColumn) => void;
}) {
  return (
    <select
      value={props.value}
      onChange={(e) =>
        props.onChange((e.target.value || 'ignore') as CanonicalColumn)
      }
    >
      <option value="">— select —</option>
      <option value="givenName">Given / first name</option>
      <option value="middleName">Middle name</option>
      <option value="familyName">Family / last name</option>
      <option value="email">Email</option>
      <option value="orcid">ORCID</option>
      <option value="institution">Institution</option>
      <option value="department">Department</option>
      <option value="city">City</option>
      <option value="state">State</option>
      <option value="country">Country</option>
      <option value="isCorresponding">Corresponding?</option>
      <option value="sequence">Sequence</option>
      <option value="ignore">Ignore</option>
    </select>
  );
}

function downloadText(filename: string, contents: string, mime: string) {
  const blob = new Blob([contents], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function App() {
  const [rosters, setRosters] = useState<Roster[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [overwrite, setOverwrite] = useState(false);
  const [detected, setDetected] = useState<DetectResult | null>(null);
  const [preview, setPreview] = useState<FillReport | null>(null);
  const [validation, setValidation] = useState<ValidateReport | null>(null);
  const [status, setStatus] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [pendingMapping, setPendingMapping] = useState<{
    headers: string[];
    rows: string[][];
    mapping: ColumnMapping;
    name: string;
    source: 'csv' | 'google_sheets';
  } | null>(null);
  const [diagText, setDiagText] = useState('');
  const [renameValue, setRenameValue] = useState('');
  const [editingAuthorId, setEditingAuthorId] = useState<string>('');
  const [authorDraft, setAuthorDraft] = useState<Partial<Author>>({});
  const [sheetUrl, setSheetUrl] = useState('');
  const [sheetPreview, setSheetPreview] = useState<SheetsImportPreview | null>(
    null,
  );

  const selected = rosters.find((r) => r.id === selectedId) ?? null;
  const sortedAuthors = useMemo(
    () =>
      selected
        ? [...selected.authors].sort((a, b) => a.sequence - b.sequence)
        : [],
    [selected],
  );

  async function refreshRosters(preferId?: string) {
    const list = await store.list();
    setRosters(list);
    const nextId = preferId ?? selectedId;
    if (nextId && list.some((r) => r.id === nextId)) {
      setSelectedId(nextId);
    } else if (list[0]) {
      setSelectedId(list[0].id);
    } else {
      setSelectedId('');
    }
  }

  useEffect(() => {
    void refreshRosters();
    void (async () => {
      const res = await sendToActiveTab({ type: 'DETECT' });
      if (res.type === 'DETECT_RESULT') setDetected(res.result);
    })();
  }, []);

  useEffect(() => {
    setRenameValue(selected?.name ?? '');
    setEditingAuthorId('');
  }, [selected?.id]);

  async function onCsvFile(file: File) {
    setError('');
    const text = await file.text();
    const { headers, rows } = parseCsv(text);
    const mapping = suggestColumnMapping(headers);
    const name = file.name.replace(/\.csv$/i, '') || 'Imported roster';
    if (mapping.requiresConfirmation || !mappingIsComplete(mapping.map)) {
      setPendingMapping({ headers, rows, mapping, name, source: 'csv' });
      setStatus('Confirm column mapping before import.');
      return;
    }
    const roster = rowsToRoster({
      name,
      headers,
      rows,
      mapping: mapping.map,
      source: 'csv',
    });
    await store.importRoster(roster);
    setPendingMapping(null);
    await refreshRosters(roster.id);
    setStatus(`Imported ${roster.authors.length} authors.`);
  }

  async function confirmMapping() {
    if (!pendingMapping) return;
    if (!mappingIsComplete(pendingMapping.mapping.map)) {
      setError('Map at least First/Given name and Last/Family name.');
      return;
    }
    const roster = rowsToRoster({
      name: pendingMapping.name,
      headers: pendingMapping.headers,
      rows: pendingMapping.rows,
      mapping: pendingMapping.mapping.map,
      source: pendingMapping.source,
    });
    await store.importRoster(roster);
    setPendingMapping(null);
    setSheetPreview(null);
    await refreshRosters(roster.id);
    setStatus(`Imported ${roster.authors.length} authors.`);
  }

  function updateMapping(columnIndex: number, value: CanonicalColumn) {
    if (!pendingMapping) return;
    const map = { ...pendingMapping.mapping.map, [columnIndex]: value };
    setPendingMapping({
      ...pendingMapping,
      mapping: { ...pendingMapping.mapping, map },
    });
  }

  async function createRoster() {
    const roster = createEmptyRoster(`Roster ${rosters.length + 1}`);
    await store.save(roster);
    await refreshRosters(roster.id);
    setStatus('Created empty roster. Import CSV/Sheets or edit authors.');
  }

  async function saveRename() {
    if (!selected) return;
    try {
      const next = renameRoster(selected, renameValue);
      await store.save(next);
      await refreshRosters(next.id);
      setStatus('Roster renamed.');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function duplicateSelected() {
    if (!selected) return;
    const dup = await store.duplicate(selected.id);
    await refreshRosters(dup.id);
    setStatus(`Duplicated as “${dup.name}”.`);
  }

  async function deleteSelected() {
    if (!selected) return;
    if (!confirm(`Delete local roster “${selected.name}”?`)) return;
    await store.remove(selected.id);
    await refreshRosters();
    setStatus('Roster deleted from local storage.');
  }

  async function exportSelected(kind: 'json' | 'csv') {
    if (!selected) return;
    if (kind === 'json') {
      downloadText(
        `${selected.name}.json`,
        await store.exportJson(selected.id),
        'application/json',
      );
    } else {
      downloadText(
        `${selected.name}.csv`,
        await store.exportCsv(selected.id),
        'text/csv',
      );
    }
    setStatus(`Exported ${kind.toUpperCase()} (local download only).`);
  }

  async function moveAuthor(fromIndex: number, toIndex: number) {
    if (!selected) return;
    const next = reorderAuthors(selected, fromIndex, toIndex);
    await store.save(next);
    await refreshRosters(next.id);
  }

  async function saveAuthorEdit() {
    if (!selected || !editingAuthorId) return;
    let next = updateAuthor(selected, editingAuthorId, {
      givenName: authorDraft.givenName,
      middleName: authorDraft.middleName,
      familyName: authorDraft.familyName,
      email: authorDraft.email,
      orcid: normalizeOrcid(authorDraft.orcid),
    });
    if (authorDraft.isCorresponding) {
      next = setCorrespondingAuthor(next, editingAuthorId);
    }
    await store.save(next);
    setEditingAuthorId('');
    await refreshRosters(next.id);
    setStatus('Author updated locally.');
  }

  async function addBlankAuthor() {
    if (!selected) return;
    const next = addAuthor(selected);
    await store.save(next);
    const created = next.authors[next.authors.length - 1]!;
    setEditingAuthorId(created.id);
    setAuthorDraft(created);
    await refreshRosters(next.id);
    setStatus('Added author row. Edit name/email before filling.');
  }

  async function deleteAuthor(authorId: string) {
    if (!selected) return;
    const next = removeAuthor(selected, authorId);
    await store.save(next);
    if (editingAuthorId === authorId) setEditingAuthorId('');
    await refreshRosters(next.id);
    setStatus('Author removed from local roster.');
  }

  async function loadSheets() {
    setError('');
    try {
      const preview = await loadSheetPreview(sheetsClient, sheetUrl);
      setSheetPreview(preview);
      if (preview.mapping.requiresConfirmation || !mappingIsComplete(preview.mapping.map)) {
        setPendingMapping({
          headers: preview.headers,
          rows: preview.rows,
          mapping: preview.mapping,
          name: preview.selectedTab.title || 'Google Sheet',
          source: 'google_sheets',
        });
        setStatus('Confirm column mapping for Google Sheet.');
      } else {
        setStatus(
          `Loaded tab “${preview.selectedTab.title}” (${preview.rows.length} rows). Import when ready.`,
        );
      }
    } catch (err) {
      if (err instanceof SheetsNotConfiguredError) {
        setError(
          'Google Sheets OAuth is not configured. See docs/GOOGLE_SHEETS_SETUP.md (blocked on Kyle credentials). CSV import still works.',
        );
      } else {
        setError(err instanceof Error ? err.message : String(err));
      }
    }
  }

  async function importSheetPreview() {
    if (!sheetPreview) return;
    try {
      if (
        sheetPreview.mapping.requiresConfirmation ||
        !mappingIsComplete(sheetPreview.mapping.map)
      ) {
        setPendingMapping({
          headers: sheetPreview.headers,
          rows: sheetPreview.rows,
          mapping: sheetPreview.mapping,
          name: sheetPreview.selectedTab.title || 'Google Sheet',
          source: 'google_sheets',
        });
        return;
      }
      const roster = rosterFromSheetPreview(
        sheetPreview,
        sheetPreview.selectedTab.title || 'Google Sheet',
      );
      await store.importRoster(roster);
      setSheetPreview(null);
      await refreshRosters(roster.id);
      setStatus(`Imported ${roster.authors.length} authors from Google Sheets.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function selectSheetTab(title: string) {
    setError('');
    try {
      const preview = await loadSheetPreview(sheetsClient, sheetUrl, title);
      setSheetPreview(preview);
      setPendingMapping(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function runPreview() {
    if (!selected) return;
    setError('');
    const res = await sendToActiveTab({
      type: 'PREVIEW',
      roster: selected,
      overwrite,
    });
    if (res.type === 'ERROR') {
      setError(res.message);
      return;
    }
    if (res.type === 'FILL_RESULT') {
      setPreview(res.result);
      setValidation(null);
      setStatus('Dry-run preview ready. Nothing was written to the form.');
      void auditLog.append({
        portalFamily: res.result.platformId,
        rosterId: selected.id,
        fieldsProposed: res.result.plans.length,
        filled: res.result.filled,
        preserved: res.result.preserved,
        unresolved: res.result.missingSource + res.result.unmapped,
        conflicts: res.result.skippedConflicts,
      });
    }
  }

  async function runFill() {
    if (!selected) return;
    setError('');
    const res = await sendToActiveTab({
      type: 'FILL',
      roster: selected,
      overwrite,
    });
    if (res.type === 'ERROR') {
      setError(res.message);
      return;
    }
    if (res.type === 'FILL_RESULT') {
      setPreview(res.result);
      const v = await sendToActiveTab({ type: 'VALIDATE', roster: selected });
      if (v.type === 'VALIDATE_RESULT') setValidation(v.result);
      setStatus('Fill complete. Manuscript was NOT submitted.');
    }
  }

  async function runDiagnostic() {
    const res = await sendToActiveTab({ type: 'DIAGNOSTIC' });
    if (res.type === 'DIAGNOSTIC_RESULT') {
      setDiagText(previewCapture(res.result));
      setStatus(
        res.result.redactionComplete
          ? 'Compatibility capture exported (structural only, values redacted).'
          : 'Diagnostic captured.',
      );
    } else if (res.type === 'ERROR') {
      setError(res.message);
    }
  }

  const corresponding = selected?.authors.find((a) => a.isCorresponding);
  const missingRequired = preview?.plans.filter((p) => p.action === 'missing_source') ?? [];
  const conflictPlans = preview?.plans.filter((p) => p.action === 'skip_conflict') ?? [];
  const readyCount = selected
    ? selected.authors.filter((a) => a.givenName && a.familyName && a.email).length
    : 0;
  const attentionCount = selected
    ? selected.authors.filter((a) => !a.email || !a.givenName || !a.familyName).length
    : 0;
  const conflictCount = preview?.skippedConflicts ?? 0;
  const unknownPortalFailure =
    detected && detected.platformId === 'unknown'
      ? failureState('unknown_portal')
      : null;

  return (
    <div>
      <h1>Corresponding</h1>
      <p className="tagline">
        One scientific identity, filled carefully. You always submit and certify yourself.
      </p>

      <section className="panel">
        <h2>Detected portal</h2>
        <div className="stat">
          {detected ? (
            <>
              <strong>{detected.label}</strong>
              {' · '}
              {(detected.confidence * 100).toFixed(0)}% confidence
            </>
          ) : (
            'Checking active tab…'
          )}
        </div>
        {unknownPortalFailure && (
          <pre className="warn" style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>
            {formatFailure(unknownPortalFailure)}
          </pre>
        )}
      </section>

      <section className="panel">
        <h2>Current roster</h2>
        <div className="row">
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            aria-label="Saved roster"
          >
            <option value="">Select roster…</option>
            {rosters.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} ({r.authors.length})
              </option>
            ))}
          </select>
          <button type="button" className="secondary" onClick={() => void createRoster()}>
            New
          </button>
        </div>
        <div className="row" style={{ marginTop: 8 }}>
          <label className="secondary" style={{ fontSize: '0.85rem' }}>
            CSV
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onCsvFile(f);
              }}
            />
          </label>
        </div>
        {selected && (
          <>
            <div className="row" style={{ marginTop: 8 }}>
              <input
                aria-label="Rename roster"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                style={{ flex: 1, padding: '6px 8px' }}
              />
              <button type="button" className="secondary" onClick={() => void saveRename()}>
                Rename
              </button>
            </div>
            <div className="row" style={{ marginTop: 8 }}>
              <button type="button" className="secondary" onClick={() => void duplicateSelected()}>
                Duplicate
              </button>
              <button type="button" className="secondary" onClick={() => void exportSelected('json')}>
                Export JSON
              </button>
              <button type="button" className="secondary" onClick={() => void exportSelected('csv')}>
                Export CSV
              </button>
              <button type="button" className="secondary" onClick={() => void deleteSelected()}>
                Delete
              </button>
            </div>
            <div className="counts" aria-label="Roster status counts">
              <div className="count ready">
                <span className="n">{readyCount}</span>
                <span className="l">Ready</span>
              </div>
              <div className="count attention">
                <span className="n">{attentionCount}</span>
                <span className="l">Needs attention</span>
              </div>
              <div className="count conflict">
                <span className="n">{conflictCount}</span>
                <span className="l">Conflicts</span>
              </div>
            </div>
            <ul className="compact">
              <li>
                Authors: <strong>{selected.authors.length}</strong>
              </li>
              <li>
                Corresponding:{' '}
                <strong>
                  {corresponding
                    ? `${corresponding.givenName} ${corresponding.familyName}`
                    : '—'}
                </strong>
              </li>
            </ul>
          </>
        )}
      </section>

      {selected && (
        <section className="panel">
          <h2>Authors</h2>
          <div className="row" style={{ marginBottom: 8 }}>
            <button type="button" className="secondary" onClick={() => void addBlankAuthor()}>
              Add author
            </button>
          </div>
          {sortedAuthors.length === 0 && (
            <p className="warn">No authors yet. Add a row or import CSV/Sheets.</p>
          )}
          <ul className="compact author-list">
            {sortedAuthors.map((author, index) => (
              <li key={author.id}>
                <div className="row">
                  <span style={{ flex: 1 }}>
                    {author.sequence}. {author.givenName} {author.familyName}
                    {author.isCorresponding ? ' (corr)' : ''}{' '}
                    {!author.email ? (
                      <span className="pill attention">email</span>
                    ) : (
                      <span className="pill ready">ready</span>
                    )}
                  </span>
                  <button
                    type="button"
                    className="secondary"
                    disabled={index === 0}
                    onClick={() => void moveAuthor(index, index - 1)}
                  >
                    Up
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    disabled={index === sortedAuthors.length - 1}
                    onClick={() => void moveAuthor(index, index + 1)}
                  >
                    Down
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => {
                      setEditingAuthorId(author.id);
                      setAuthorDraft(author);
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => void deleteAuthor(author.id)}
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {editingAuthorId && (
            <div style={{ marginTop: 8 }}>
              <div className="row" style={{ marginBottom: 6 }}>
                <input
                  placeholder="Given"
                  value={authorDraft.givenName ?? ''}
                  onChange={(e) =>
                    setAuthorDraft((d) => ({ ...d, givenName: e.target.value }))
                  }
                />
                <input
                  placeholder="Family"
                  value={authorDraft.familyName ?? ''}
                  onChange={(e) =>
                    setAuthorDraft((d) => ({ ...d, familyName: e.target.value }))
                  }
                />
              </div>
              <div className="row" style={{ marginBottom: 6 }}>
                <input
                  placeholder="Email"
                  value={authorDraft.email ?? ''}
                  onChange={(e) =>
                    setAuthorDraft((d) => ({ ...d, email: e.target.value }))
                  }
                  style={{ flex: 1 }}
                />
              </div>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={Boolean(authorDraft.isCorresponding)}
                  onChange={(e) =>
                    setAuthorDraft((d) => ({
                      ...d,
                      isCorresponding: e.target.checked,
                    }))
                  }
                />
                Corresponding author
              </label>
              <div className="row" style={{ marginTop: 8 }}>
                <button type="button" onClick={() => void saveAuthorEdit()}>
                  Save author
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setEditingAuthorId('')}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      <section className="panel">
        <h2>Google Sheets (read-only)</h2>
        {!sheetsClient.isConfigured() ? (
          <p className="warn">
            OAuth client ID not configured. CSV works now; Sheets blocked until Kyle adds credentials
            (`docs/GOOGLE_SHEETS_SETUP.md`).
          </p>
        ) : (
          <>
            <input
              aria-label="Google Sheet URL"
              placeholder="https://docs.google.com/spreadsheets/d/…"
              value={sheetUrl}
              onChange={(e) => setSheetUrl(e.target.value)}
              style={{ width: '100%', padding: '6px 8px', marginBottom: 8 }}
            />
            <div className="row">
              <button type="button" className="secondary" onClick={() => void loadSheets()}>
                Load sheet
              </button>
              {sheetPreview && (
                <>
                  <select
                    aria-label="Sheet tab"
                    value={sheetPreview.selectedTab.title}
                    onChange={(e) => void selectSheetTab(e.target.value)}
                  >
                    {sheetPreview.tabs.map((t) => (
                      <option key={t.sheetId} value={t.title}>
                        {t.title}
                      </option>
                    ))}
                  </select>
                  <button type="button" onClick={() => void importSheetPreview()}>
                    Import tab
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </section>

      {pendingMapping && (
        <section className="panel">
          <h2>Confirm column mapping</h2>
          <p className="warn">
            Ambiguous or unrecognized columns must be confirmed. Nothing is imported until you approve.
          </p>
          {pendingMapping.headers.map((header, idx) => (
            <div className="row" key={`${header}-${idx}`} style={{ marginBottom: 6 }}>
              <span style={{ flex: 1, fontSize: '0.85rem' }}>{header || '(empty)'}</span>
              <ColumnSelect
                value={pendingMapping.mapping.map[idx] ?? ''}
                onChange={(v) => updateMapping(idx, v)}
              />
            </div>
          ))}
          <button type="button" onClick={() => void confirmMapping()}>
            Import with this mapping
          </button>
        </section>
      )}

      <section className="panel">
        <h2>Fill safely</h2>
        <div className="row">
          <label className="checkbox">
            <input
              type="checkbox"
              checked={overwrite}
              onChange={(e) => setOverwrite(e.target.checked)}
            />
            Overwrite non-empty fields
          </label>
        </div>
        <div className="primary-actions">
          <button type="button" className="secondary" disabled={!selected} onClick={() => void runPreview()}>
            Preview
          </button>
          <button type="button" disabled={!selected || detected?.platformId === 'unknown'} onClick={() => void runFill()}>
            Fill
          </button>
        </div>
        <p className="footnote" style={{ marginTop: 10, border: 'none', paddingTop: 0 }}>
          Preview first. Fill never submits the manuscript.
        </p>
      </section>

      {preview && (
        <section className="panel">
          <h2>{preview.dryRun ? 'Preview plan' : 'Fill result'}</h2>
          <ul className="compact">
            <li>{preview.filled} filled</li>
            <li>{preview.preserved} preserved</li>
            <li>{preview.overwritten} overwritten</li>
            <li>{preview.skippedConflicts} conflicts skipped</li>
            <li>{preview.missingSource} missing source</li>
            <li>{preview.unmapped} unmapped</li>
          </ul>
          {conflictPlans.length > 0 && (
            <>
              <p className="danger">Linked-account conflicts (not overwritten):</p>
              <ul className="compact">
                {conflictPlans.slice(0, 8).map((p) => (
                  <li key={p.fieldId}>{p.label}</li>
                ))}
              </ul>
            </>
          )}
          {missingRequired.length > 0 && (
            <>
              <p className="warn">Missing source values:</p>
              <ul className="compact">
                {missingRequired.slice(0, 8).map((p) => (
                  <li key={p.fieldId}>{p.label}</li>
                ))}
              </ul>
            </>
          )}
          {preview.warnings.map((w) => (
            <p className="warn" key={w}>
              {w}
            </p>
          ))}
        </section>
      )}

      {validation && (
        <section className="panel">
          <h2>Validation</h2>
          <ul className="compact">
            <li>{validation.summary.filledLike} authors look filled</li>
            <li>{validation.summary.missingEmail} missing email</li>
            <li>{validation.summary.conflicts} conflicts</li>
            <li>{validation.summary.mismatchedCount} count mismatches</li>
          </ul>
          {validation.issues.slice(0, 10).map((issue) => (
            <p
              key={`${issue.code}-${issue.fieldId}-${issue.message}`}
              className={issue.severity === 'error' ? 'danger' : 'warn'}
            >
              {issue.message}
            </p>
          ))}
          <p className="ok">Manuscript was not submitted.</p>
        </section>
      )}

      <details className="secondary-panel">
        <summary>Diagnostics (advanced)</summary>
        <p className="warn">
          Captures structural field metadata only. Values are redacted. Preview the payload before copying.
        </p>
        <button type="button" className="secondary" onClick={() => void runDiagnostic()}>
          Capture diagnostic
        </button>
        {diagText && (
          <>
            <p className="ok">Preview — confirm no names/emails/passwords appear before sharing:</p>
            <textarea className="mapping" readOnly value={diagText} />
          </>
        )}
      </details>

      {status && <p className="ok">{status}</p>}
      {error && <p className="danger">{error}</p>}

      <p className="footnote">
        Local-first: rosters stay on this device. Corresponding never clicks final submission,
        certification, copyright, payment, or signature controls.
      </p>
    </div>
  );
}
