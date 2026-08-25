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
import type { Author, Roster } from '@/schema/author';
import { CREDIT_ROLES, creditRoleLabel, type CreditRole } from '@/schema/credit';
import { normalizeOrcid } from '@/schema/orcid';
import {
  compileManuscriptRoster,
  createEmptyManuscript,
  touchManuscript,
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
  const fileRef = useRef<HTMLInputElement>(null);
  const hydrated = useRef(false);

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
    saveLocalManuscript(parsed);
  }

  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    const local = loadLocalManuscript();
    if (local && (local.title || local.roster.authors.length > 0)) {
      setManuscript(local);
      return;
    }
    void loadSelectedRoster().then((result) => {
      if (result.type !== 'SELECTED_ROSTER' || !result.roster) return;
      if (loadLocalManuscript()?.roster.authors.length) return;
      const imported = createEmptyManuscript(result.roster.name);
      commit(
        applyRoster(imported, {
          ...result.roster,
          id: imported.roster.id,
        }),
      );
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    const handle = window.setTimeout(() => {
      void (async () => {
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
      })();
    }, 280);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [manuscript]);

  function replaceFromRoster(roster: Roster, nextWarnings: string[] = []) {
    commit(applyRoster(manuscript, roster));
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
  const ready = sync.kind === 'synced' && authors.length > 0;

  return (
    <main className="shell">
      <header className="topbar">
        <a href="#/" className="wordmark">
          Corresponding
        </a>
      </header>

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
          Import CSV
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
          accept=".csv,text/csv,text/tab-separated-values,.tsv"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (!file) return;
            void file.text().then((text) => importText(text, file.name));
          }}
        />
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
          onClick={() => importText(paste)}
        >
          Parse authors
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
            onClick={confirmTable}
          >
            Import columns
          </button>
        </div>
      )}

      {authors.length === 0 ? (
        <p className="empty-roster">No authors yet.</p>
      ) : (
        <ol className="roster">
          {authors.map((author, index) => (
            <AuthorEditor
              key={author.id}
              author={author}
              index={index}
              total={authors.length}
              onPatch={(patch) => patchAuthor(author.id, patch)}
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
              onRemove={() =>
                commit(
                  applyRoster(
                    manuscript,
                    removeAuthor(manuscript.roster, author.id),
                  ),
                )
              }
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
            <h2>Ready for submission</h2>
            <p>
              {authors.length} {authors.length === 1 ? 'author' : 'authors'}
              {readyCount < authors.length
                ? ` · ${readyCount} have email and institution`
                : ''}
              . Open a supported journal submission portal, then click the
              Corresponding extension to fill.
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
                : 'Roster saved locally'}
            </h2>
            <p>
              {authors.length === 0
                ? 'Paste an author block or add people by hand.'
                : 'Open a journal submission portal and click Corresponding to fill once the extension is connected.'}
            </p>
          </>
        )}
        <p className={status.className}>{status.text}</p>
      </section>
    </main>
  );
}

function AuthorEditor({
  author,
  index,
  total,
  onPatch,
  onCorresponding,
  onMove,
  onRemove,
}: {
  author: Author;
  index: number;
  total: number;
  onPatch: (patch: Partial<Author>) => void;
  onCorresponding: (value: boolean) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
}) {
  const affiliation = author.affiliations[0];
  const selectedRoles = new Set(author.creditRoles);

  function patchAffiliation(
    field: 'institution' | 'department' | 'city' | 'country' | 'postalCode',
    value: string,
  ) {
    const next = value.trim();
    const institution =
      field === 'institution' ? next : affiliation?.institution ?? '';
    const department =
      field === 'department' ? next : affiliation?.department ?? '';
    const city = field === 'city' ? next : affiliation?.city ?? '';
    const country = field === 'country' ? next : affiliation?.country ?? '';
    const postalCode =
      field === 'postalCode' ? next : affiliation?.postalCode ?? '';
    if (!institution) {
      onPatch({ affiliations: [] });
      return;
    }
    onPatch({
      affiliations: [
        {
          institution,
          department: department || undefined,
          city: city || undefined,
          country: country || undefined,
          postalCode: postalCode || undefined,
          isPrimary: true,
        },
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
        <div className="name-row">
          <label className="field">
            <span>Given</span>
            <input
              value={author.givenName}
              onChange={(event) =>
                onPatch({ givenName: event.target.value || 'Given' })
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
                onPatch({ familyName: event.target.value || 'Family' })
              }
            />
          </label>
        </div>
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
