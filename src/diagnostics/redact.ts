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
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

export const ORCID_RE =
  /\b\d{4}-\d{4}-\d{4}-\d{3}[\dX]\b/gi;

export const CSRF_NAME_RE =
  /(csrf|xsrf|authenticity|__requestverificationtoken|anti[-_]?forgery)/i;

export const SECRET_NAME_RE =
  /(password|passwd|pwd|auth[_-]?token|access[_-]?token|bearer|session[_-]?id|api[_-]?key|cookie)/i;

export const MANUSCRIPT_ID_RE =
  /\b(ms|manuscript|article|paper)[-_ ]?(id|no|num|number)?[-_ ]?[:#]?\s*[a-z0-9]{6,}\b/gi;

const SECRET_INPUT_TYPES = new Set(['password', 'hidden']);

const FREE_TEXT_VALUE_CATEGORIES = new Set([
  'author',
  'email',
  'affiliation',
  'orcid',
  'other',
]);

/** Redact emails/ORCIDs/manuscript ids from free-text labels and options. */
export function redactFreeText(text: string): string {
  let safe = text;
  safe = safe.replace(EMAIL_RE, '[REDACTED_EMAIL]');
  safe = safe.replace(ORCID_RE, '[REDACTED_ORCID]');
  safe = safe.replace(MANUSCRIPT_ID_RE, '[REDACTED_MANUSCRIPT_ID]');
  // Person-like "First Last" pairs in labels/options (not generic UI words).
  safe = safe.replace(/\b[A-Z][a-z]{1,30} [A-Z][a-z]{1,30}\b/g, '[REDACTED_NAME]');
  return safe;
}

/** Heuristic: page titles that embed manuscript names/ids. */
export function redactPageTitle(title: string): string | undefined {
  if (!title.trim()) return undefined;
  let safe = redactFreeText(title.trim());
  // Portal titles often embed manuscript names after a separator.
  safe = safe.replace(/^(.*[|:/–—-]\s*).{8,}$/u, '$1[REDACTED_TITLE]');
  if (containsSensitiveValue(safe)) {
    return '[REDACTED_TITLE]';
  }
  return safe;
}

/** Strip query tokens, hash fragments, userinfo, and manuscript ids from URLs. */
export function redactUrl(url: string): string | undefined {
  if (!url.trim()) return undefined;
  try {
    const parsed = new URL(url);
    parsed.username = '';
    parsed.password = '';
    parsed.hash = '';
    const sensitiveParams =
      /^(token|csrf|xsrf|session|sid|auth|key|code|state|manuscript|msid|article|email|sessionthreadidfield)/i;
    for (const key of [...parsed.searchParams.keys()]) {
      if (sensitiveParams.test(key)) {
        parsed.searchParams.set(key, '[REDACTED]');
      }
    }
    let path = parsed.pathname.replace(/\/[a-f0-9]{16,}\b/gi, '/[REDACTED_ID]');
    path = path.replace(/\/(ms|manuscript|article)\/[^/]+/gi, '/$1/[REDACTED_ID]');
    parsed.pathname = path;
    return parsed
      .toString()
      .replace(
        /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
        '[REDACTED_ID]',
      )
      .replace(/%5BREDACTED%5D/gi, '[REDACTED]');
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
  EMAIL_RE.lastIndex = 0;
  ORCID_RE.lastIndex = 0;
  MANUSCRIPT_ID_RE.lastIndex = 0;
  if (EMAIL_RE.test(text)) return true;
  EMAIL_RE.lastIndex = 0;
  if (ORCID_RE.test(text)) return true;
  ORCID_RE.lastIndex = 0;
  if (MANUSCRIPT_ID_RE.test(text)) return true;
  MANUSCRIPT_ID_RE.lastIndex = 0;
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

/** Scan payload for common PII patterns (email, password-like tokens). */
export function assertNoLeakedPii(payload: string): void {
  EMAIL_RE.lastIndex = 0;
  if (EMAIL_RE.test(payload)) {
    throw new Error('PII leak: email-like string in diagnostic payload');
  }
  EMAIL_RE.lastIndex = 0;
  if (/hunter2|password\s*[:=]/i.test(payload)) {
    throw new Error('PII leak: password-like content in diagnostic payload');
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

/**
 * Fail-closed redaction gate: if export still looks sensitive, mark incomplete.
 */
export function evaluateRedactionComplete(exported: string): boolean {
  try {
    assertNoLeakedPii(exported);
    return true;
  } catch {
    return false;
  }
}
