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
import { extractDocxAuthorTable } from '@/import/docx';
import { parsePastedTable } from '@/import/pasteTable';
import { rowsToRoster } from '@/import/rosterFromTable';
import { createEmptyRoster } from '@/roster/mutations';
import { createRosterStore } from '@/roster/storage';
import {
  importSampleRosterOnce,
  sampleFillConfirmation,
} from '@/roster/sample';
import type { Roster, RosterSource } from '@/schema/author';
import { previewCapture } from '@/diagnostics/capture';
import { createChromeGoogleSheetsClient } from '@/sheets/chromeClient';
import { sanitizeSheetsError } from '@/sheets/errors';
import { loadSheetPreview } from '@/sheets/importFlow';
import { sheetsChooserAvailability } from '@/sheets/types';
import {
  auditRecordFromFillReport,
  createChromeAuditLog,
} from '@/audit/localLog';
import {
  authorsNeedingAttention,
  readyAuthorCount,
} from '@/popup/authorAttention';
import {
  createPreviewContext,
  previewMatchesContext,
  type PreviewSession,
  type TabTarget,
} from '@/popup/previewSession';
import {
  chooseSelectedRosterId,
  createPopupPreferences,
} from '@/popup/preferences';
import { summarizePreview } from '@/popup/previewSummary';
import {
  getActiveTabTarget,
  isActiveDevelopmentFixtureTab,
  normalizeTabResponse,
  sendToActiveTab,
} from './tabBridge';
import {
  AttentionList,
  ColumnSelect,
  PortalBadge,
  PreviewResultCard,
  downloadText,
} from './components';

const store = createRosterStore();
const sheetsClient = createChromeGoogleSheetsClient();
const auditLog = createChromeAuditLog();
const popupPreferences = createPopupPreferences();
// Clearly-labelled example data is useful in every build, including for
// end-to-end testing against a real portal.
const showSampleOnboarding = true;

async function requestActiveTab(
  ...args: Parameters<typeof sendToActiveTab>
) {
  return normalizeTabResponse(await sendToActiveTab(...args));
}

type View = 'main' | 'import' | 'manage' | 'advanced';
type ImportMode =
  | 'chooser'
  | 'paste'
  | 'csv'
  | 'docx'
  | 'sheets'
  | 'mapping';

type PendingImport = {
  headers: string[];
  rows: string[][];
  mapping: ColumnMapping;
  name: string;
  source: RosterSource;
  fileName?: string;
};

