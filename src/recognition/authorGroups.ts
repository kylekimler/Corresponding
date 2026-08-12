import type { AuthorGroup, FieldFeatures } from './types';
import { CONFIDENCE } from './confidence';

const INDEX_RE = /(?:^|[^a-z0-9])(\d{1,3})(?:[^a-z0-9]|$)/i;

function extractIndex(feature: FieldFeatures): number | undefined {
  const blob = [feature.id, feature.name].filter(Boolean).join(' ');
  // Prefer delimiter-bounded indices; also accept camelCase person1Given.
  const m =
    blob.match(INDEX_RE) ||
    blob.match(/(?:person|author|contrib|row)(\d{1,3})/i);
  if (!m) return undefined;
  const n = Number.parseInt(m[1]!, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function signature(feature: FieldFeatures): string {
  // Label-like signature only — unique id/name would prevent repeat detection.
  return [
    feature.label,
    feature.ariaLabel,
    feature.placeholder,
    feature.nearbyLabel,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .replace(/[_\-./]+/g, ' ')
    .replace(/\b\d+\b/g, '#')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Infer repeated author blocks from numbered IDs/names, fieldsets, or
 * repeated structural signatures. Does not fill — only structure.
 */
export function detectAuthorGroups(features: FieldFeatures[]): AuthorGroup[] {
  const numbered = new Map<number, FieldFeatures[]>();
  for (const f of features) {
    const idx = extractIndex(f);
    if (idx === undefined) continue;
    // Ignore global counters like num_authors unless they look author-scoped.
    const looksAuthor =
      /auth|author|contrib|investigator|affili|person|given|family/i.test(
        [f.id, f.name, f.label, f.ariaLabel, f.nearbyLabel]
          .filter(Boolean)
          .join(' '),
      );
    if (!looksAuthor) continue;
    const list = numbered.get(idx) ?? [];
    list.push(f);
    numbered.set(idx, list);
  }

  if (numbered.size >= 1) {
    const groups: AuthorGroup[] = [];
    for (const [index, fields] of [...numbered.entries()].sort(
      (a, b) => a[0] - b[0],
    )) {
      for (const f of fields) f.groupIndex = index;
      groups.push({
        index,
        elementKeys: fields.map((f) => f.elementKey),
        evidence: [
          `numbered-id-or-name:${index}`,
          `field-count:${fields.length}`,
        ],
        confidence:
          fields.length >= 3
            ? CONFIDENCE.platformPattern
            : CONFIDENCE.semanticLabelClear,
        pattern: 'numbered_id',
      });
    }
    return groups;
  }

  // Fallback: cluster by repeated label signatures across siblings.
  const sigCounts = new Map<string, FieldFeatures[]>();
  for (const f of features) {
    const sig = signature(f);
    if (!sig) continue;
    const list = sigCounts.get(sig) ?? [];
    list.push(f);
    sigCounts.set(sig, list);
  }
  const repeating = [...sigCounts.values()].filter((v) => v.length >= 2);
  if (repeating.length >= 2) {
    // Build groups by ordinal position among repeating signatures.
    const width = repeating[0]!.length;
    const groups: AuthorGroup[] = [];
    for (let i = 0; i < width; i += 1) {
      const keys: string[] = [];
      for (const series of repeating) {
        const f = series[i];
        if (!f) continue;
        f.groupIndex = i + 1;
        keys.push(f.elementKey);
      }
      if (keys.length >= 2) {
        groups.push({
          index: i + 1,
          elementKeys: keys,
          evidence: ['repeated-subtree-signature', `fields:${keys.length}`],
          confidence: CONFIDENCE.semanticLabelAmbiguous + 0.2,
          pattern: 'repeated_subtree',
        });
      }
    }
    return groups;
  }

  // Single anonymous group if we have name-like fields.
  const nameLike = features.filter((f) =>
    /name|email|orcid|institution|affili/i.test(f.normalizedText),
  );
  if (nameLike.length >= 2) {
    for (const f of nameLike) f.groupIndex = 1;
    return [
      {
        index: 1,
        elementKeys: nameLike.map((f) => f.elementKey),
        evidence: ['single-block-heuristic'],
        confidence: CONFIDENCE.structuralGuess + 0.2,
        pattern: 'unknown',
      },
    ];
  }

  return [];
}

export function groupsAreFillSafe(groups: AuthorGroup[]): boolean {
  if (groups.length === 0) return false;
  return groups.every((g) => g.confidence >= CONFIDENCE.fillThreshold);
}
