/**
 * Developer diagnostic utility: extract form metadata to help build adapters.
 * Values are redacted by default. Never collects password/auth fields.
 */

export type FieldCategory =
  | 'author'
  | 'affiliation'
  | 'email'
  | 'orcid'
  | 'sequence'
  | 'corresponding'
  | 'submit_or_legal'
  | 'auth_secret'
  | 'other';

export interface DiagnosticField {
  tag: string;
  inputType?: string;
  id?: string;
  name?: string;
  labelText?: string;
  optionTexts?: string[];
  category: FieldCategory;
  /** Always redacted unless includeValues=true and not secret. */
  value?: string;
  redacted: boolean;
}

export interface DiagnosticReport {
  url?: string;
  title?: string;
  capturedAt: string;
  fieldCount: number;
  fields: DiagnosticField[];
  notes: string[];
}

const SECRET_TYPES = new Set(['password']);
const SECRET_NAME_RE =
  /(password|passwd|pwd|auth[_-]?token|access[_-]?token|csrf|session)/i;

function cssEscapeIdent(value: string): string {
  // jsdom may lack CSS.escape; enough for id attribute selectors in diagnostics.
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value);
  }
  return value.replace(/[^a-zA-Z0-9_-]/g, (ch) => `\\${ch}`);
}

function labelFor(el: Element): string | undefined {
  if (el.id) {
    const lab = el.ownerDocument?.querySelector(
      `label[for="${cssEscapeIdent(el.id)}"]`,
    );
    if (lab?.textContent) return lab.textContent.trim();
  }
  const parentLabel = el.closest('label');
  if (parentLabel?.textContent) return parentLabel.textContent.trim();
  return undefined;
}

function categorize(el: Element, label?: string): FieldCategory {
  const blob = [el.id, el.getAttribute('name'), label, el.getAttribute('type')]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (
    SECRET_TYPES.has((el as HTMLInputElement).type || '') ||
    SECRET_NAME_RE.test(blob)
  ) {
    return 'auth_secret';
  }
  if (/(submit|certif|copyright|payment|signature|reviewer|agree|attest)/i.test(blob)) {
    return 'submit_or_legal';
  }
  if (/orcid/i.test(blob)) return 'orcid';
  if (/email|e-mail/i.test(blob)) return 'email';
  if (/corr/i.test(blob)) return 'corresponding';
  if (/seq|order|num_authors/i.test(blob)) return 'sequence';
  if (/org|affili|institut|university|dept|city|country|state/i.test(blob)) {
    return 'affiliation';
  }
  if (/first|last|middle|given|family|author|name/i.test(blob)) return 'author';
  return 'other';
}

export function probeForm(
  doc: Document,
  options: { includeValues?: boolean; url?: string } = {},
): DiagnosticReport {
  const includeValues = options.includeValues === true;
  const nodes = doc.querySelectorAll('input, select, textarea');
  const fields: DiagnosticField[] = [];
  const notes: string[] = [
    'Values redacted by default.',
    'Password and authentication fields are never included with values.',
    'Copy this report when requesting support for a new journal portal.',
  ];

  nodes.forEach((el) => {
    const tag = el.tagName.toLowerCase();
    const inputType =
      el instanceof HTMLInputElement ? el.type : undefined;
    const id = el.id || undefined;
    const name = el.getAttribute('name') || undefined;
    const labelText = labelFor(el);
    const category = categorize(el, labelText);

    if (category === 'auth_secret') {
      fields.push({
        tag,
        inputType,
        id,
        name,
        labelText,
        category,
        redacted: true,
      });
      return;
    }

    let optionTexts: string[] | undefined;
    if (el instanceof HTMLSelectElement) {
      optionTexts = Array.from(el.options).map((o) => o.text.trim());
    }

    const rawValue =
      el instanceof HTMLInputElement ||
      el instanceof HTMLTextAreaElement ||
      el instanceof HTMLSelectElement
        ? el.value
        : '';

    fields.push({
      tag,
      inputType,
      id,
      name,
      labelText,
      optionTexts,
      category,
      value: includeValues ? rawValue : undefined,
      redacted: !includeValues,
    });
  });

  return {
    url: options.url,
    title: doc.title || undefined,
    capturedAt: new Date().toISOString(),
    fieldCount: fields.length,
    fields,
    notes,
  };
}

export function formatDiagnosticReport(report: DiagnosticReport): string {
  const lines: string[] = [];
  lines.push('# journal-autofill diagnostic report');
  lines.push(`capturedAt: ${report.capturedAt}`);
  if (report.url) lines.push(`url: ${report.url}`);
  if (report.title) lines.push(`title: ${report.title}`);
  lines.push(`fieldCount: ${report.fieldCount}`);
  lines.push('');
  for (const note of report.notes) lines.push(`- ${note}`);
  lines.push('');
  for (const f of report.fields) {
    lines.push(
      [
        f.tag,
        f.inputType ? `type=${f.inputType}` : null,
        f.id ? `id=${f.id}` : null,
        f.name ? `name=${f.name}` : null,
        f.labelText ? `label=${JSON.stringify(f.labelText)}` : null,
        `category=${f.category}`,
        f.optionTexts
          ? `options=${JSON.stringify(f.optionTexts.slice(0, 30))}`
          : null,
        f.redacted ? 'value=[REDACTED]' : `value=${JSON.stringify(f.value ?? '')}`,
      ]
        .filter(Boolean)
        .join(' | '),
    );
  }
  return `${lines.join('\n')}\n`;
}
