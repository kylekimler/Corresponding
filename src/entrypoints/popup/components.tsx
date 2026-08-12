import type { CanonicalColumn } from '@/import/columnMap';
import type { PreviewSummary } from '@/popup/previewSummary';
import {
  displayAuthorName,
  type AuthorAttention,
} from '@/popup/authorAttention';

export function ColumnSelect(props: {
  value: CanonicalColumn | '';
  onChange: (v: CanonicalColumn) => void;
}) {
  return (
    <select
      value={props.value}
      onChange={(e) =>
        props.onChange((e.target.value || 'ignore') as CanonicalColumn)
      }
      aria-label="Column mapping"
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

export function downloadText(filename: string, contents: string, mime: string) {
  const blob = new Blob([contents], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function PortalBadge(props: {
  status: 'loading' | 'ready' | 'unknown' | 'error';
  label: string;
  detail?: string;
}) {
  const mark =
    props.status === 'ready' ? '✓' : props.status === 'loading' ? '…' : '·';
  return (
    <div
      className={`portal-badge portal-${props.status}`}
      role="status"
      aria-live="polite"
    >
      <span className="portal-mark" aria-hidden="true">
        {mark}
      </span>
      <div>
        <div className="portal-label">{props.label}</div>
        {props.detail ? <div className="portal-detail">{props.detail}</div> : null}
      </div>
    </div>
  );
}

export function PreviewResultCard(props: { summary: PreviewSummary }) {
  const s = props.summary;
  return (
    <section className="panel preview-result" aria-live="polite">
      <div className="preview-banner">{s.headline}</div>
      <ul className="preview-stats">
        <li>
          <span className="k">Portal</span>
          <span className="v">
            {s.portalLabel}
            {s.portalConfidence > 0
              ? ` · ${Math.round(s.portalConfidence * 100)}%`
              : ''}
          </span>
        </li>
        <li>
          <span className="k">Mappings proposed</span>
          <span className="v">{s.totalMappings}</span>
        </li>
        <li>
          <span className="k">Exact / tested</span>
          <span className="v">{s.exactMappings}</span>
        </li>
        <li>
          <span className="k">Semantic</span>
          <span className="v">{s.semanticMappings}</span>
        </li>
        <li>
          <span className="k">Preserved</span>
          <span className="v">{s.preserved}</span>
        </li>
        <li>
          <span className="k">Unresolved</span>
          <span className="v">{s.unresolved}</span>
        </li>
        <li>
          <span className="k">Conflicts</span>
          <span className="v">{s.conflicts}</span>
        </li>
      </ul>
      {s.evidence.length > 0 && (
        <p className="preview-evidence">
          Evidence: {s.evidence.slice(0, 4).join(', ')}
        </p>
      )}
      {s.authorGroups.length > 0 && (
        <details
          className="author-confidence"
          aria-label="Author selector confidence and completeness"
          open={s.authorGroups.length <= 8}
        >
          <summary>
            Author blocks ({s.authorGroups.length}) — selector confidence and
            completeness
          </summary>
          <ul tabIndex={0}>
            {s.authorGroups.map((group) => (
              <li key={group.authorSequence}>
                <span>Author {group.authorSequence}</span>
                <span
                  className={`confidence-badge confidence-${group.selectorConfidence}`}
                >
                  {group.selectorConfidence === 'exact'
                    ? 'Selectors: exact / tested'
                    : group.selectorConfidence === 'semantic'
                      ? 'Selectors: semantic'
                      : 'Selectors: unresolved'}
                </span>
                <span
                  className={`completeness-badge completeness-${group.completeness}`}
                >
                  {group.completeness === 'complete'
                    ? 'Complete'
                    : 'Needs attention'}
                </span>
                {(group.unresolved > 0 || group.conflicts > 0) && (
                  <span className="confidence-attention">
                    {group.unresolved > 0 ? `${group.unresolved} unresolved` : ''}
                    {group.unresolved > 0 && group.conflicts > 0 ? ' · ' : ''}
                    {group.conflicts > 0 ? `${group.conflicts} conflicts` : ''}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
      {s.conflictLabels.length > 0 && (
        <div>
          <p className="danger tight">Conflicts (not overwritten)</p>
          <ul className="compact">
            {s.conflictLabels.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </div>
      )}
      {s.unresolvedLabels.length > 0 && (
        <div>
          <p className="warn tight">Unresolved</p>
          <ul className="compact">
            {s.unresolvedLabels.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </div>
      )}
      {s.dryRun && (
        <p className="ok tight">Form was not modified.</p>
      )}
    </section>
  );
}

export function AttentionList(props: {
  items: AuthorAttention[];
  totalAuthors: number;
  onManage: () => void;
}) {
  if (props.items.length === 0) return null;
  const shown = props.items.slice(0, 8);
  return (
    <section className="panel attention-block" aria-label="Authors needing attention">
      <div className="attention-head">
        <strong>
          {props.items.length} need attention
        </strong>
        <span className="muted">
          {props.totalAuthors - props.items.length} ready collapsed
        </span>
      </div>
      <ul className="attention-list">
        {shown.map(({ author, reasons }) => (
          <li key={author.id}>
            <div className="attention-name">{displayAuthorName(author)}</div>
            <div className="attention-reasons">{reasons.join(' · ')}</div>
          </li>
        ))}
      </ul>
      {props.items.length > shown.length && (
        <p className="muted tight">
          +{props.items.length - shown.length} more
        </p>
      )}
      <button type="button" className="linkish" onClick={props.onManage}>
        Fix in Manage roster →
      </button>
    </section>
  );
}
