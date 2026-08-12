import { assertSafeMutationTarget } from './safety';

export function getInput(
  doc: Document,
  id: string,
): HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null {
  const el = doc.getElementById(id);
  if (!el) return null;
  if (
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    el instanceof HTMLSelectElement
  ) {
    return el;
  }
  return null;
}

export function readValue(doc: Document, id: string): string {
  const el = getInput(doc, id);
  if (!el) return '';
  return (el.value ?? '').trim();
}

export function setValue(
  doc: Document,
  id: string,
  value: string,
  options: { overwrite: boolean; dryRun: boolean },
): 'filled' | 'overwritten' | 'preserved' | 'missing_element' {
  const el = getInput(doc, id);
  if (!el) return 'missing_element';
  assertSafeMutationTarget(el);

  const current = (el.value ?? '').trim();
  if (current && !options.overwrite) {
    return 'preserved';
  }

  if (options.dryRun) {
    return current ? 'overwritten' : 'filled';
  }

  if (el instanceof HTMLSelectElement) {
    const matched = matchSelectOption(el, value);
    if (matched) {
      el.value = matched;
    } else {
      el.value = value;
    }
  } else {
    el.value = value;
  }

  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  return current ? 'overwritten' : 'filled';
}

export function matchSelectOption(
  select: HTMLSelectElement,
  desired: string,
): string | null {
  const norm = desired.trim().toLowerCase();
  if (!norm) return null;

  for (const opt of Array.from(select.options)) {
    const v = opt.value.trim().toLowerCase();
    const t = opt.text.trim().toLowerCase();
    if (v === norm || t === norm) return opt.value;
  }

  // Partial contains match as last resort for country names.
  for (const opt of Array.from(select.options)) {
    const t = opt.text.trim().toLowerCase();
    if (t.includes(norm) || norm.includes(t)) return opt.value;
  }

  return null;
}

export function identitiesConflict(
  portal: { email?: string; familyName?: string; givenName?: string },
  roster: { email?: string; familyName?: string; givenName?: string },
): boolean {
  const pEmail = (portal.email || '').trim().toLowerCase();
  const rEmail = (roster.email || '').trim().toLowerCase();
  if (pEmail && rEmail && pEmail !== rEmail) return true;

  const pLast = (portal.familyName || '').trim().toLowerCase();
  const rLast = (roster.familyName || '').trim().toLowerCase();
  if (pLast && rLast && pLast !== rLast) return true;

  const pFirst = (portal.givenName || '').trim().toLowerCase();
  const rFirst = (roster.givenName || '').trim().toLowerCase();
  if (pFirst && rFirst && pFirst !== rFirst) return true;

  return false;
}
