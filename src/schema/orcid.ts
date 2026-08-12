/**
 * Normalize ORCID iDs to the canonical dashed form when recognizable.
 * Returns undefined for empty input; returns original trimmed string if not parseable.
 */
export function normalizeOrcid(raw: string | undefined | null): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;

  const lower = trimmed.toLowerCase().replace(/^https?:\/\/orcid\.org\//, '');
  const digits = lower.replace(/-/g, '');
  if (!/^\d{15}[\dX]$/i.test(digits)) {
    return trimmed;
  }
  const d = digits.toUpperCase();
  return `${d.slice(0, 4)}-${d.slice(4, 8)}-${d.slice(8, 12)}-${d.slice(12, 16)}`;
}
