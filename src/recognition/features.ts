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

/**
 * Extract structural features for editable fields.
 * Never uses field values for classification.
 */
export function extractFieldFeatures(doc: Document): FieldFeatures[] {
  const nodes = doc.querySelectorAll('input, select, textarea');
  const out: FieldFeatures[] = [];
  let index = 0;

  nodes.forEach((el) => {
    const tag = el.tagName.toLowerCase();
    const inputType =
      el instanceof HTMLInputElement ? (el.type || 'text').toLowerCase() : undefined;

    // Skip non-editable / auth / submit controls from recognition candidates.
    if (
      inputType === 'password' ||
      inputType === 'submit' ||
      inputType === 'button' ||
      inputType === 'file' ||
      inputType === 'image' ||
      inputType === 'reset'
    ) {
      index += 1;
      return;
    }

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
      el.hasAttribute('required') ||
      el.getAttribute('aria-required') === 'true';
    const disabled =
      (el instanceof HTMLInputElement ||
        el instanceof HTMLSelectElement ||
        el instanceof HTMLTextAreaElement) &&
      el.disabled;
    const hidden =
      inputType === 'hidden' ||
      (el instanceof HTMLElement && el.hidden) ||
      (el instanceof HTMLElement &&
        getComputedStyle(el).display === 'none');

    const key = elementKey(el, index);
    out.push({
      elementKey: key,
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
    });
    index += 1;
  });

  return out;
}
