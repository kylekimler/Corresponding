import { useEffect, useMemo, useRef, useState } from 'react';
import type { DetectResult, FillReport, ValidateReport } from '@/adapters/types';
import { parseCsv } from '@/import/csv';
import {
  mappingIsComplete,
  suggestColumnMapping,
  type CanonicalColumn,
  type ColumnMapping,
} from '@/import/columnMap';
import { detectImportFileKind, excelImportStatus } from '@/import/fileKinds';
import { parsePastedTable } from '@/import/pasteTable';
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
import { createSampleRoster } from '@/roster/sample';
import type { Author, Roster, RosterSource } from '@/schema/author';
import { previewCapture } from '@/diagnostics/capture';
import { createChromeGoogleSheetsClient } from '@/sheets/chromeClient';
import { sheetsChooserAvailability } from '@/sheets/types';
import { createMemoryAuditLog } from '@/audit/localLog';
import {
  authorsNeedingAttention,
  readyAuthorCount,
} from '@/popup/authorAttention';
import { summarizePreview } from '@/popup/previewSummary';
import { sendToActiveTab } from './tabBridge';
import {
  AttentionList,
  ColumnSelect,
  PortalBadge,
  PreviewResultCard,
  downloadText,
} from './components';

const store = createRosterStore();
const sheetsClient = createChromeGoogleSheetsClient();
const auditLog = createMemoryAuditLog();

type View = 'main' | 'import' | 'manage' | 'advanced';
type ImportMode = 'chooser' | 'paste' | 'csv' | 'mapping';

type PendingImport = {
  headers: string[];
  rows: string[][];
  mapping: ColumnMapping;
  name: string;
  source: RosterSource;
  fileName?: string;
};

