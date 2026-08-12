/**
 * Developer diagnostic utility: extract form metadata to help build adapters.
 * Values are redacted by default. Never collects password/auth fields.
 */

import {
  captureForm,
  previewCapture,
  type CompatibilityCapture,
} from './capture';
import {
  normalizeIdPattern,
  normalizeNamePattern,
  redactFreeText,
  shouldOmitFieldFromCapture,
} from './redact';

export type { CompatibilityCapture } from './capture';
export { captureForm, previewCapture } from './capture';

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
  /** Normalized id with digits replaced by #. */
  idPattern?: string;
  /** Normalized name with digits replaced by #. */
  namePattern?: string;
  labelText?: string;
  optionTexts?: string[];
  category: FieldCategory;
  required?: boolean;
  /** Always redacted unless includeValues=true and not secret. */
  value?: string;
  redacted: boolean;
}

export interface DiagnosticReport extends CompatibilityCapture {
  /** Backward-compatible redacted URL (same as urlPattern). */
  url?: string;
  /** Backward-compatible redacted title (same as titleSafe). */
  title?: string;
  /** Legacy flat field list — values always redacted in production captures. */
  fields: DiagnosticField[];
}

const SECRET_TYPES = new Set(['password']);
const SECRET_NAME_RE =
  /(password|passwd|pwd|auth[_-]?token|access[_-]?token|csrf|session)/i;

function cssEscapeIdent(value: string): string {
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
  const fieldset = el.closest('fieldset');
  const legend = fieldset?.querySelector('legend');
  if (legend?.textContent) return legend.textContent.trim();
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

function probeLegacyFields(
  doc: Document,
  includeValues: boolean,
): DiagnosticField[] {
  const nodes = doc.querySelectorAll('input, select, textarea');
  const fields: DiagnosticField[] = [];

  nodes.forEach((el) => {
    const tag = el.tagName.toLowerCase();
    const inputType =
      el instanceof HTMLInputElement ? el.type : undefined;
    const id = el.id || undefined;
    const name = el.getAttribute('name') || undefined;
    const labelText = labelFor(el);
    const category = categorize(el, labelText);
    const required =
      el.hasAttribute('required') ||
      el.getAttribute('aria-required') === 'true';

    const safeLabel = labelText ? redactFreeText(labelText) : undefined;

    if (
      category === 'auth_secret' ||
      shouldOmitFieldFromCapture(el, labelText)
    ) {
      fields.push({
        tag,
        inputType,
        id: id ? normalizeIdPattern(id) : undefined,
        name: name ? normalizeNamePattern(name) : undefined,
        idPattern: id ? normalizeIdPattern(id) : undefined,
        namePattern: name ? normalizeNamePattern(name) : undefined,
        labelText: safeLabel,
        category,
        required,
        redacted: true,
      });
      return;
    }

    let optionTexts: string[] | undefined;
    if (el instanceof HTMLSelectElement) {
      optionTexts = Array.from(el.options)
        .map((o) => redactFreeText(o.text.trim()))
        .filter(Boolean);
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
      id: id ? normalizeIdPattern(id) : undefined,
      name: name ? normalizeNamePattern(name) : undefined,
      idPattern: id ? normalizeIdPattern(id) : undefined,
      namePattern: name ? normalizeNamePattern(name) : undefined,
      labelText: safeLabel,
      optionTexts,
      category,
      required,
      value: includeValues ? rawValue : undefined,
      redacted: !includeValues,
    });
  });

  return fields;
}

export function probeForm(
  doc: Document,
  options: { includeValues?: boolean; url?: string } = {},
): DiagnosticReport {
  const includeValues = options.includeValues === true;
  const capture = captureForm(doc, { url: options.url });
  const fields = probeLegacyFields(doc, includeValues);

  return {
    ...capture,
    url: capture.urlPattern,
    title: capture.titleSafe,
    fields,
  };
}

/** Human-readable preview — preferred for UI export. */
export function formatDiagnosticReport(report: DiagnosticReport): string {
  return formatLegacyDiagnosticReport(report);
}

/** Format legacy probe output including fields section. */
export function formatLegacyDiagnosticReport(report: DiagnosticReport): string {
  const lines: string[] = [previewCapture(report).trimEnd(), '', '## fields'];
  for (const f of report.fields) {
    lines.push(
      [
        f.tag,
        f.inputType ? `type=${f.inputType}` : null,
        f.idPattern ? `idPattern=${f.idPattern}` : null,
        f.namePattern ? `namePattern=${f.namePattern}` : null,
        f.labelText ? `label=${JSON.stringify(f.labelText)}` : null,
        `category=${f.category}`,
        f.required ? 'required' : null,
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
