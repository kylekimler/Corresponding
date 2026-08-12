/**
 * Controls that must never be clicked or submitted by the extension.
 * Matching is case-insensitive against id, name, value, and visible text.
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
  /\be-?sign/i,
  /\breviewer\s*invit/i,
  /\bagree\b/i,
  /\battest/i,
];

export function isForbiddenControl(el: Element): boolean {
  const attrs = [
    el.id,
    el.getAttribute('name') ?? '',
    el.getAttribute('value') ?? '',
    el.getAttribute('aria-label') ?? '',
    el.textContent?.trim() ?? '',
  ]
    .join(' ')
    .toLowerCase();

  if (!attrs.trim()) return false;
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