export function App() {
  const [view, setView] = useState<View>('main');
  const [importMode, setImportMode] = useState<ImportMode>('chooser');
  const [rosters, setRosters] = useState<Roster[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [overwrite, setOverwrite] = useState(false);
  const [detectStatus, setDetectStatus] = useState<
    'loading' | 'ready' | 'unknown' | 'error'
  >('loading');
  const [detected, setDetected] = useState<DetectResult | null>(null);
  const [detectError, setDetectError] = useState('');
  const [preview, setPreview] = useState<FillReport | null>(null);
  const [validation, setValidation] = useState<ValidateReport | null>(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState<PendingImport | null>(null);
  const [pasteText, setPasteText] = useState('');
  const [csvMeta, setCsvMeta] = useState<{ name: string; rows: number } | null>(
    null,
  );
  const [dragOver, setDragOver] = useState(false);
  const [diagText, setDiagText] = useState('');
  const [renameValue, setRenameValue] = useState('');
  const [editingAuthorId, setEditingAuthorId] = useState('');
  const [authorDraft, setAuthorDraft] = useState<Partial<Author>>({});
  const [menuOpen, setMenuOpen] = useState(false);
  const [sampleCreating, setSampleCreating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const selected = rosters.find((r) => r.id === selectedId) ?? null;
  const sortedAuthors = useMemo(
    () =>
      selected
        ? [...selected.authors].sort((a, b) => a.sequence - b.sequence)
        : [],
    [selected],
  );
  const attention = useMemo(
    () => (selected ? authorsNeedingAttention(selected.authors) : []),
    [selected],
  );
  const readyCount = selected ? readyAuthorCount(selected.authors) : 0;
  const previewSummary = useMemo(
    () => (preview ? summarizePreview(preview, detected) : null),
    [preview, detected],
  );
  const sheetsUi = sheetsChooserAvailability(sheetsClient.isConfigured());
  const excelStatus = excelImportStatus();

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

  async function runDetect() {
    setDetectStatus('loading');
    setDetectError('');
    try {
      const res = await sendToActiveTab({ type: 'DETECT' });
      if (res.type === 'DETECT_RESULT') {
        setDetected(res.result);
        setDetectStatus(
          res.result.platformId === 'unknown' ? 'unknown' : 'ready',
        );
        return;
      }
      if (res.type === 'ERROR') {
        setDetected(null);
        setDetectStatus('error');
        setDetectError(res.message);
        return;
      }
      setDetected(null);
      setDetectStatus('error');
      setDetectError('Could not detect the active tab.');
    } catch (err) {
      setDetected(null);
      setDetectStatus('error');
      setDetectError(err instanceof Error ? err.message : String(err));
    }
  }

  useEffect(() => {
    void refreshRosters();
    void runDetect();
  }, []);

  useEffect(() => {
    setRenameValue(selected?.name ?? '');
    setEditingAuthorId('');
  }, [selected?.id]);

  useEffect(() => {
    if (!menuOpen) return;
    function onDoc(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menuOpen]);

  function openImport() {
    setError('');
    setStatus('');
    setImportMode('chooser');
    setPasteText('');
    setCsvMeta(null);
    setPending(null);
    setView('import');
  }

  function beginMapping(input: PendingImport) {
    if (input.mapping.requiresConfirmation || !mappingIsComplete(input.mapping.map)) {
      setPending(input);
      setImportMode('mapping');
      setStatus('Confirm column mapping before import.');
      return false;
    }
    return true;
  }

  async function importTable(input: PendingImport) {
    if (!beginMapping(input)) return;
    const roster = rowsToRoster({
      name: input.name,
      headers: input.headers,
      rows: input.rows,
      mapping: input.mapping.map,
      source: input.source,
    });
    await store.importRoster(roster);
    setPending(null);
    setCsvMeta(null);
    setPasteText('');
    await refreshRosters(roster.id);
    setView('main');
    setStatus(`Imported ${roster.authors.length} authors.`);
  }

  async function confirmMapping() {
    if (!pending) return;
    if (!mappingIsComplete(pending.mapping.map)) {
      setError('Map at least First/Given name and Last/Family name.');
      return;
    }
    await importTable({
      ...pending,
      mapping: { ...pending.mapping, requiresConfirmation: false },
    });
  }

  function updateMapping(columnIndex: number, value: CanonicalColumn) {
    if (!pending) return;
    const map = { ...pending.mapping.map, [columnIndex]: value };
    setPending({
      ...pending,
      mapping: { ...pending.mapping, map },
    });
  }

  async function handlePasteImport() {
    setError('');
    const parsed = parsePastedTable(pasteText);
    if (!parsed.headers.length || parsed.rowCount === 0) {
      setError('Paste a table with a header row and at least one author.');
      return;
    }
    const mapping = suggestColumnMapping(parsed.headers);
    await importTable({
      headers: parsed.headers,
      rows: parsed.rows,
      mapping,
      name: 'Pasted authors',
      source: 'csv',
    });
  }

  async function handleCsvFile(file: File) {
    setError('');
    const kind = detectImportFileKind(file);
    if (kind === 'excel') {
      setError(excelStatus.reason);
      return;
    }
    if (kind === 'unknown') {
      setError('Use a .csv file, or paste from your spreadsheet.');
      return;
    }
    try {
      const text = await file.text();
      const { headers, rows } = parseCsv(text);
      if (!headers.length || rows.length === 0) {
        setError('That CSV has no author rows.');
        return;
      }
      const mapping = suggestColumnMapping(headers);
      const name = file.name.replace(/\.csv$/i, '') || 'Imported roster';
      setCsvMeta({ name: file.name, rows: rows.length });
      setImportMode('csv');
      await importTable({
        headers,
        rows,
        mapping,
        name,
        source: 'csv',
        fileName: file.name,
      });
    } catch {
      setError('Could not read that file. Try CSV or paste instead.');
    }
  }

  async function createRoster() {
    const roster = createEmptyRoster(`Roster ${rosters.length + 1}`);
    await store.save(roster);
    await refreshRosters(roster.id);
    setStatus('Empty roster created.');
  }

  async function addSampleRoster() {
    if (sampleCreating) return;
    setSampleCreating(true);
    setError('');
    setStatus('');
    try {
      const roster = createSampleRoster();
      await store.importRoster(roster);
      await refreshRosters(roster.id);
      setStatus('Sample roster added. Try Preview — nothing is submitted.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add the sample roster.');
    } finally {
      setSampleCreating(false);
    }
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
    setView('main');
    setStatus('Roster deleted.');
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
    setStatus(`Exported ${kind.toUpperCase()}.`);
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
    setStatus('Author updated.');
  }

  async function addBlankAuthor() {
    if (!selected) return;
    const next = addAuthor(selected);
    await store.save(next);
    const created = next.authors[next.authors.length - 1]!;
    setEditingAuthorId(created.id);
    setAuthorDraft(created);
    await refreshRosters(next.id);
  }

  async function deleteAuthor(authorId: string) {
    if (!selected) return;
    const next = removeAuthor(selected, authorId);
    await store.save(next);
    if (editingAuthorId === authorId) setEditingAuthorId('');
    await refreshRosters(next.id);
  }

  async function runPreview() {
    if (!selected) return;
    setError('');
    setStatus('Running preview…');
    try {
      const res = await sendToActiveTab({
        type: 'PREVIEW',
        roster: selected,
        overwrite,
      });
      if (res.type === 'ERROR') {
        setError(res.message);
        setStatus('');
        return;
      }
      if (res.type === 'FILL_RESULT') {
        setPreview(res.result);
        setValidation(null);
        const summary = summarizePreview(res.result, detected);
        setStatus(summary.headline);
        void auditLog.append({
          portalFamily: res.result.platformId,
          rosterId: selected.id,
          fieldsProposed: res.result.plans.length,
          filled: res.result.filled,
          preserved: res.result.preserved,
          unresolved: res.result.missingSource + res.result.unmapped,
          conflicts: res.result.skippedConflicts,
        });
        // Refresh detect if it was stuck/error — preview proves the tab works.
        if (detectStatus !== 'ready' && res.result.platformId !== 'unknown') {
          void runDetect();
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus('');
    }
  }

  async function runFill() {
    if (!selected) return;
    setError('');
    setStatus('Filling…');
    try {
      const res = await sendToActiveTab({
        type: 'FILL',
        roster: selected,
        overwrite,
      });
      if (res.type === 'ERROR') {
        setError(res.message);
        setStatus('');
        return;
      }
      if (res.type === 'FILL_RESULT') {
        setPreview(res.result);
        const v = await sendToActiveTab({ type: 'VALIDATE', roster: selected });
        if (v.type === 'VALIDATE_RESULT') setValidation(v.result);
        setStatus('Fill complete. You review and submit.');
        if (detectStatus !== 'ready') void runDetect();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus('');
    }
  }

  async function runDiagnostic() {
    setError('');
    const res = await sendToActiveTab({ type: 'DIAGNOSTIC' });
    if (res.type === 'DIAGNOSTIC_RESULT') {
      if (!res.result.redactionComplete) {
        setDiagText('');
        setError(
          'Diagnostic redaction incomplete — export blocked to protect page PII.',
        );
        setStatus('Diagnostic blocked (redaction incomplete).');
        return;
      }
      setDiagText(previewCapture(res.result));
      setStatus('Compatibility capture ready (values redacted).');
    } else if (res.type === 'ERROR') {
      setError(res.message);
    }
  }

  const portalLabel =
    detectStatus === 'loading'
      ? 'Checking active tab…'
      : detectStatus === 'error'
        ? 'Tab unavailable'
        : detected?.label || 'Unknown portal';

  const portalDetail =
    detectStatus === 'error'
      ? detectError || 'Open a submission form, then retry.'
      : detectStatus === 'unknown'
        ? 'Unsupported on this page'
        : detectStatus === 'ready' && detected
          ? `${Math.round(detected.confidence * 100)}% · ${detected.platformId}`
          : undefined;

  /* ---------------- MAIN VIEW ---------------- */
  if (view === 'main') {
    return (
      <div className="app compact-app">
        <header className="app-header">
          <h1>Corresponding</h1>
          <p className="brand-line">One scientific identity, everywhere.</p>
        </header>

        <PortalBadge
          status={detectStatus}
          label={portalLabel}
          detail={portalDetail}
        />
        {detectStatus === 'error' && (
          <button type="button" className="linkish" onClick={() => void runDetect()}>
            Retry detection
          </button>
        )}

        {!selected ? (
          <section className="panel empty-state">
            <p className="stat">
              Import your author list to get started.
            </p>
            <div className="empty-state-actions">
              <button type="button" onClick={openImport}>
                Import authors
              </button>
              <button
                type="button"
                className="secondary"
                disabled={sampleCreating}
                onClick={() => void addSampleRoster()}
              >
                {sampleCreating ? 'Adding sample…' : 'Try a sample roster'}
              </button>
              <button
                type="button"
                className="linkish"
                onClick={() => void createRoster()}
              >
                Start empty roster
              </button>
            </div>
            <p className="muted tight">
              The sample uses example-only data and stays on this device.
            </p>
          </section>
        ) : (
          <>
            <section className="panel roster-summary">
              <div className="roster-title-row">
                <div>
                  <div className="roster-name">{selected.name}</div>
                  <div className="muted">
                    {selected.authors.length} authors
                  </div>
                </div>
                <div className="menu-wrap" ref={menuRef}>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-haspopup="menu"
                    aria-expanded={menuOpen}
                    aria-label="Roster menu"
                    onClick={() => setMenuOpen((o) => !o)}
                  >
                    ⋯
                  </button>
                  {menuOpen && (
                    <div className="menu" role="menu">
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setMenuOpen(false);
                          openImport();
                        }}
                      >
                        Import authors
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setMenuOpen(false);
                          setView('manage');
                        }}
                      >
                        Manage roster
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setMenuOpen(false);
                          void createRoster();
                        }}
                      >
                        New roster
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setMenuOpen(false);
                          setView('advanced');
                        }}
                      >
                        Advanced
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <select
                className="roster-select"
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                aria-label="Saved roster"
              >
                {rosters.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.authors.length})
                  </option>
                ))}
              </select>

              <p className="status-line">
                <span className="ready-text">{readyCount} ready</span>
                {' · '}
                <span className="attention-text">
                  {attention.length} need attention
                </span>
                {preview && preview.skippedConflicts > 0 ? (
                  <>
                    {' · '}
                    <span className="conflict-text">
                      {preview.skippedConflicts} conflicts
                    </span>
                  </>
                ) : null}
              </p>
            </section>

            <AttentionList
              items={attention}
              totalAuthors={selected.authors.length}
              onManage={() => setView('manage')}
            />

            <section className="panel actions-panel">
              <label className="checkbox overwrite">
                <input
                  type="checkbox"
                  checked={overwrite}
                  onChange={(e) => setOverwrite(e.target.checked)}
                />
                Overwrite non-empty fields
              </label>
              <div className="primary-actions">
                <button
                  type="button"
                  className="secondary"
                  disabled={!selected}
                  onClick={() => void runPreview()}
                >
                  Preview
                </button>
                <button
                  type="button"
                  disabled={
                    !selected ||
                    detectStatus === 'unknown' ||
                    detectStatus === 'loading'
                  }
                  onClick={() => void runFill()}
                >
                  Fill
                </button>
              </div>
              <p className="safety-near-fill">
                Corresponding fills. You review and submit.
              </p>
            </section>

            {previewSummary && <PreviewResultCard summary={previewSummary} />}

            {validation && (
              <section className="panel">
                <h2>After fill</h2>
                <ul className="compact">
                  <li>{validation.summary.filledLike} authors look filled</li>
                  <li>{validation.summary.missingEmail} missing email</li>
                  <li>{validation.summary.conflicts} conflicts</li>
                </ul>
                <p className="ok tight">Manuscript was not submitted.</p>
              </section>
            )}

            <button
              type="button"
              className="linkish manage-link"
              onClick={() => setView('manage')}
            >
              Manage roster →
            </button>
          </>
        )}

        {status && <p className="ok">{status}</p>}
        {error && <p className="danger">{error}</p>}
      </div>
    );
  }

  /* ---------------- IMPORT VIEW ---------------- */
  if (view === 'import') {
    return (
      <div className="app">
        <header className="subview-header">
          <button
            type="button"
            className="linkish"
            onClick={() => {
              setView('main');
              setImportMode('chooser');
              setPending(null);
            }}
          >
            ← Back
          </button>
          <h1>Import authors</h1>
        </header>

        {importMode === 'chooser' && (
          <section className="panel import-chooser">
            <button
              type="button"
              className="import-option"
              onClick={() => setImportMode('paste')}
            >
              <strong>Paste from spreadsheet</strong>
              <span>Copy a table from Sheets, Excel, or Numbers</span>
            </button>
            <button
              type="button"
              className="import-option"
              onClick={() => {
                setImportMode('csv');
                fileInputRef.current?.click();
              }}
            >
              <strong>Upload CSV</strong>
              <span>Drag and drop or choose a file</span>
            </button>
            <button type="button" className="import-option" disabled>
              <strong>Upload Excel</strong>
              <span>{excelStatus.reason}</span>
            </button>
            <button type="button" className="import-option" disabled={!sheetsUi.enabled}>
              <strong>{sheetsUi.label}</strong>
              <span>{sheetsUi.hint}</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleCsvFile(f);
                e.target.value = '';
              }}
            />
          </section>
        )}

        {importMode === 'paste' && (
          <section className="panel">
            <p className="muted">
              Paste a header row and author rows. Tabs from spreadsheet copy work best.
            </p>
            <textarea
              className="paste-target"
              aria-label="Paste spreadsheet table"
              placeholder={
                'First name\tLast name\tEmail\tAffiliation 1\nAda\tLovelace\tada@example.org\tAnalytical Engine'
              }
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
            />
            <div className="row">
              <button type="button" onClick={() => void handlePasteImport()}>
                Continue
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => setImportMode('chooser')}
              >
                Cancel
              </button>
            </div>
          </section>
        )}

        {importMode === 'csv' && (
          <section className="panel">
            <div
              className={`dropzone ${dragOver ? 'drag-over' : ''}`}
              onDragEnter={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const f = e.dataTransfer.files?.[0];
                if (f) void handleCsvFile(f);
              }}
            >
              <p>
                Drop a CSV here, or{' '}
                <button
                  type="button"
                  className="linkish inline"
                  onClick={() => fileInputRef.current?.click()}
                >
                  choose a file
                </button>
              </p>
              {csvMeta && (
                <p className="ok">
                  {csvMeta.name} · {csvMeta.rows} rows
                </p>
              )}
            </div>
            <button
              type="button"
              className="secondary"
              onClick={() => setImportMode('chooser')}
            >
              Back
            </button>
          </section>
        )}

        {importMode === 'mapping' && pending && (
          <section className="panel">
            <h2>Confirm columns</h2>
            <p className="warn">
              Ambiguous columns need your call. Nothing imports until you approve.
            </p>
            {pending.fileName && (
              <p className="muted">
                {pending.fileName}
                {pending.rows.length ? ` · ${pending.rows.length} rows` : ''}
              </p>
            )}
            <div className="table-preview" role="region" aria-label="Parsed rows">
              <table>
                <thead>
                  <tr>
                    {pending.headers.map((h, i) => (
                      <th key={`${h}-${i}`}>{h || '(empty)'}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pending.rows.slice(0, 5).map((row, ri) => (
                    <tr key={ri}>
                      {pending.headers.map((_, ci) => (
                        <td key={ci}>{row[ci] ?? ''}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {pending.headers.map((header, idx) => (
              <div className="row map-row" key={`${header}-${idx}`}>
                <span className="map-header">{header || '(empty)'}</span>
                <ColumnSelect
                  value={pending.mapping.map[idx] ?? ''}
                  onChange={(v) => updateMapping(idx, v)}
                />
              </div>
            ))}
            <div className="row">
              <button type="button" onClick={() => void confirmMapping()}>
                Import
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  setPending(null);
                  setImportMode('chooser');
                }}
              >
                Cancel
              </button>
            </div>
          </section>
        )}

        {status && <p className="ok">{status}</p>}
        {error && <p className="danger">{error}</p>}
      </div>
    );
  }

  /* ---------------- MANAGE ROSTER ---------------- */
  if (view === 'manage') {
    return (
      <div className="app">
        <header className="subview-header">
          <button type="button" className="linkish" onClick={() => setView('main')}>
            ← Back
          </button>
          <h1>Manage roster</h1>
        </header>

        {!selected ? (
          <p className="warn">No roster selected.</p>
        ) : (
          <>
            <section className="panel">
              <div className="row">
                <input
                  aria-label="Rename roster"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  style={{ flex: 1 }}
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
            </section>

            <section className="panel">
              <div className="row" style={{ marginBottom: 8 }}>
                <button type="button" className="secondary" onClick={() => void addBlankAuthor()}>
                  Add author
                </button>
                <button type="button" className="secondary" onClick={openImport}>
                  Import authors
                </button>
              </div>

              {attention.length > 0 && (
                <>
                  <h2>Needs attention</h2>
                  <ul className="attention-list">
                    {attention.map(({ author, reasons }) => (
                        <li key={author.id}>
                          <div className="attention-name">
                            {author.sequence}. {author.givenName} {author.familyName}
                          </div>
                          <div className="attention-reasons">{reasons.join(' · ')}</div>
                          <button
                            type="button"
                            className="linkish"
                            onClick={() => {
                              setEditingAuthorId(author.id);
                              setAuthorDraft(author);
                            }}
                          >
                            Edit
                          </button>
                        </li>
                      ))}
                  </ul>
                </>
              )}

              <details className="author-all">
                <summary>
                  All authors ({sortedAuthors.length})
                </summary>
                <ul className="compact author-list">
                  {sortedAuthors.map((author, index) => (
                    <li key={author.id}>
                      <div className="row">
                        <span style={{ flex: 1 }}>
                          {author.sequence}. {author.givenName} {author.familyName}
                          {author.isCorresponding ? ' (corr)' : ''}
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
              </details>

              {editingAuthorId && (
                <div className="edit-author">
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
                  <div className="row" style={{ marginBottom: 6 }}>
                    <input
                      placeholder="ORCID"
                      value={authorDraft.orcid ?? ''}
                      onChange={(e) =>
                        setAuthorDraft((d) => ({ ...d, orcid: e.target.value }))
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
          </>
        )}

        {status && <p className="ok">{status}</p>}
        {error && <p className="danger">{error}</p>}
      </div>
    );
  }

  /* ---------------- ADVANCED ---------------- */
  return (
    <div className="app">
      <header className="subview-header">
        <button type="button" className="linkish" onClick={() => setView('main')}>
          ← Back
        </button>
        <h1>Advanced</h1>
      </header>
      <section className="panel">
        <h2>Compatibility capture</h2>
        <p className="muted">
          Structural field metadata only. Values are redacted. Review before sharing.
        </p>
        <button type="button" className="secondary" onClick={() => void runDiagnostic()}>
          Capture diagnostic
        </button>
        {diagText && (
          <>
            <p className="ok">Confirm no names/emails/passwords appear:</p>
            <textarea className="mapping" readOnly value={diagText} />
          </>
        )}
      </section>
      {status && <p className="ok">{status}</p>}
      {error && <p className="danger">{error}</p>}
    </div>
  );
}
