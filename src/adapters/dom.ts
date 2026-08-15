import { assertSafeMutationTarget } from './safety';

export function getInput(
  doc: Document,
  id: string,
): HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null {
  const el = doc.getElementById(id);
  if (!el) return null;
  const tag = el.tagName.toLowerCase();
  // Tag checks, not instanceof: iframe documents have a different realm.
  if (tag === 'input' || tag === 'textarea' || tag === 'select') {
    return el as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
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
): 'filled' | 'overwritten' | 'preserved' | 'missing_element' | 'skipped_disabled' {
  const el = getInput(doc, id);
  if (!el) return 'missing_element';
  assertSafeMutationTarget(el);

  if (el.disabled || ('readOnly' in el && el.readOnly)) {
    return 'skipped_disabled';
  }

  const current = (el.value ?? '').trim();
  if (current && !options.overwrite) {
    return 'preserved';
  }

  if (options.dryRun) {
    return current ? 'overwritten' : 'filled';
  }

  if (el.tagName.toLowerCase() === 'select') {
    const matched = matchSelectOption(el as HTMLSelectElement, value);
    if (matched) {
      el.value = matched;
    } else {
      // Do not force arbitrary values into selects — prefer no write.
      return 'missing_element';
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

  // Partial match only for longer, unique candidates (avoid "a" → India).
  if (norm.length < 3) return null;
  const partial = Array.from(select.options).filter((opt) => {
    const t = opt.text.trim().toLowerCase();
    const v = opt.value.trim().toLowerCase();
    return (t.length >= 3 && (t.includes(norm) || norm.includes(t))) ||
      (v.length >= 3 && (v.includes(norm) || norm.includes(v)));
  });
  if (partial.length === 1) return partial[0]!.value;

  return null;
}

/**
 * Linked portal identity conflict detection.
 * Prefer false positives (skip) over overwriting a linked account.
 */
export function identitiesConflict(
  portal: { email?: string; familyName?: string; givenName?: string },
  roster: { email?: string; familyName?: string; givenName?: string },
  options: { linkedPid?: boolean } = {},
): boolean {
  const pEmail = (portal.email || '').trim().toLowerCase();
  const rEmail = (roster.email || '').trim().toLowerCase();
  const pLast = (portal.familyName || '').trim().toLowerCase();
  const rLast = (roster.familyName || '').trim().toLowerCase();
  const pFirst = (portal.givenName || '').trim().toLowerCase();
  const rFirst = (roster.givenName || '').trim().toLowerCase();

  if (pEmail && rEmail && pEmail !== rEmail) return true;
  if (pLast && rLast && pLast !== rLast) return true;
  if (pFirst && rFirst && pFirst !== rFirst) return true;

  // Linked PID with portal email but missing roster email → refuse overwrite.
  if (options.linkedPid && pEmail && !rEmail) return true;

  // Linked PID with any portal identity fields that don't match roster names.
  if (options.linkedPid) {
    const portalHasIdentity = Boolean(pEmail || pLast || pFirst);
    if (!portalHasIdentity) return false;
    if (pEmail && rEmail && pEmail === rEmail) return false;
    if ((pLast || pFirst) && (rLast || rFirst)) {
      // Already handled equality above; unequal would have returned true.
      return false;
    }
    // Portal has identity, roster lacks comparable fields → conflict.
    if (pEmail && !rEmail) return true;
    if ((pLast || pFirst) && !(rLast || rFirst)) return true;
  }

  return false;
}
