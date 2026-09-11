import { useEffect, useMemo, useRef, useState } from 'react';
import {
  COMPATIBILITY_CATALOG,
} from '@/compatibility/catalog';
import { ingestAuthorText } from '@/import/ingestAuthors';
import {
  mappingIsComplete,
  type CanonicalColumn,
  type ColumnMapping,
} from '@/import/columnMap';
import { rowsToRoster } from '@/import/rosterFromTable';
import {
  readyAuthorCount,
} from '@/popup/authorAttention';
import {
  addAuthor,
  removeAuthor,
  reorderAuthors,
  setAuthorCorresponding,
  updateAuthor,
} from '@/roster/mutations';
import { AuthorSchema, type Author, type Roster } from '@/schema/author';
import { CREDIT_ROLES, creditRoleLabel, type CreditRole } from '@/schema/credit';
import { normalizeOrcid } from '@/schema/orcid';
import {
  compileManuscriptRoster,
  createEmptyManuscript,
  touchManuscript,
  serializeManuscript,
  parseManuscriptJson,
  type Manuscript,
} from '@/schema/manuscript';
import {
  loadSelectedRoster,
  pingExtension,
  saveRosterToExtension,
  type BridgeResult,
} from '../bridge/client';
import {
  loadLocalManuscript,
  saveLocalManuscript,
  listLocalManuscripts,
} from '../storage/localManuscript';

type SyncState =
  | { kind: 'checking' }
  | { kind: 'not_installed'; detail: string }
  | { kind: 'syncing' }
  | { kind: 'synced' }
  | { kind: 'error'; detail: string };

type PendingTable = {
  headers: string[];
  rows: string[][];
  mapping: ColumnMapping;
};

const COLUMN_OPTIONS: CanonicalColumn[] = [
  'givenName',
  'middleName',
  'familyName',
  'namePrefix',
  'email',
  'orcid',
  'institution',
  'department',
  'city',
  'state',
  'postalCode',
  'country',
  'isCorresponding',
  'equalContribution',
  'creditRoles',
  'ignore',
];

function applyRoster(manuscript: Manuscript, roster: Roster): Manuscript {
  return touchManuscript(manuscript, {
    roster: {
      ...roster,
      id: manuscript.roster.id,
      name: manuscript.title.trim() || roster.name,
    },
  });
}

function syncLabel(state: SyncState): { className: string; text: string } {
  switch (state.kind) {
    case 'checking':
      return { className: 'sync', text: 'Checking the extension…' };
    case 'syncing':
      return { className: 'sync', text: 'Saving to the extension…' };
    case 'synced':
      return { className: 'sync ok', text: 'Saved to the Corresponding extension' };
    case 'not_installed':
      return { className: 'sync warn', text: state.detail };
    case 'error':
      return { className: 'sync err', text: state.detail };
    default:
      return { className: 'sync', text: '' };
  }
}

