import { matchSelectOption } from '../dom';

// PLOS Genetics live dropdown, 2026-09-11: "UNITED STATES OF AMERICA"
// and "UNITED STATES MINOR OUTLYING ISLANDS" are distinct options.
// Resolve this known alias by exact labels/codes, never by a first substring hit.
const US_ALIASES = new Set(['us', 'usa', 'united states', 'united states of america']);
const normalize = (value: string) => value.trim().toLowerCase();

export function matchEditorialManagerCountry(
  select: HTMLSelectElement,
  desired: string,
): string | null {
  if (!US_ALIASES.has(normalize(desired))) return matchSelectOption(select, desired);
  const matches = Array.from(select.options).filter((option) =>
    Boolean(option.value) && !option.disabled && !option.closest('optgroup')?.disabled &&
    (US_ALIASES.has(normalize(option.text)) || US_ALIASES.has(normalize(option.value))),
  );
  return matches.length === 1 ? matches[0]!.value : null;
}
