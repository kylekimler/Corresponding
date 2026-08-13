/**
 * Structural compatibility capture for adapter development.
 * Never exports field values, credentials, or manuscript-identifying content.
 */

import { detectAuthorGroups } from '@/recognition/authorGroups';
import { extractFieldFeatures } from '@/recognition/features';
import type { FieldCategory } from './formProbe';
import {
  evaluateRedactionComplete,
  normalizeIdPattern,
  normalizeNamePattern,
  redactFreeText,
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

export interface CaptureControl {
  tag: string;
  inputType?: string;
  idPattern?: string;
  namePattern?: string;
  actionLabel?: string;
  category: FieldCategory;
  disabled: boolean;
  hidden: boolean;
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
  /** Fail-closed: false if residual PII patterns remain after redaction. */
  redactionComplete: boolean;
  notes: string[];
  fieldCount: number;
  controlCount: number;
  /** Structural field descriptors (no values). */
  structuralFields: CaptureField[];
  /** Redacted action controls needed to understand repeated modal workflows. */
  controls: CaptureControl[];
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

const SAFE_ACTION_WORD =
  /^(add|author|co-?author|save|cancel|close|continue|next|back|previous|done|edit|remove|delete|open|submit|certify|copyright|payment|pay|accept)$/i;

function redactControlLabel(raw: string): string | undefined {
  const words = raw.trim().split(/\s+/).filter(Boolean).slice(0, 8);
  if (words.length === 0) return undefined;
  const redacted = words.map((word) =>
    SAFE_ACTION_WORD.test(word.replace(/[^\p{L}-]/gu, ''))
      ? word
      : '[redacted]',
  );
  return redacted
    .filter(
      (word, index) =>
        word !== '[redacted]' || redacted[index - 1] !== '[redacted]',
    )
    .join(' ');
}

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
        .map((o) => redactFreeText(o.text.trim()))
        .filter(Boolean)
        .slice(0, 40);
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
      labelText: labelText ? redactFreeText(labelText) : undefined,
      optionLabels,
      category,
      required,
      disabled,
      hidden,
      repeatedGroupKey,
      repeatedGroupIndex,
    });
  });

  const controls: CaptureControl[] = [];
  doc
    .querySelectorAll(
      'button, input[type="button"], input[type="submit"], [role="button"]',
    )
    .forEach((el) => {
      const inputType =
        el instanceof HTMLInputElement ? el.type : undefined;
      const rawLabel =
        el.getAttribute('aria-label') ||
        (el instanceof HTMLInputElement ? el.value : el.textContent) ||
        '';
      const id = el.id || undefined;
      const name = el.getAttribute('name') || undefined;
      const category = categorize(el, rawLabel);
      if (
        category === 'auth_secret' ||
        shouldOmitFieldFromCapture(el, rawLabel)
      ) {
        return;
      }
      controls.push({
        tag: el.tagName.toLowerCase(),
        inputType,
        idPattern: id ? normalizeIdPattern(id) : undefined,
        namePattern: name ? normalizeNamePattern(name) : undefined,
        actionLabel: redactControlLabel(rawLabel),
        category,
        disabled:
          (el instanceof HTMLButtonElement ||
            el instanceof HTMLInputElement) &&
          el.disabled,
        hidden:
          (el instanceof HTMLElement && el.hidden) ||
          el.getAttribute('aria-hidden') === 'true',
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

  const draft: CompatibilityCapture = {
    capturedAt: new Date().toISOString(),
    redactionComplete: true,
    notes: [...CAPTURE_NOTES],
    fieldCount: fields.length,
    controlCount: controls.length,
    structuralFields: fields,
    controls,
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

  // Fail closed: if residual PII patterns remain in the export, mark incomplete.
  const preview = previewCapture({ ...draft, redactionComplete: true });
  draft.redactionComplete = evaluateRedactionComplete(preview);
  if (!draft.redactionComplete) {
    draft.notes = [
      ...draft.notes,
      'WARNING: residual sensitive patterns detected; treat export as incomplete.',
    ];
  }
  return draft;
}

export function previewCapture(capture: CompatibilityCapture): string {
  const lines: string[] = [];
  lines.push('# Corresponding compatibility capture');
  lines.push(`capturedAt: ${capture.capturedAt}`);
  lines.push(`redactionComplete: ${capture.redactionComplete}`);
  if (capture.urlPattern) lines.push(`urlPattern: ${capture.urlPattern}`);
  if (capture.titleSafe) lines.push(`titleSafe: ${capture.titleSafe}`);
  lines.push(`fieldCount: ${capture.fieldCount}`);
  lines.push(`controlCount: ${capture.controlCount}`);
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
  if (capture.controls.length > 0) {
    lines.push('');
    lines.push('## controls');
    for (const control of capture.controls) {
      lines.push(
        [
          control.tag,
          control.inputType ? `type=${control.inputType}` : null,
          control.idPattern ? `idPattern=${control.idPattern}` : null,
          control.namePattern ? `namePattern=${control.namePattern}` : null,
          control.actionLabel
            ? `action=${JSON.stringify(control.actionLabel)}`
            : null,
          `category=${control.category}`,
          control.disabled ? 'disabled' : null,
          control.hidden ? 'hidden' : null,
        ]
          .filter(Boolean)
          .join(' | '),
      );
    }
  }
  return `${lines.join('\n')}\n`;
}

/** Alias for captureForm used by compatibility capture tests. */
export const buildCompatibilityCapture = captureForm;