export function Workspace() {
  const [manuscript, setManuscript] = useState<Manuscript>(
    () => loadLocalManuscript() ?? createEmptyManuscript(),
  );
  const [paste, setPaste] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [pendingTable, setPendingTable] = useState<PendingTable | null>(null);
  const [sync, setSync] = useState<SyncState>({ kind: 'checking' });
  const [localError, setLocalError] = useState('');
  const [invalidAuthors, setInvalidAuthors] = useState<Record<string, boolean>>({});
  const [retry, setRetry] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const saveQueue = useRef<Promise<unknown>>(Promise.resolve());
  const hasInvalidEdits = Object.values(invalidAuthors).some(Boolean);
  useEffect(() => {
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      if (!hasInvalidEdits && !localError) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnBeforeLeaving);
    return () => window.removeEventListener('beforeunload', warnBeforeLeaving);
  }, [hasInvalidEdits, localError]);

  const authors = useMemo(
    () => [...manuscript.roster.authors].sort((a, b) => a.sequence - b.sequence),
    [manuscript.roster.authors],
  );
  const readyCount = readyAuthorCount(authors);
  const supported = COMPATIBILITY_CATALOG.filter(
    (row) => row.autofill === 'supported',
  );

  function commit(next: Manuscript) {
    const parsed = touchManuscript(next, {
      title: next.title,
      roster: next.roster,
    });
    setManuscript(parsed);
    setSync({ kind: 'checking' });
    try {
      saveLocalManuscript(parsed);
      setLocalError('');
    } catch {
      setLocalError('Could not save in this browser. Download a backup before closing this page.');
    }
  }

  useEffect(() => {
    let cancelled = false;
    const local = loadLocalManuscript();
    if (local) {
      setManuscript(local);
      return;
    }
    void loadSelectedRoster().then((result) => {
      if (result.type !== 'SELECTED_ROSTER' || !result.roster) return;
      if (cancelled || loadLocalManuscript()) return;
      const imported = createEmptyManuscript(result.roster.name);
      commit(
        { ...imported, id: result.roster.id, roster: result.roster },
      );
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (hasInvalidEdits || localError) return;
    let cancelled = false;
    const handle = window.setTimeout(() => {
      saveQueue.current = saveQueue.current.catch(() => undefined).then(async () => {
        if (cancelled) return;
        const ping = await pingExtension();
        if (cancelled) return;
        if (ping.type !== 'PONG') {
          setSync({
            kind: 'not_installed',
            detail:
              'Extension not connected. The roster is saved in this browser only.',
          });
          return;
        }
        setSync({ kind: 'syncing' });
        const saved = await saveRosterToExtension(
          compileManuscriptRoster(manuscript),
        );
        if (cancelled) return;
        if (saved.type === 'SAVED') {
          setSync({ kind: 'synced' });
          return;
        }
        setSync({
          kind: 'error',
          detail:
            saved.type === 'ERROR'
              ? saved.message
              : 'Could not save the roster to the extension.',
        });
      }).catch(() => {
        if (!cancelled) setSync({ kind: 'error', detail: 'Could not connect. Try again; your local draft is unchanged.' });
      });
    }, 280);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [manuscript, retry, hasInvalidEdits, localError]);

  function attemptImport(action: () => void) {
    try { action(); } catch {
      setWarnings(['Could not import these authors. Check the name and email columns, then try again. Your current roster is unchanged.']);
    }
  }

  function downloadBackup() {
    const url = URL.createObjectURL(new Blob([serializeManuscript(manuscript)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'corresponding-manuscript.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function replaceFromRoster(roster: Roster, nextWarnings: string[] = []) {
    if (authors.length && !window.confirm('Replace the current author list with this import? Download a backup first if you want to keep both.')) return;
    commit(applyRoster(manuscript, roster));
    setInvalidAuthors({});
    setWarnings(nextWarnings);
    setPendingTable(null);
    setPaste('');
  }

  function importText(text: string, sourceName?: string) {
    const result = ingestAuthorText(text, {
      name: manuscript.title.trim() || sourceName || 'Manuscript authors',
      id: manuscript.roster.id,
    });
    if (result.kind === 'empty') {
      setWarnings(result.warnings);
      return;
    }
    if (result.kind === 'block') {
      replaceFromRoster(result.roster, result.warnings);
      return;
    }
    if (result.roster && mappingIsComplete(result.mapping.map)) {
      replaceFromRoster(result.roster);
      return;
    }
    setPendingTable({
      headers: result.headers,
      rows: result.rows,
      mapping: result.mapping,
    });
    setWarnings(['Confirm the column mapping, then import.']);
  }

  function confirmTable() {
    if (!pendingTable || !mappingIsComplete(pendingTable.mapping.map)) return;
    replaceFromRoster(
      rowsToRoster({
        name: manuscript.title.trim() || 'Imported authors',
        headers: pendingTable.headers,
        rows: pendingTable.rows,
        mapping: pendingTable.mapping.map,
        source: 'csv',
        id: manuscript.roster.id,
      }),
    );
  }

  function patchAuthor(authorId: string, patch: Partial<Author>) {
    commit(
      applyRoster(manuscript, updateAuthor(manuscript.roster, authorId, patch)),
    );
  }

  const status = syncLabel(sync);
  const ready = sync.kind === 'synced' && authors.length > 0 && !hasInvalidEdits && !localError;

  return (
    <main className="shell">
      <header className="topbar">
        <a href="#/" className="wordmark" onClick={(event) => {
          if ((hasInvalidEdits || localError) && !window.confirm('Leave unfinished edits? Only the last saved version will be kept.')) event.preventDefault();
        }}>
          Corresponding
        </a>
        <span className="hint">Your manuscript workspace · Saved on this device</span>
      </header>
      {localError && <p role="alert" className="sync err">{localError}</p>}
      {listLocalManuscripts().length > 0 && <label className="field">
        <span>Previous manuscripts</span>
        <select value="" onChange={(event) => {
          const previous = listLocalManuscripts().find((item) => item.id === event.target.value);
          if (previous && (!hasInvalidEdits || window.confirm('Leave unfinished edits and open another manuscript?'))) {
            setInvalidAuthors({}); commit(previous);
          }
        }}>
          <option value="">Open a saved manuscript…</option>
          {listLocalManuscripts().filter((item) => item.id !== manuscript.id).map((item) => <option key={item.id} value={item.id}>{item.title || 'Untitled manuscript'}</option>)}
        </select>
      </label>}

      <input
        className="title-input"
        value={manuscript.title}
        placeholder="Manuscript title"
        aria-label="Manuscript title"
        onChange={(event) =>
          commit(touchManuscript(manuscript, { title: event.target.value }))
        }
      />

      <div className="toolbar">
        <button
          type="button"
          className="secondary"
          onClick={() => void fileRef.current?.click()}
        >
          Import file
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() =>
            commit(applyRoster(manuscript, addAuthor(manuscript.roster)))
          }
        >
          Add author
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv,text/tab-separated-values,.tsv,.json,application/json"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (!file) return;
            void file.text().then((text) => attemptImport(() => {
              if (file.name.toLowerCase().endsWith('.json')) {
                const imported = parseManuscriptJson(JSON.parse(text));
                if (authors.length && !window.confirm('Open this manuscript backup? Your current draft will be kept in manuscript history.')) return;
                setInvalidAuthors({}); commit(imported);
              } else importText(text, file.name);
            })).catch(() => setWarnings(['Could not read that file. Please try again.']));
          }}
        />
        <button type="button" className="ghost" onClick={downloadBackup}>{hasInvalidEdits ? 'Download last saved version' : 'Download backup'}</button>
      </div>

      <label className="field">
        <span>Paste authors</span>
        <textarea
          className="paste-box"
          value={paste}
          placeholder="Ada Lovelace1,*, Alan Turing1, and Grace Hopper2&#10;1 University of London&#10;2 Analytical Engines Institute"
          onChange={(event) => setPaste(event.target.value)}
        />
      </label>
      <p className="hint">
        Paste the author line from a manuscript, or a spreadsheet with named
        columns. Corresponding stores structured author records, not the raw
        text.
      </p>
      <div className="toolbar">
        <button
          type="button"
          className="secondary"
          disabled={!paste.trim()}
          onClick={() => attemptImport(() => importText(paste))}
        >
          Import authors
        </button>
      </div>

      {warnings.length > 0 && (
        <ul className="warn-list">
          {warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      )}

      {pendingTable && (
        <div className="mapping">
          {pendingTable.headers.map((header, index) => (
            <label className="mapping-row" key={`${header}-${index}`}>
              <span>{header || `Column ${index + 1}`}</span>
              <select
                value={pendingTable.mapping.map[index] ?? 'ignore'}
                onChange={(event) => {
                  const value = event.target.value as CanonicalColumn;
                  setPendingTable({
                    ...pendingTable,
                    mapping: {
                      ...pendingTable.mapping,
                      map: { ...pendingTable.mapping.map, [index]: value },
                    },
                  });
                }}
              >
                {COLUMN_OPTIONS.map((column) => (
                  <option key={column} value={column}>
                    {column}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <button
            type="button"
            className="primary"
            disabled={!mappingIsComplete(pendingTable.mapping.map)}
            onClick={() => attemptImport(confirmTable)}
          >
            Import columns
          </button>
        </div>
      )}

      <div className="roster-heading"><h2>Manuscript authors</h2><p>{authors.length} authors · Listed in submission order</p></div>
      {authors.length === 0 ? (
        <p className="empty-roster">No authors yet.</p>
      ) : (
        <ol className="roster">
          {authors.map((author, index) => (
            <AuthorEditor
              key={`${manuscript.id}:${author.id}`}
              author={author}
              index={index}
              total={authors.length}
              onPatch={(patch) => patchAuthor(author.id, patch)}
              onValidity={(invalid) => setInvalidAuthors((current) => current[author.id] === invalid ? current : { ...current, [author.id]: invalid })}
              onCorresponding={(value) =>
                commit(
                  applyRoster(
                    manuscript,
                    setAuthorCorresponding(manuscript.roster, author.id, value),
                  ),
                )
              }
              onMove={(direction) =>
                commit(
                  applyRoster(
                    manuscript,
                    reorderAuthors(
                      manuscript.roster,
                      index,
                      index + direction,
                    ),
                  ),
                )
              }
              onRemove={() => {
                setInvalidAuthors((current) => ({ ...current, [author.id]: false }));
                commit(
                  applyRoster(
                    manuscript,
                    removeAuthor(manuscript.roster, author.id),
                  ),
                );
              }}
            />
          ))}
        </ol>
      )}

      <div className="toolbar">
        <button
          type="button"
          className="secondary"
          onClick={() =>
            commit(applyRoster(manuscript, addAuthor(manuscript.roster)))
          }
        >
          Add author
        </button>
      </div>

      <section className="ready" aria-live="polite">
        {ready ? (
          <>
            <h2>{readyCount === authors.length ? 'Roster synced — ready to review on your journal site' : 'Roster synced — a few details still need attention'}</h2>
            <p>
              {authors.length} {authors.length === 1 ? 'author' : 'authors'}
              {readyCount < authors.length
                ? ` · ${readyCount} have email and institution`
                : ''}
              . Open your journal’s author page and look for Corresponding, or
              use the extension icon. Review the filled fields before continuing.
            </p>
            <p className="platforms">
              {supported.map((row) => row.platform).join(' · ')}
            </p>
          </>
        ) : (
          <>
            <h2>
              {authors.length === 0
                ? 'Add authors to continue'
                : hasInvalidEdits ? 'Finish editing to sync' : localError ? 'Draft not saved' : 'Roster saved locally'}
            </h2>
            <p>
              {authors.length === 0
                ? 'Paste an author block or add people by hand.'
                : 'Open a journal submission portal and click Corresponding to fill once the extension is connected.'}
            </p>
          </>
        )}
        <p className={hasInvalidEdits ? 'sync warn' : status.className}>{hasInvalidEdits ? 'Correct the highlighted author details. Unfinished edits have not been saved or synced.' : status.text}</p>
        {(sync.kind === 'not_installed' || sync.kind === 'error') && <button type="button" className="secondary" onClick={() => setRetry((value) => value + 1)}>Check connection again</button>}
        <p className="hint">Journal requirements vary. Some also require a prefix, postal address, or contributor roles.</p>
      </section>
    </main>
  );
}

function AuthorEditor({
  author: savedAuthor,
  index,
  total,
  onPatch: commitPatch,
  onValidity,
  onCorresponding,
  onMove,
  onRemove,
}: {
  author: Author;
  index: number;
  total: number;
  onPatch: (patch: Partial<Author>) => void;
  onValidity: (invalid: boolean) => void;
  onCorresponding: (value: boolean) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
}) {
  const [author, setAuthor] = useState(savedAuthor);
  const [error, setError] = useState('');
  useEffect(() => { if (!error) setAuthor(savedAuthor); }, [savedAuthor]);
  function onPatch(patch: Partial<Author>) {
    const next = { ...author, ...patch, sequence: savedAuthor.sequence };
    setAuthor(next);
    const parsed = AuthorSchema.safeParse(next);
    const invalid = !parsed.success || !next.givenName.trim() || !next.familyName.trim();
    onValidity(Boolean(invalid));
    if (invalid) {
      setError('Enter a given name, family name, and a valid email (or leave email blank). These edits are not saved yet.');
      return;
    }
    setError('');
    commitPatch(parsed.data);
  }
  const affiliation = author.affiliations[0];
  const selectedRoles = new Set(author.creditRoles);

  function patchAffiliation(
    field: 'institution' | 'department' | 'city' | 'country' | 'postalCode',
    value: string,
  ) {
    const next = value;
    const institution =
      field === 'institution' ? next : affiliation?.institution ?? '';
    const department =
      field === 'department' ? next : affiliation?.department ?? '';
    const city = field === 'city' ? next : affiliation?.city ?? '';
    const country = field === 'country' ? next : affiliation?.country ?? '';
    const postalCode =
      field === 'postalCode' ? next : affiliation?.postalCode ?? '';
    if (!institution && !department && !city && !country && !postalCode) {
      onPatch({ affiliations: author.affiliations.slice(1) });
      return;
    }
    onPatch({
      affiliations: [
        {
          ...affiliation,
          institution,
          department: department || undefined,
          city: city || undefined,
          country: country || undefined,
          postalCode: postalCode || undefined,
          isPrimary: affiliation?.isPrimary ?? true,
        },
        ...author.affiliations.slice(1),
      ],
    });
  }

  function toggleRole(role: CreditRole, checked: boolean) {
    const roles = checked
      ? [...author.creditRoles, role]
      : author.creditRoles.filter((item) => item !== role);
    onPatch({ creditRoles: roles });
  }

  return (
    <li className="author">
      <div className="author-index">{author.sequence}</div>
      <div className="author-fields">
        {error && <p role="alert" className="field-error">{error}</p>}
        <div className="name-row">
          <label className="field">
            <span>Given</span>
            <input
              value={author.givenName}
              onChange={(event) =>
                onPatch({ givenName: event.target.value })
              }
            />
          </label>
          <label className="field">
            <span>Middle</span>
            <input
              value={author.middleName ?? ''}
              onChange={(event) =>
                onPatch({ middleName: event.target.value || undefined })
              }
            />
          </label>
          <label className="field">
            <span>Family</span>
            <input
              value={author.familyName}
              onChange={(event) =>
                onPatch({ familyName: event.target.value })
              }
            />
          </label>
        </div>
        <label className="field"><span>Prefix (if your journal requires it)</span><input value={author.namePrefix ?? ''} placeholder="e.g. Dr." onChange={(event) => onPatch({ namePrefix: event.target.value || undefined })} /></label>
        <div className="meta-row">
          <label className="field">
            <span>Email</span>
            <input
              value={author.email ?? ''}
              onChange={(event) =>
                onPatch({ email: event.target.value || undefined })
              }
            />
          </label>
          <label className="field">
            <span>ORCID</span>
            <input
              value={author.orcid ?? ''}
              onBlur={(event) =>
                onPatch({ orcid: normalizeOrcid(event.target.value) })
              }
              onChange={(event) =>
                onPatch({ orcid: event.target.value || undefined })
              }
            />
          </label>
          <label className="corr">
            <input
              type="checkbox"
              checked={author.isCorresponding}
              onChange={(event) => onCorresponding(event.target.checked)}
            />
            Corresponding
          </label>
        </div>
        <div className="aff-row">
          <label className="field">
            <span>Institution</span>
            <input
              value={affiliation?.institution ?? ''}
              onChange={(event) =>
                patchAffiliation('institution', event.target.value)
              }
            />
          </label>
          <label className="field">
            <span>Department</span>
            <input
              value={affiliation?.department ?? ''}
              onChange={(event) =>
                patchAffiliation('department', event.target.value)
              }
            />
          </label>
          <label className="field">
            <span>City</span>
            <input
              value={affiliation?.city ?? ''}
              onChange={(event) => patchAffiliation('city', event.target.value)}
            />
          </label>
          <label className="field">
            <span>Country</span>
            <input
              value={affiliation?.country ?? ''}
              onChange={(event) =>
                patchAffiliation('country', event.target.value)
              }
            />
          </label>
          <label className="field">
            <span>Postal</span>
            <input
              value={affiliation?.postalCode ?? ''}
              onChange={(event) =>
                patchAffiliation('postalCode', event.target.value)
              }
            />
          </label>
        </div>
        <details className="credit">
          <summary>
            CRediT
            {selectedRoles.size > 0 ? ` · ${selectedRoles.size}` : ''}
          </summary>
          <div className="credit-grid">
            {CREDIT_ROLES.map((role) => (
              <label key={role}>
                <input
                  type="checkbox"
                  checked={selectedRoles.has(role)}
                  onChange={(event) => toggleRole(role, event.target.checked)}
                />
                {creditRoleLabel(role)}
              </label>
            ))}
          </div>
        </details>
      </div>
      <div className="author-tools">
        <button
          type="button"
          className="icon"
          aria-label="Move up"
          disabled={index === 0}
          onClick={() => onMove(-1)}
        >
          ↑
        </button>
        <button
          type="button"
          className="icon"
          aria-label="Move down"
          disabled={index === total - 1}
          onClick={() => onMove(1)}
        >
          ↓
        </button>
        <button
          type="button"
          className="icon"
          aria-label={`Remove ${author.givenName} ${author.familyName}`}
          onClick={onRemove}
        >
          ×
        </button>
      </div>
    </li>
  );
}
