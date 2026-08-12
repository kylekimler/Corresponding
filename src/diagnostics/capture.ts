/**
 * Structural compatibility capture for adapter development.
 * Never exports field values, credentials, or manuscript-identifying content.
 */

import { detectAuthorGroups } from '@/recognition/authorGroups';
import { extractFieldFeatures } from '@/recognition/features';
import type { FieldCategory } from './formProbe';
import {
  normalizeIdPattern,
  normalizeNamePattern,
  redactPageTitle,
  redactUrl,
  shouldOmitFieldFromCapture,
} from './redact';

export interface CaptureField {
  tag: string;
  inputType?: string;
  idPattern?: string;
  namePattern?: string;
  labelText?: string;
  optionLabels?: string[];
  category: FieldCategory;
  required: boolean;
  disabled: boolean;
  hidden: boolean;
  repeatedGroupKey?: string;
  repeatedGroupIndex?: number;
}

export interface CaptureStructure {
  repeatedGroups: Array<{
    pattern: string;
    count: number;
    evidence: string[];
  }>;
  authorGroupCount: number;
}

export interface CompatibilityCapture {
  capturedAt: string;
  redactionComplete: true;
  notes: string[];
  fieldCount: number;
  /** Structural field descriptors (no values). */
  structuralFields: CaptureField[];
  structure: CaptureStructure;
  urlPattern?: string;
  titleSafe?: string;
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
  const legend = fieldset?.querySelector(':scope > legend');
  if (legend?.textContent) return legend.textContent.trim();
  const prev = el.previousElementSibling;
  if (prev && ['LABEL', 'SPAN', 'DIV', 'P', 'TH', 'TD'].includes(prev.tagName)) {
    const t = prev.textContent?.trim();
    if (t && t.length < 80) return t;
  }
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

function inferRepeatedGroup(id?: string, name?: string): {
  key?: string;
  index?: number;
} {
  const source = id || name;
  if (!source) return {};
  const match = source.match(/^(.*?)(\d+)(.*)$/);
  if (!match) return {};
  const prefix = match[1] ?? '';
  const suffix = match[3] ?? '';
  const index = Number.parseInt(match[2] ?? '', 10);
  if (!Number.isFinite(index)) return {};
  return {
    key: normalizeIdPattern(`${prefix}#${suffix}`),
    index,
  };
}

const CAPTURE_NOTES = [
  'Structural capture only — field values are never exported.',
  'IDs and names are normalized (# replaces digits) for safe sharing.',
  'Password, token, CSRF, cookie, and hidden auth fields are omitted.',
  'Share this capture when requesting support for a new journal portal.',
];

export function captureForm(
  doc: Document,
  options: { url?: string } = {},
): CompatibilityCapture {
  const nodes = doc.querySelectorAll('input, select, textarea');
  const fields: CaptureField[] = [];

  nodes.forEach((el) => {
    const tag = el.tagName.toLowerCase();
    const inputType =
      el instanceof HTMLInputElement ? el.type : undefined;
    const id = el.id || undefined;
    const name = el.getAttribute('name') || undefined;
    const labelText = labelFor(el);

    if (shouldOmitFieldFromCapture(el, labelText)) {
      return;
    }

    const category = categorize(el, labelText);
    if (category === 'auth_secret') {
      return;
    }

    let optionLabels: string[] | undefined;
    if (el instanceof HTMLSelectElement) {
      optionLabels = Array.from(el.options)
        .map((o) => o.text.trim())
        .filter(Boolean);
    }

    const required =
      el.hasAttribute('required') ||
      el.getAttribute('aria-required') === 'true';
    const disabled =
      (el instanceof HTMLInputElement ||
        el instanceof HTMLSelectElement ||
        el instanceof HTMLTextAreaElement) &&
      el.disabled;
    const hidden =
      inputType === 'hidden' ||
      (el instanceof HTMLElement && el.hidden);

    const { key: repeatedGroupKey, index: repeatedGroupIndex } =
      inferRepeatedGroup(id, name);

    fields.push({
      tag,
      inputType,
      idPattern: id ? normalizeIdPattern(id) : undefined,
      namePattern: name ? normalizeNamePattern(name) : undefined,
      labelText,
      optionLabels,
      category,
      required,
      disabled,
      hidden,
      repeatedGroupKey,
      repeatedGroupIndex,
    });
  });

  const features = extractFieldFeatures(doc);
  const authorGroups = detectAuthorGroups(features);
  const groupCounts = new Map<string, { count: number; evidence: string[] }>();
  for (const g of authorGroups) {
    const pattern = g.pattern;
    const existing = groupCounts.get(pattern);
    if (existing) {
      existing.count += 1;
      existing.evidence.push(...g.evidence);
    } else {
      groupCounts.set(pattern, { count: 1, evidence: [...g.evidence] });
    }
  }

  const repeatedFromFields = new Map<string, number>();
  for (const f of fields) {
    if (!f.repeatedGroupKey) continue;
    repeatedFromFields.set(
      f.repeatedGroupKey,
      (repeatedFromFields.get(f.repeatedGroupKey) ?? 0) + 1,
    );
  }
  for (const [pattern, count] of repeatedFromFields) {
    if (!groupCounts.has(pattern)) {
      groupCounts.set(pattern, { count: Math.ceil(count / 4), evidence: ['id-pattern'] });
    }
  }

  return {
    capturedAt: new Date().toISOString(),
    redactionComplete: true,
    notes: [...CAPTURE_NOTES],
    fieldCount: fields.length,
    structuralFields: fields,
    structure: {
      repeatedGroups: [...groupCounts.entries()].map(([pattern, info]) => ({
        pattern,
        count: info.count,
        evidence: [...new Set(info.evidence)].slice(0, 8),
      })),
      authorGroupCount: authorGroups.length,
    },
    urlPattern: options.url ? redactUrl(options.url) : undefined,
    titleSafe: redactPageTitle(doc.title || ''),
  };
}

export function previewCapture(capture: CompatibilityCapture): string {
  const lines: string[] = [];
  lines.push('# Corresponding compatibility capture');
  lines.push(`capturedAt: ${capture.capturedAt}`);
  lines.push(`redactionComplete: ${capture.redactionComplete}`);
  if (capture.urlPattern) lines.push(`urlPattern: ${capture.urlPattern}`);
  if (capture.titleSafe) lines.push(`titleSafe: ${capture.titleSafe}`);
  lines.push(`fieldCount: ${capture.fieldCount}`);
  lines.push(`authorGroupCount: ${capture.structure.authorGroupCount}`);
  lines.push('');
  lines.push('## notes');
  for (const note of capture.notes) lines.push(`- ${note}`);
  lines.push('');
  if (capture.structure.repeatedGroups.length > 0) {
    lines.push('## repeated structure');
    for (const g of capture.structure.repeatedGroups) {
      lines.push(
        `- pattern=${g.pattern} count=${g.count} evidence=${JSON.stringify(g.evidence)}`,
      );
    }
    lines.push('');
  }
  lines.push('## structuralFields');
  for (const f of capture.structuralFields) {
    lines.push(
      [
        f.tag,
        f.inputType ? `type=${f.inputType}` : null,
        f.idPattern ? `idPattern=${f.idPattern}` : null,
        f.namePattern ? `namePattern=${f.namePattern}` : null,
        f.labelText ? `label=${JSON.stringify(f.labelText)}` : null,
        `category=${f.category}`,
        f.required ? 'required' : null,
        f.hidden ? 'hidden' : null,
        f.repeatedGroupKey
          ? `group=${f.repeatedGroupKey}#${f.repeatedGroupIndex ?? '?'}`
          : null,
        f.optionLabels
          ? `options=${JSON.stringify(f.optionLabels.slice(0, 30))}`
          : null,
      ]
        .filter(Boolean)
        .join(' | '),
    );
  }
  return `${lines.join('\n')}\n`;
}

/** Alias for captureForm used by compatibility capture tests. */
export const buildCompatibilityCapture = captureForm;
