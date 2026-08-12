/**
 * Redaction helpers for compatibility captures.
 * Structural identifiers are normalized; sensitive values are never exported.
 */

/** Replace digit runs in ids/names with # for safe structural patterns. */
export function normalizeIdPattern(value: string): string {
  return value.replace(/\d+/g, '#');
}

/** Alias for name attributes — same normalization as ids. */
export function normalizeNamePattern(value: string): string {
  return normalizeIdPattern(value);
}

export const EMAIL_RE =
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

export const ORCID_RE =
  /\b\d{4}-\d{4}-\d{4}-\d{3}[\dX]\b/i;

export const CSRF_NAME_RE =
  /(csrf|xsrf|authenticity|__requestverificationtoken|anti[-_]?forgery)/i;

export const SECRET_NAME_RE =
  /(password|passwd|pwd|auth[_-]?token|access[_-]?token|bearer|session[_-]?id|api[_-]?key|cookie)/i;

export const MANUSCRIPT_ID_RE =
  /\b(ms|manuscript|article|paper)[-_ ]?(id|no|num|number)?[-_ ]?[:#]?\s*[a-z0-9]{6,}\b/i;

const SECRET_INPUT_TYPES = new Set(['password', 'hidden']);

const FREE_TEXT_VALUE_CATEGORIES = new Set([
  'author',
  'email',
  'affiliation',
  'orcid',
  'other',
]);

/** Heuristic: page titles that embed manuscript names/ids. */
export function redactPageTitle(title: string): string | undefined {
  if (!title.trim()) return undefined;
  let safe = title.trim();
  safe = safe.replace(EMAIL_RE, '[REDACTED_EMAIL]');
  safe = safe.replace(ORCID_RE, '[REDACTED_ORCID]');
  safe = safe.replace(MANUSCRIPT_ID_RE, '[REDACTED_MANUSCRIPT_ID]');
  // Portal titles often embed manuscript names after a separator.
  safe = safe.replace(/^(.*[|:/–—-]\s*).{8,}$/u, '$1[REDACTED_TITLE]');
  if (containsSensitiveValue(safe)) {
    return '[REDACTED_TITLE]';
  }
  return safe;
}

/** Strip query tokens, session ids, and manuscript ids from URLs. */
export function redactUrl(url: string): string | undefined {
  if (!url.trim()) return undefined;
  try {
    const parsed = new URL(url);
    const sensitiveParams =
      /^(token|csrf|xsrf|session|sid|auth|key|code|state|manuscript|msid|article)/i;
    for (const key of [...parsed.searchParams.keys()]) {
      if (sensitiveParams.test(key)) {
        parsed.searchParams.set(key, '[REDACTED]');
      }
    }
    let path = parsed.pathname.replace(/\/[a-f0-9]{16,}\b/gi, '/[REDACTED_ID]');
    path = path.replace(/\/(ms|manuscript|article)\/[^/]+/gi, '/$1/[REDACTED_ID]');
    parsed.pathname = path;
    return parsed.toString();
  } catch {
    return '[REDACTED_URL]';
  }
}

export function isSecretFieldName(nameOrId: string | undefined): boolean {
  if (!nameOrId) return false;
  return SECRET_NAME_RE.test(nameOrId) || CSRF_NAME_RE.test(nameOrId);
}

export function isSecretInputType(type: string | undefined): boolean {
  if (!type) return false;
  return SECRET_INPUT_TYPES.has(type.toLowerCase());
}

export function shouldOmitFieldFromCapture(
  el: Element,
  label?: string,
): boolean {
  const type =
    el instanceof HTMLInputElement ? (el.type || 'text').toLowerCase() : undefined;
  const id = el.id || '';
  const name = el.getAttribute('name') || '';
  const blob = [id, name, label].filter(Boolean).join(' ');

  if (isSecretInputType(type)) return true;
  if (isSecretFieldName(id) || isSecretFieldName(name)) return true;
  if (CSRF_NAME_RE.test(blob)) return true;

  if (type === 'hidden') {
    if (
      /(pid|token|csrf|auth|session|cookie|nonce)/i.test(blob) ||
      (el instanceof HTMLInputElement && EMAIL_RE.test(el.value))
    ) {
      return true;
    }
  }
  return false;
}

/** Returns true when a string likely contains user-provided PII or secrets. */
export function containsSensitiveValue(text: string): boolean {
  if (!text) return false;
  if (EMAIL_RE.test(text)) return true;
  if (ORCID_RE.test(text)) return true;
  if (MANUSCRIPT_ID_RE.test(text)) return true;
  if (/^[A-Za-z0-9+/=_-]{32,}$/.test(text.trim())) return true;
  return false;
}

/** Scan exported text for planted secrets (used by tests). */
export function findLeakedSecrets(
  exported: string,
  planted: string[],
): string[] {
  const leaks: string[] = [];
  for (const secret of planted) {
    if (!secret) continue;
    if (exported.includes(secret)) leaks.push(secret);
  }
  return leaks;
}

/** Assert capture export contains no planted PII (throws in tests). */
export function assertNoLeakedSecrets(
  exported: string,
  planted: string[],
): void {
  const leaks = findLeakedSecrets(exported, planted);
  if (leaks.length > 0) {
    throw new Error(`PII leak detected: ${leaks.join(', ')}`);
  }
}

export function redactFieldValue(
  category: string,
  rawValue: string,
): undefined {
  void category;
  void rawValue;
  return undefined;
}

export function valueLooksLikeFreeTextPii(value: string): boolean {
  if (!value.trim()) return false;
  if (containsSensitiveValue(value)) return true;
  if (FREE_TEXT_VALUE_CATEGORIES.has('other') && value.trim().length > 2) {
    // Names and titles: multiple words with capitals, or long free text.
    if (/\b[A-Z][a-z]+ [A-Z][a-z]+\b/.test(value)) return true;
    if (value.trim().length >= 24 && /\s/.test(value)) return true;
  }
  return false;
}
