import { CONFIDENCE, mayFill, type MappingSource } from './confidence';
import type {
  CanonicalField,
  FieldFeatures,
  FieldMappingProposal,
} from './types';

interface Rule {
  field: CanonicalField;
  /** Exact token/phrase matches in normalized structural text. */
  exact: string[];
  /** Weaker contains matches — lower confidence if only these hit. */
  soft?: string[];
  /** Prefer these input types when present. */
  preferTypes?: string[];
}

const RULES: Rule[] = [
  {
    field: 'orcid',
    exact: ['orcid', 'orcid id', 'orcid i d'],
    soft: ['orcid'],
  },
  {
    field: 'email',
    exact: ['email', 'e mail', 'email address'],
    soft: ['mail'],
    preferTypes: ['email', 'text'],
  },
  {
    field: 'givenName',
    exact: [
      'first name',
      'firstname',
      'given name',
      'givenname',
      'first nm',
      'auth first',
      'author first',
    ],
    soft: ['given', 'first'],
  },
  {
    field: 'middleName',
    exact: ['middle name', 'middlename', 'middle nm', 'middle initial'],
    soft: ['middle'],
  },
  {
    field: 'familyName',
    exact: [
      'last name',
      'lastname',
      'family name',
      'familyname',
      'surname',
      'last nm',
      'auth last',
      'author last',
    ],
    soft: ['family', 'surname', 'last'],
  },
  {
    field: 'institution',
    exact: [
      'institution',
      'organization',
      'organisation',
      'affiliation',
      'university',
      'org',
    ],
    soft: ['affili', 'institute'],
  },
  {
    field: 'department',
    exact: ['department', 'dept', 'division', 'school'],
    soft: ['dept'],
  },
  {
    field: 'city',
    exact: ['city', 'town'],
    soft: ['city'],
  },
  {
    field: 'state',
    exact: ['state', 'province', 'region', 'state region'],
    soft: ['province'],
  },
  {
    field: 'country',
    exact: ['country', 'nation'],
    soft: ['country'],
  },
  {
    field: 'sequence',
    exact: ['author sequence', 'author order', 'author seq', 'sequence'],
    soft: ['seq', 'order'],
  },
  {
    field: 'corresponding',
    exact: ['corresponding author', 'corresponding', 'corr auth'],
    soft: ['corr'],
  },
];

function scoreFeature(feature: FieldFeatures, rule: Rule): {
  confidence: number;
  evidence: string[];
  source: MappingSource;
} | null {
  const text = feature.normalizedText;
  if (!text) return null;

  const evidence: string[] = [];
  for (const phrase of rule.exact) {
    if (text.includes(phrase)) {
      evidence.push(`exact:${phrase}`);
    }
  }
  if (evidence.length > 0) {
    let confidence = CONFIDENCE.semanticLabelClear;
    if (
      rule.preferTypes?.length &&
      feature.inputType &&
      !rule.preferTypes.includes(feature.inputType)
    ) {
      confidence -= 0.05;
      evidence.push(`type-mismatch:${feature.inputType}`);
    }
    // Country selects with many options get a small boost.
    if (
      rule.field === 'country' &&
      feature.tag === 'select' &&
      (feature.optionLabels?.length ?? 0) >= 5
    ) {
      confidence = Math.min(1, confidence + 0.05);
      evidence.push('select-options:country-like');
    }
    return {
      confidence,
      evidence,
      source: 'semantic_label',
    };
  }

  const softHits: string[] = [];
  for (const phrase of rule.soft ?? []) {
    // Soft tokens must be whole-ish words to avoid "email" matching "female".
    const re = new RegExp(`(?:^|\\s)${phrase}(?:\\s|$)`);
    if (re.test(text)) softHits.push(phrase);
  }
  if (softHits.length === 1 && text.split(' ').length <= 4) {
    return {
      confidence: CONFIDENCE.semanticLabelAmbiguous,
      evidence: softHits.map((s) => `soft:${s}`),
      source: 'semantic_label',
    };
  }
  if (softHits.length >= 2) {
    return {
      confidence: CONFIDENCE.semanticLabelAmbiguous + 0.1,
      evidence: softHits.map((s) => `soft:${s}`),
      source: 'semantic_label',
    };
  }
  return null;
}

/**
 * Deterministic semantic recognition. Never uses field values.
 * Low-confidence mappings are marked unresolved and must not be filled.
 */
export function proposeSemanticMappings(
  features: FieldFeatures[],
): FieldMappingProposal[] {
  const proposals: FieldMappingProposal[] = [];

  for (const feature of features) {
    if (feature.disabled) continue;

    let best: FieldMappingProposal | null = null;

    for (const rule of RULES) {
      const hit = scoreFeature(feature, rule);
      if (!hit) continue;
      const proposal: FieldMappingProposal = {
        elementKey: feature.elementKey,
        canonicalField: rule.field,
        confidence: hit.confidence,
        evidence: hit.evidence,
        source: hit.source,
        authorGroupIndex: feature.groupIndex,
        unresolved: !mayFill(hit.confidence),
      };
      if (!best || proposal.confidence > best.confidence) {
        best = proposal;
      }
    }

    if (best) {
      proposals.push(best);
    } else {
      proposals.push({
        elementKey: feature.elementKey,
        canonicalField: 'unknown',
        confidence: 0,
        evidence: ['no-semantic-match'],
        source: 'structural_guess',
        authorGroupIndex: feature.groupIndex,
        unresolved: true,
      });
    }
  }

  // Resolve collisions: same canonical field + same group → keep highest confidence.
  const bySlot = new Map<string, FieldMappingProposal>();
  for (const p of proposals) {
    if (p.canonicalField === 'unknown') {
      bySlot.set(`${p.elementKey}`, p);
      continue;
    }
    const slot = `${p.authorGroupIndex ?? 'g'}:${p.canonicalField}:${p.elementKey}`;
    const existing = bySlot.get(slot);
    if (!existing || p.confidence > existing.confidence) {
      bySlot.set(slot, p);
    }
  }

  // Downgrade duplicate canonical fields within a group (ambiguous).
  const groupFieldCounts = new Map<string, FieldMappingProposal[]>();
  for (const p of bySlot.values()) {
    if (p.canonicalField === 'unknown') continue;
    const k = `${p.authorGroupIndex ?? 'nogroup'}:${p.canonicalField}`;
    const list = groupFieldCounts.get(k) ?? [];
    list.push(p);
    groupFieldCounts.set(k, list);
  }
  for (const list of groupFieldCounts.values()) {
    if (list.length <= 1) continue;
    list.sort((a, b) => b.confidence - a.confidence);
    for (const loser of list.slice(1)) {
      loser.confidence = Math.min(
        loser.confidence,
        CONFIDENCE.semanticLabelAmbiguous,
      );
      loser.unresolved = true;
      loser.evidence = [...loser.evidence, 'collision:duplicate-in-group'];
    }
  }

  return [...bySlot.values()];
}
