import { useEffect, useState } from 'react';
import type { DetectResult, FillReport, ValidateReport } from '@/adapters/types';
import { parseCsv } from '@/import/csv';
import {
  mappingIsComplete,
  suggestColumnMapping,
  type CanonicalColumn,
  type ColumnMapping,
} from '@/import/columnMap';
import { rowsToRoster } from '@/import/rosterFromTable';
import { createRosterStore } from '@/roster/storage';
import type { Roster } from '@/schema/author';
import { formatDiagnosticReport } from '@/diagnostics/formProbe';
import { sendToActiveTab } from './tabBridge';

const store = createRosterStore();

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
  } | null>(null);
  const [diagText, setDiagText] = useState('');

  const selected = rosters.find((r) => r.id === selectedId) ?? null;

  async function refreshRosters() {
    const list = await store.list();
    setRosters(list);
    if (!selectedId && list[0]) setSelectedId(list[0].id);
  }

  useEffect(() => {
    void refreshRosters();
    void (async () => {
      const res = await sendToActiveTab({ type: 'DETECT' });
      if (res.type === 'DETECT_RESULT') setDetected(res.result);
    })();
  }, []);

  async function onCsvFile(file: File) {
    setError('');
    const text = await file.text();
    const { headers, rows } = parseCsv(text);
    const mapping = suggestColumnMapping(headers);
    const name = file.name.replace(/\.csv$/i, '') || 'Imported roster';
    if (mapping.requiresConfirmation || !mappingIsComplete(mapping.map)) {
      setPendingMapping({ headers, rows, mapping, name });
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
    await refreshRosters();
    setSelectedId(roster.id);
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
      source: 'csv',
    });
    await store.importRoster(roster);
    setPendingMapping(null);
    await refreshRosters();
    setSelectedId(roster.id);
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
      setDiagText(formatDiagnosticReport(res.result));
      setStatus('Diagnostic captured (values redacted).');
    } else if (res.type === 'ERROR') {
      setError(res.message);
    }
  }

  const corresponding = selected?.authors.find((a) => a.isCorresponding);

  return (
    <div>
      <h1>journal-autofill</h1>
      <p className="tagline">
        Fill author metadata from a local roster. You always submit and certify yourself.
      </p>

      <section className="panel">
        <h2>Detected platform</h2>
        <div className="stat">
          {detected ? (
            <>
              <strong>{detected.label}</strong>
              {' · '}
              confidence {(detected.confidence * 100).toFixed(0)}%
            </>
          ) : (
            'Checking active tab…'
          )}
        </div>
      </section>

      <section className="panel">
        <h2>Roster</h2>
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
          <label className="secondary">
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
            <li>
              Missing email:{' '}
              <strong>
                {selected.authors.filter((a) => !a.email).length}
              </strong>
            </li>
          </ul>
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
              <select
                value={pendingMapping.mapping.map[idx] ?? ''}
                onChange={(e) =>
                  updateMapping(idx, (e.target.value || 'ignore') as CanonicalColumn)
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
            </div>
          ))}
          <button type="button" onClick={() => void confirmMapping()}>
            Import with this mapping
          </button>
        </section>
      )}

      <section className="panel">
        <h2>Actions</h2>
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
        <div className="row" style={{ marginTop: 8 }}>
          <button type="button" className="secondary" disabled={!selected} onClick={() => void runPreview()}>
            Preview
          </button>
          <button type="button" disabled={!selected} onClick={() => void runFill()}>
            Fill
          </button>
          <button type="button" className="secondary" onClick={() => void runDiagnostic()}>
            Diagnostics
          </button>
        </div>
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
          <p className="ok">Manuscript was not submitted.</p>
        </section>
      )}

      {diagText && (
        <section className="panel">
          <h2>Diagnostic report</h2>
          <textarea className="mapping" readOnly value={diagText} />
        </section>
      )}

      {status && <p className="ok">{status}</p>}
      {error && <p className="danger">{error}</p>}

      <p className="footnote">
        Local-first: author rosters stay in extension storage. The extension never clicks final
        submission, certification, copyright, payment, or signature controls.
      </p>
    </div>
  );
}
