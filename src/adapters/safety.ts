/**
 * Controls that must never be clicked or submitted by the extension.
 * Matching is case-insensitive against id, name, value, and visible text.
 * Snake_case / kebab-case ids are normalized so `final_submit` matches `submit`.
 */
const FORBIDDEN_PATTERNS: RegExp[] = [
  /\bsubmit\b/i,
  /\bfinal\s*submit/i,
  /\bcertif/i,
  /\bcopyright\b/i,
  /\bconflict\s*of\s*interest\b/i,
  /\bcoi\b/i,
  /\bpayment\b/i,
  /\bbilling\b/i,
  /\bsignature\b/i,
  /\be\s*sign/i,
  /\breviewer\s*invit/i,
  /\bagree\b/i,
  /\battest/i,
  /\bsave\s+and\s+continue\b/i,
  /\bproceed\b/i,
  /\bbuild\s+pdf\b/i,
  /\bapprove\s+submission\b/i,
];

/** Normalize identifiers so word boundaries work on snake_case / camelCase. */
export function normalizeControlText(raw: string): string {
  return raw
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_\-.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function isForbiddenControl(el: Element): boolean {
  if (
    (el instanceof HTMLInputElement || el instanceof HTMLButtonElement) &&
    el.type === 'submit'
  ) {
    return true;
  }
  // Text entry is not a click/attest action. A "Conflict of Interest"
  // textarea may be filled; the matching checkbox/button may not be clicked.
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
    return false;
  }
  if (el instanceof HTMLInputElement) {
    const type = (el.type || 'text').toLowerCase();
    if (
      type === 'text' ||
      type === 'email' ||
      type === 'number' ||
      type === 'search' ||
      type === 'tel' ||
      type === 'url' ||
      type === 'hidden'
    ) {
      return false;
    }
  }
  const attrs = normalizeControlText(
    [
      el.id,
      el.getAttribute('name') ?? '',
      el.getAttribute('value') ?? '',
      el.getAttribute('aria-label') ?? '',
      el.textContent?.trim() ?? '',
    ].join(' '),
  );

  if (!attrs) return false;
  return FORBIDDEN_PATTERNS.some((re) => re.test(attrs));
}

export function listDangerousControls(
  doc: Document,
): Array<{ id?: string; name?: string; text: string }> {
  const nodes = doc.querySelectorAll(
    'button, input[type="submit"], input[type="button"], a[role="button"], input[type="checkbox"], input[type="radio"]',
  );
  const out: Array<{ id?: string; name?: string; text: string }> = [];
  nodes.forEach((el) => {
    if (!isForbiddenControl(el)) return;
    out.push({
      id: el.id || undefined,
      name: el.getAttribute('name') || undefined,
      text: (el.textContent || el.getAttribute('value') || '').trim(),
    });
  });
  return out;
}

/** Runtime guard: adapters must never call click on forbidden controls. */
export function assertSafeMutationTarget(el: Element): void {
  if (isForbiddenControl(el)) {
    throw new Error(
      `Refusing to interact with forbidden control: ${el.id || el.getAttribute('name') || el.tagName}`,
    );
  }
}