export function App({ surface = 'popup' }: { surface?: 'popup' | 'page' } = {}) {
  const [view, setView] = useState<View>(surface === 'page' ? 'import' : 'main');
  const [importMode, setImportMode] = useState<ImportMode>('chooser');
  const [rosters, setRosters] = useState<Roster[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [overwrite, setOverwrite] = useState(false);
  const [detectStatus, setDetectStatus] = useState<
    'loading' | 'ready' | 'unknown' | 'error'
  >('loading');
  const [detected, setDetected] = useState<DetectResult | null>(null);
  const [detectError, setDetectError] = useState('');
  const [previewSession, setPreviewSession] =
    useState<PreviewSession | null>(null);
  const [activeTarget, setActiveTarget] = useState<TabTarget | null>(null);
  const [validation, setValidation] = useState<ValidateReport | null>(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [actionStatus, setActionStatus] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionInFlight, setActionInFlight] = useState<
    'preview' | 'fill' | null
  >(null);
  const [actionIssuePulse, setActionIssuePulse] = useState(0);
  const [pending, setPending] = useState<PendingImport | null>(null);
  const [pasteText, setPasteText] = useState('');
  const [sheetUrl, setSheetUrl] = useState('');
  const [sheetLoading, setSheetLoading] = useState(false);
  const [csvMeta, setCsvMeta] = useState<{ name: string; rows: number } | null>(
    null,
  );
  const [dragOver, setDragOver] = useState(false);
  const [diagText, setDiagText] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [sampleCreating, setSampleCreating] = useState(false);
  const [auditCount, setAuditCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const sampleCreatingRef = useRef(false);

  const selected = rosters.find((r) => r.id === selectedId) ?? null;
  const projectMetadata = selected?.projectMetadata;
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
  const previewIsCurrent = previewMatchesContext(
    previewSession,
    selected,
    overwrite,
    activeTarget,
  );
  const previewAllowsFill =
    previewIsCurrent && (previewSession?.report.errors.length ?? 0) === 0;
  const preview = previewIsCurrent ? previewSession?.report ?? null : null;
  const previewSummary = useMemo(
    () => (preview ? summarizePreview(preview, detected) : null),
    [preview, detected],
  );
  const sheetsUi = sheetsChooserAvailability(sheetsClient.isConfigured());
  const excelStatus = excelImportStatus();

  async function refreshRosters(preferId?: string) {
    const list = await store.list();
    setRosters(list);
    const explicitId = preferId ?? selectedId;
    const rememberedId = await popupPreferences.getSelectedRosterId();
    const nextId =
      chooseSelectedRosterId(
        list.map((roster) => roster.id),
        explicitId,
        rememberedId,
      ) ?? '';
    setSelectedId(nextId);
    await popupPreferences.setSelectedRosterId(nextId || undefined);
  }

  async function runDetect() {
    setDetectStatus('loading');
    setDetectError('');
    try {
      const target = await getActiveTabTarget();
      setActiveTarget(target);
      const res = await requestActiveTab(
        { type: 'DETECT' },
        target ?? undefined,
      );
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

  async function refreshAuditCount() {
    setAuditCount((await auditLog.list()).length);
  }

  async function recordLocalActivity(report: FillReport, rosterId: string) {
    try {
      await auditLog.append(auditRecordFromFillReport(report, rosterId));
      await refreshAuditCount();
    } catch {
      // Audit persistence is secondary and must never break Preview or Fill.
      console.warn('Corresponding could not persist local activity counts.');
    }
  }

  function reportActionError(message: string) {
    setActionError(message);
    setActionIssuePulse((pulse) => pulse + 1);
  }

  useEffect(() => {
    void refreshRosters();
    void runDetect();
    void refreshAuditCount();
  }, []);

  useEffect(() => {
    const refreshTarget = () => {
      void getActiveTabTarget()
        .then(setActiveTarget)
        .catch(() => setActiveTarget(null));
    };
    const onUpdated = (
      _tabId: number,
      changeInfo: { status?: string; url?: string },
    ) => {
      if (changeInfo.url || changeInfo.status === 'complete') refreshTarget();
    };
    browser.tabs.onActivated.addListener(refreshTarget);
    browser.tabs.onUpdated.addListener(onUpdated);
    return () => {
      browser.tabs.onActivated.removeListener(refreshTarget);
      browser.tabs.onUpdated.removeListener(onUpdated);
    };
  }, []);

  useEffect(() => {
    if (previewSession && !previewIsCurrent) {
      setPreviewSession(null);
      setValidation(null);
      setActionStatus('');
    }
  }, [previewSession, previewIsCurrent]);

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
    setSheetUrl('');
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
    setError('');
    setStatus('Importing…');
    try {
      await importTable({
        ...pending,
        mapping: { ...pending.mapping, requiresConfirmation: false },
      });
    } catch {
      setStatus('');
      setError(
        'Import failed. Check that mapped email and ORCID columns contain the expected values.',
      );
    }
  }

  function updateMapping(columnIndex: number, value: CanonicalColumn) {
    setError('');
    setPending((current) => {
      if (!current) return current;
      const map = { ...current.mapping.map, [columnIndex]: value };
      return {
        ...current,
        mapping: { ...current.mapping, map },
      };
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

  async function handleGoogleSheetImport() {
    setError('');
    setStatus('');
    setSheetLoading(true);
    try {
      const preview = await loadSheetPreview(sheetsClient, sheetUrl);
      await importTable({
        headers: preview.headers,
        rows: preview.rows,
        mapping: preview.mapping,
        name: `Google Sheet · ${preview.selectedTab.title}`,
        source: 'google_sheets',
      });
    } catch (err) {
      setError(sanitizeSheetsError(err));
    } finally {
      setSheetLoading(false);
    }
  }

  /**
   * A popup is destroyed when the native file dialog takes focus, so choosing a
   * file has to happen on a full extension page.
   */
  function chooseImportFile() {
    if (surface === 'popup') {
      void browser.tabs.create({ url: chrome.runtime.getURL('import.html') });
      return;
    }
    fileInputRef.current?.click();
  }

  async function handleImportFile(file: File) {
    setError('');
    const kind = detectImportFileKind(file);
    if (kind === 'excel') {
      setError(excelStatus.reason);
      return;
    }
    if (kind === 'unknown') {
      setError('Use a .csv or .docx file, or paste from your spreadsheet.');
      return;
    }
    try {
      if (kind === 'docx') {
        const extracted = extractDocxAuthorTable(await file.arrayBuffer());
        const mapping = suggestColumnMapping(extracted.headers);
        const name =
          file.name.replace(/\.docx$/i, '') || 'Manuscript authors';
        setImportMode('docx');
        await importTable({
          headers: extracted.headers,
          rows: extracted.rows,
          mapping,
          name,
          source: 'docx',
          fileName: file.name,
        });
        return;
      }
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
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not read that file. Try CSV, DOCX, or paste instead.',
      );
    }
  }

  async function createRoster() {
    const roster = createEmptyRoster(`Roster ${rosters.length + 1}`);
    await store.save(roster);
    await refreshRosters(roster.id);
    setStatus('Empty roster created.');
  }

  async function addSampleRoster() {
    if (sampleCreatingRef.current) return;
    setSampleCreating(true);
    setError('');
    setStatus('');
    try {
      const roster = await importSampleRosterOnce(store, sampleCreatingRef);
      if (!roster) return;
      await refreshRosters(roster.id);
      setStatus('Sample roster added. Preview it on the local test fixture.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add the sample roster.');
    } finally {
      setSampleCreating(false);
    }
  }

  async function removeSelectedSample() {
    if (!selected || selected.source !== 'sample') return;
    await store.remove(selected.id);
    setPreviewSession(null);
    setValidation(null);
    await refreshRosters();
    setStatus('Development sample removed from this browser.');
  }

  async function runPreview() {
    if (!selected) return;
    setActionError('');
    setActionInFlight('preview');
    setActionStatus('Running preview…');
    setValidation(null);
    try {
      const target = await getActiveTabTarget();
      if (!target) {
        setActiveTarget(null);
        reportActionError(
          'Open a journal submission form in an http(s) tab, then Preview again.',
        );
        setActionStatus('');
        return;
      }
      const res = await requestActiveTab(
        {
          type: 'PREVIEW',
          roster: selected,
          overwrite,
        },
        target,
      );
      if (res.type === 'ERROR') {
        setPreviewSession(null);
        reportActionError(res.message);
        setActionStatus('');
        return;
      }
      if (res.type === 'FILL_RESULT') {
        setActiveTarget(target);
        setPreviewSession({
          report: res.result,
          context: createPreviewContext(selected, overwrite, target),
        });
        const summary = summarizePreview(res.result, detected);
        setActionStatus(summary.headline);
        await recordLocalActivity(res.result, selected.id);
        // Refresh detect if it was stuck/error — preview proves the tab works.
        if (detectStatus !== 'ready' && res.result.platformId !== 'unknown') {
          void runDetect();
        }
      }
    } catch (err) {
      setPreviewSession(null);
      reportActionError(err instanceof Error ? err.message : String(err));
      setActionStatus('');
    } finally {
      setActionInFlight(null);
    }
  }

  async function runFill() {
    if (!selected) return;
    setActionError('');
    setActionInFlight('fill');
    setValidation(null);
    try {
      let currentSession =
        previewSession && previewAllowsFill ? previewSession : null;

      if (!currentSession) {
        setActionStatus('Checking the current form…');
        const target = await getActiveTabTarget();
        if (!target) {
          reportActionError(
            'Open a journal submission form in an http(s) tab, then try Fill again.',
          );
          setActionStatus('');
          return;
        }
        const preflight = await requestActiveTab(
          {
            type: 'PREVIEW',
            roster: selected,
            overwrite,
          },
          target,
        );
        if (preflight.type === 'ERROR') {
          reportActionError(preflight.message);
          setActionStatus('');
          return;
        }
        if (preflight.type !== 'FILL_RESULT') {
          reportActionError('The form preflight returned no result.');
          setActionStatus('');
          return;
        }
        currentSession = {
          report: preflight.result,
          context: createPreviewContext(selected, overwrite, target),
        };
        setActiveTarget(target);
        setPreviewSession(currentSession);
        await recordLocalActivity(preflight.result, selected.id);
        if (preflight.result.errors.length > 0) {
          reportActionError(preflight.result.errors[0]!);
          setActionStatus(summarizePreview(preflight.result, detected).headline);
          return;
        }
      }

      const expectedTarget = {
        tabId: currentSession.context.tabId,
        url: currentSession.context.url,
      };
      if (selected.source === 'sample') {
        const confirmation = sampleFillConfirmation(
          selected.source,
          await isActiveDevelopmentFixtureTab(),
        );
        if (confirmation && !confirm(confirmation)) {
          setActionStatus('');
          return;
        }
      }

      setActionStatus('Filling…');
      const res = await requestActiveTab(
        {
          type: 'FILL',
          roster: selected,
          overwrite,
        },
        expectedTarget,
      );
      if (res.type === 'ERROR') {
        setPreviewSession(null);
        reportActionError(res.message);
        setActionStatus('');
        return;
      }
      if (res.type === 'FILL_RESULT') {
        setPreviewSession(null);
        await recordLocalActivity(res.result, selected.id);
        const v = await requestActiveTab(
          { type: 'VALIDATE', roster: selected },
          expectedTarget,
        );
        if (v.type === 'ERROR') {
          reportActionError(
            `Fields were filled, but validation failed: ${v.message}`,
          );
          setActionStatus('Fill complete. Review every field before submitting.');
          return;
        }
        if (v.type !== 'VALIDATE_RESULT') {
          reportActionError(
            'Fields were filled, but validation returned no result.',
          );
          setActionStatus('Fill complete. Review every field before submitting.');
          return;
        }
        setValidation(v.result);
        setActionStatus(
          v.result.ok
            ? 'Fill complete. Validation finished; you review and submit.'
            : 'Fill complete. Validation found issues that need review.',
        );
        if (detectStatus !== 'ready') void runDetect();
      }
    } catch (err) {
      setPreviewSession(null);
      reportActionError(err instanceof Error ? err.message : String(err));
      setActionStatus('');
    } finally {
      setActionInFlight(null);
    }
  }

  async function runDiagnostic() {
    setError('');
    try {
      const res = await requestActiveTab({ type: 'DIAGNOSTIC' });
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
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not connect to the active journal tab.',
      );
    }
  }

  async function clearAuditLog() {
    if (!confirm('Clear local activity records from this device?')) return;
    await auditLog.clear();
    await refreshAuditCount();
    setStatus('Local activity cleared.');
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
          <p className="brand-line">Giving scientists more time to do science.</p>
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
        {(detectStatus === 'unknown' || detectStatus === 'error') && (
          <button
            type="button"
            className="linkish compatibility-link"
            onClick={() => setView('advanced')}
          >
            Capture compatibility info
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
              {showSampleOnboarding && (
                <button
                  type="button"
                  className="secondary"
                  disabled={sampleCreating}
                  onClick={() => void addSampleRoster()}
                >
                  {sampleCreating ? 'Adding example…' : 'Try six example authors'}
                </button>
              )}
              <button
                type="button"
                className="linkish"
                onClick={() => void createRoster()}
              >
                Start empty roster
              </button>
            </div>
            {showSampleOnboarding && (
              <p className="muted tight">
                Example authors for practice: two shared first, two shared
                corresponding. Not real people.
              </p>
            )}
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
                        Review imported authors
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
              onChange={(e) => {
                const id = e.target.value;
                setSelectedId(id);
                void popupPreferences.setSelectedRosterId(id || undefined);
              }}
                aria-label="Saved roster"
              >
                {rosters.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.authors.length})
                  </option>
                ))}
              </select>

              {selected.source === 'sample' && (
                <button
                  type="button"
                  className="linkish sample-remove"
                  onClick={() => void removeSelectedSample()}
                >
                  Remove development sample
                </button>
              )}

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
              onReview={() => setView('manage')}
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
                  className={`secondary action-button ${
                    actionInFlight === 'preview' ? 'action-button-working' : ''
                  }`}
                  disabled={!selected || actionInFlight !== null}
                  aria-busy={actionInFlight === 'preview'}
                  onClick={() => void runPreview()}
                >
                  {actionInFlight === 'preview' ? 'Previewing…' : 'Preview'}
                </button>
                <button
                  type="button"
                  className={`action-button ${
                    actionInFlight === 'fill' ? 'action-button-working' : ''
                  }`}
                  disabled={
                    !selected ||
                    actionInFlight !== null ||
                    detectStatus === 'unknown' ||
                    detectStatus === 'loading'
                  }
                  aria-busy={actionInFlight === 'fill'}
                  onClick={() => void runFill()}
                >
                  {actionInFlight === 'fill' ? 'Filling…' : 'Fill'}
                </button>
              </div>
              <div
                className="action-feedback"
                role="status"
                aria-live="polite"
                aria-atomic="true"
              >
                {actionStatus && <p className="ok tight">{actionStatus}</p>}
                {actionError && (
                  <p
                    key={actionIssuePulse}
                    className="danger gentle-issue-pulse tight"
                  >
                    {actionError}
                  </p>
                )}
              </div>
            </section>

            {previewSummary && <PreviewResultCard summary={previewSummary} />}

            {validation && (
              <section className="panel">
                <h2>After fill — validation</h2>
                <ul className="compact">
                  <li>{validation.summary.filledLike} authors look filled</li>
                  <li>{validation.summary.missingEmail} missing email</li>
                  <li>{validation.summary.conflicts} conflicts</li>
                </ul>
                {!validation.ok && (
                  <p className="danger tight">
                    Validation found issues. Review the highlighted counts and form.
                  </p>
                )}
                <p className="ok tight">Manuscript was not submitted.</p>
              </section>
            )}

            <button
              type="button"
              className="linkish manage-link"
              onClick={() => setView('manage')}
            >
              Review imported authors →
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
              <strong>Paste Google Sheet or Excel table</strong>
              <span>Select the table, copy, and paste — no sign-in needed</span>
            </button>
            <button
              type="button"
              className="import-option"
              onClick={() => {
                setImportMode('csv');
                if (surface === 'page') fileInputRef.current?.click();
              }}
            >
              <strong>Upload CSV</strong>
              <span>Drag and drop, or choose a file</span>
            </button>
            <button
              type="button"
              className="import-option"
              onClick={chooseImportFile}
            >
              <strong>Upload manuscript (.docx)</strong>
              <span>Extract a structured author table locally</span>
            </button>
            <button type="button" className="import-option" disabled>
              <strong>Upload Excel</strong>
              <span>{excelStatus.reason}</span>
            </button>
            <button
              type="button"
              className="import-option"
              disabled={!sheetsUi.enabled}
              onClick={() => setImportMode('sheets')}
            >
              <strong>{sheetsUi.label}</strong>
              <span>{sheetsUi.hint}</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.docx,text/csv,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleImportFile(f);
                e.target.value = '';
              }}
            />
          </section>
        )}

        {importMode === 'paste' && (
          <section className="panel">
            <p className="muted">
              Paste the copied table, including its header row. Unrecognized
              columns default to Ignore.
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

        {importMode === 'sheets' && (
          <section className="panel">
            <h2>Import Google Sheet</h2>
            <p className="muted">
              Paste the URL of a spreadsheet you can access. Corresponding
              signs in with Google, reads it once, and stores the imported
              roster locally. It never writes to the sheet.
            </p>
            <input
              type="url"
              className="sheet-url"
              aria-label="Google Sheet URL"
              placeholder="https://docs.google.com/spreadsheets/d/…"
              value={sheetUrl}
              onChange={(event) => {
                setSheetUrl(event.target.value);
                setError('');
              }}
            />
            <div className="row">
              <button
                type="button"
                disabled={!sheetUrl.trim() || sheetLoading}
                aria-busy={sheetLoading}
                onClick={() => void handleGoogleSheetImport()}
              >
                {sheetLoading ? 'Connecting…' : 'Import read-only'}
              </button>
              <button
                type="button"
                className="secondary"
                disabled={sheetLoading}
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
                if (f) void handleImportFile(f);
              }}
            >
              <p>
                Drop a CSV or .docx here, or{' '}
                <button
                  type="button"
                  className="linkish inline"
                  onClick={chooseImportFile}
                >
                  {surface === 'popup' ? 'open the file importer' : 'choose a file'}
                </button>
              </p>
              {surface === 'popup' && (
                <p className="muted tight">
                  Dropping a file works here. Choosing one opens a tab, because
                  this panel closes when the system file dialog appears.
                </p>
              )}
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
            {error && (
              <p
                className="danger gentle-issue-pulse mapping-feedback"
                role="alert"
                aria-live="assertive"
              >
                {error}
              </p>
            )}
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
        {error && importMode !== 'mapping' && <p className="danger">{error}</p>}
      </div>
    );
  }

  /* ---------------- REVIEW IMPORT ---------------- */
  if (view === 'manage') {
    return (
      <div className="app">
        <header className="subview-header">
          <button type="button" className="linkish" onClick={() => setView('main')}>
            ← Back
          </button>
          <h1>Review imported authors</h1>
        </header>

        {!selected ? (
          <p className="warn">No roster selected.</p>
        ) : (
          <section className="panel">
            <div className="review-summary">
              <strong>{selected.name}</strong>
              <span className="muted">
                {selected.authors.length} authors · {attention.length} flagged
              </span>
            </div>
            <p className="muted">
              This is a read-only preview of what Corresponding imported. Fix
              source data in your spreadsheet, then import it again.
            </p>
            {attention.length > 0 && (
              <div className="review-issues">
                <h2>Import summary</h2>
                <ul className="attention-list">
                  {attention.map(({ author, reasons }) => (
                    <li key={author.id}>
                      <div className="attention-name">
                        {author.sequence}. {author.givenName} {author.familyName}
                      </div>
                      <div className="attention-reasons">
                        {reasons.join(' · ')}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {(projectMetadata?.fundingStatements.length ||
              projectMetadata?.disclosureStatements.length) && (
              <details className="project-metadata-review">
                <summary>Project statements</summary>
                {projectMetadata.fundingStatements.length > 0 && (
                  <>
                    <h2>Support / funding</h2>
                    <ul className="compact">
                      {projectMetadata.fundingStatements.map((statement) => (
                          <li key={statement}>{statement}</li>
                        ))}
                    </ul>
                  </>
                )}
                {projectMetadata.disclosureStatements.length > 0 && (
                  <>
                    <h2>Conflicts / disclosures</h2>
                    <ul className="compact">
                      {projectMetadata.disclosureStatements.map((statement) => (
                          <li key={statement}>{statement}</li>
                        ))}
                    </ul>
                  </>
                )}
              </details>
            )}
            <details className="author-all" open={sortedAuthors.length <= 10}>
              <summary>Imported authors ({sortedAuthors.length})</summary>
              <ol className="review-author-list">
                {sortedAuthors.map((author) => (
                  <li key={author.id}>
                    <div className="review-author-name">
                      {[author.givenName, author.middleName, author.familyName]
                        .filter(Boolean)
                        .join(' ')}
                      {author.isCorresponding ? ' · corresponding' : ''}
                      {author.equalContribution ? ' · equal contribution' : ''}
                    </div>
                    <div className="muted">
                      {author.email || 'No email'}
                      {author.affiliations[0]?.institution
                        ? ` · ${author.affiliations[0].institution}`
                        : ''}
                    </div>
                  </li>
                ))}
              </ol>
            </details>
            <button type="button" onClick={openImport}>
              Import updated spreadsheet
            </button>
          </section>
        )}
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
          Structural field metadata only. Values are redacted. For a repeated
          author dialog, capture once before opening it and once while an empty
          dialog is open.
        </p>
        <button type="button" className="secondary" onClick={() => void runDiagnostic()}>
          Capture diagnostic
        </button>
        {diagText && (
          <>
            <p className="ok">Confirm no names/emails/passwords appear:</p>
            <textarea className="mapping" readOnly value={diagText} />
            <button
              type="button"
              className="secondary"
              onClick={() =>
                downloadText(
                  'corresponding-redacted-compatibility-capture.json',
                  diagText,
                  'application/json',
                )
              }
            >
              Download reviewed capture
            </button>
          </>
        )}
      </section>
      <section className="panel">
        <h2>Local activity</h2>
        <p className="muted">
          {auditCount} Preview/Fill records on this device. Each record keeps the
          time, operation, portal family, roster ID, and aggregate counts — never
          names, emails, or form values.
        </p>
        <button
          type="button"
          className="secondary"
          disabled={auditCount === 0}
          onClick={() => void clearAuditLog()}
        >
          Clear local activity
        </button>
      </section>
      {status && <p className="ok">{status}</p>}
      {error && <p className="danger">{error}</p>}
    </div>
  );
}
