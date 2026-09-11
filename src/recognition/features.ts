import type { FieldFeatures } from './types';

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
  return undefined;
}

function nearbyLabel(el: Element): string | undefined {
  const prev = el.previousElementSibling;
  if (prev && ['LABEL', 'SPAN', 'DIV', 'P', 'TH', 'TD'].includes(prev.tagName)) {
    const t = prev.textContent?.trim();
    if (t && t.length < 80) return t;
  }
  const parent = el.parentElement;
  if (parent) {
    const legend = parent.querySelector(':scope > legend, :scope > h3, :scope > h4');
    if (legend?.textContent) return legend.textContent.trim();
  }
  return undefined;
}

/** Strip digits used only as group indices for structural comparison. */
export function normalizeStructuralText(parts: Array<string | undefined>): string {
  return parts
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .replace(/[_\-./]+/g, ' ')
    .replace(/\b\d+\b/g, '#')
    .replace(/\s+/g, ' ')
    .trim();
}

export function elementKey(el: Element, index: number): string {
  if (el.id) return `id:${el.id}`;
  const name = el.getAttribute('name');
  if (name) return `name:${name}#${index}`;
  return `idx:${index}:${el.tagName.toLowerCase()}`;
}

const SKIPPED_INPUT_TYPES = new Set([
  'password',
  'submit',
  'button',
  'file',
  'image',
  'reset',
]);

export function isSkippedInputType(inputType: string | undefined): boolean {
  return Boolean(inputType && SKIPPED_INPUT_TYPES.has(inputType));
}

/**
 * Structural features for one control. Never uses the field value.
 */
export function extractControlFeatures(
  el: Element,
  index = 0,
): FieldFeatures | null {
  const tag = el.tagName.toLowerCase();
  const inputType =
    el instanceof HTMLInputElement ? (el.type || 'text').toLowerCase() : undefined;

  if (isSkippedInputType(inputType)) return null;

  const id = el.id || undefined;
  const name = el.getAttribute('name') || undefined;
  const label = labelFor(el);
  const ariaLabel = el.getAttribute('aria-label') || undefined;
  const placeholder =
    el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement
      ? el.placeholder || undefined
      : undefined;
  const near = nearbyLabel(el);
  const optionLabels =
    el instanceof HTMLSelectElement
      ? Array.from(el.options).map((o) => o.text.trim()).filter(Boolean)
      : undefined;

  const required =
    el.hasAttribute('required') || el.getAttribute('aria-required') === 'true';
  const disabled =
    (el instanceof HTMLInputElement ||
      el instanceof HTMLSelectElement ||
      el instanceof HTMLTextAreaElement) &&
    el.disabled;
  const hidden =
    inputType === 'hidden' ||
    (el instanceof HTMLElement && el.hidden) ||
    (el instanceof HTMLElement && getComputedStyle(el).display === 'none');

  return {
    elementKey: elementKey(el, index),
    tag,
    inputType,
    id,
    name,
    label,
    ariaLabel,
    placeholder,
    nearbyLabel: near,
    optionLabels,
    required,
    disabled,
    hidden,
    normalizedText: normalizeStructuralText([
      id,
      name,
      label,
      ariaLabel,
      placeholder,
      near,
    ]),
  };
}

/**
 * Extract structural features for editable fields.
 * Never uses field values for classification.
 */
export function extractFieldFeatures(doc: Document): FieldFeatures[] {
  const nodes = doc.querySelectorAll('input, select, textarea');
  const out: FieldFeatures[] = [];
  let index = 0;

  nodes.forEach((el) => {
    const described = extractControlFeatures(el, index);
    if (described) out.push(described);
    index += 1;
  });

  return out;
}
