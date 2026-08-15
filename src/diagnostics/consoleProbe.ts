/**
 * Self-contained console snippet for live portal diagnostics.
 * Structural metadata only — never reads field values, cookies, or storage.
 */

export const STRUCTURAL_FRAME_PROBE = String.raw`(() => {
  const SECRET = /(password|passwd|pwd|auth[_-]?token|access[_-]?token|csrf|session|cookie)/i;
  const EMAIL = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const ORCID = /\b\d{4}-\d{4}-\d{4}-\d{3}[\dX]\b/gi;
  const redact = (value) =>
    String(value || '')
      .replace(EMAIL, '[REDACTED_EMAIL]')
      .replace(ORCID, '[REDACTED_ORCID]')
      .replace(/\b[A-Z][a-z]{1,30} [A-Z][a-z]{1,30}\b/g, '[REDACTED_NAME]')
      .replace(
        /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
        '[REDACTED_ID]',
      );
  const norm = (value) => String(value || '').replace(/\d+/g, '#');
  const omit = (el) => {
    const type = String(el.type || '').toLowerCase();
    const blob = [el.id, el.getAttribute('name'), type].join(' ');
    return type === 'password' || type === 'hidden' || SECRET.test(blob);
  };
  const labelFor = (el) => {
    try {
      if (el.id && el.ownerDocument) {
        const lab = el.ownerDocument.querySelector(
          'label[for="' + CSS.escape(el.id) + '"]',
        );
        if (lab && lab.textContent) return lab.textContent.trim().slice(0, 80);
      }
    } catch (e) {}
    return (el.getAttribute('aria-label') || el.placeholder || '').slice(0, 80);
  };
  const scanDoc = (doc, where) => {
    const fields = Array.from(doc.querySelectorAll('input, select, textarea'))
      .filter((el) => !omit(el))
      .map((el) =>
        [
          el.tagName.toLowerCase(),
          el.type ? 'type=' + el.type : null,
          el.id ? 'id=' + norm(el.id) : null,
          el.getAttribute('name') ? 'name=' + norm(el.getAttribute('name')) : null,
          labelFor(el) ? 'label=' + JSON.stringify(redact(labelFor(el))) : null,
        ]
          .filter(Boolean)
          .join(' | '),
      );
    const buttons = Array.from(
      doc.querySelectorAll(
        'button, [role="button"], input[type="button"], input[type="submit"]',
      ),
    )
      .slice(0, 40)
      .map((el) => {
        const raw = (
          el.getAttribute('aria-label') ||
          el.textContent ||
          (el.tagName === 'INPUT' ? el.getAttribute('value') : '') ||
          ''
        )
          .trim()
          .slice(0, 60);
        return [
          el.tagName.toLowerCase(),
          el.id ? 'id=' + norm(el.id) : null,
          raw ? 'action=' + JSON.stringify(redact(raw)) : null,
        ]
          .filter(Boolean)
          .join(' | ');
      });
    return {
      where: redact(where),
      title: redact(doc.title || ''),
      fieldCount: fields.length,
      fields: fields,
      buttons: buttons,
    };
  };
  const frames = [];
  const seen = new Set();
  const walk = (doc, depth, where) => {
    if (!doc || seen.has(doc) || depth > 6) return;
    seen.add(doc);
    frames.push(scanDoc(doc, where + ' depth=' + depth));
    Array.from(doc.querySelectorAll('iframe, frame')).forEach((el) => {
      const src = el.getAttribute('src') || el.src || '';
      try {
        const child = el.contentDocument;
        if (!child) {
          frames.push({
            where: 'blocked src=' + redact(src) + ' depth=' + (depth + 1),
            readable: false,
          });
          return;
        }
        walk(child, depth + 1, src || 'about:blank');
      } catch (e) {
        frames.push({
          where: 'blocked src=' + redact(src) + ' depth=' + (depth + 1),
          readable: false,
        });
      }
    });
  };
  walk(document, 0, location.href);
  const lines = [
    '# Corresponding console frame probe',
    'values: omitted',
    'windowName: ' + redact(window.name || ''),
    'frameElement: ' + (window.frameElement ? 'nested' : 'top-or-popup'),
    '',
  ];
  frames.forEach((frame) => {
    if (frame.readable === false) {
      lines.push('## ' + frame.where + ' [UNREADABLE]');
      lines.push('');
      return;
    }
    lines.push('## ' + frame.where);
    lines.push('titleSafe: ' + frame.title);
    lines.push('fieldCount: ' + frame.fieldCount);
    lines.push((frame.fields || []).join('\n') || '(no fields)');
    lines.push('-- controls --');
    lines.push((frame.buttons || []).join('\n') || '(no controls)');
    lines.push('');
  });
  const text = lines.join('\n');
  if (typeof copy === 'function') copy(text);
  console.log(text);
  return text;
})();`;

export function looksLikeSafeStructuralProbe(source: string): boolean {
  const lower = source.toLowerCase();
  if (lower.includes('document.cookie')) return false;
  if (lower.includes('localstorage')) return false;
  if (lower.includes('sessionstorage')) return false;
  if (lower.includes('.value')) return false;
  return (
    source.includes('input, select, textarea') &&
    source.includes('[UNREADABLE]')
  );
}
