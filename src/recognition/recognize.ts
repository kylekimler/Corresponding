import { extractFieldFeatures } from './features';
import { detectAuthorGroups, groupsAreFillSafe } from './authorGroups';
import { proposeSemanticMappings } from './semantic';
import { mayFill } from './confidence';
import type { RecognitionReport } from './types';

/**
 * Platform-independent form inspection + semantic recognition.
 * Produces a dry-run mapping proposal with confidence and evidence.
 */
export function recognizeForm(doc: Document): RecognitionReport {
  const fields = extractFieldFeatures(doc);
  const authorGroups = detectAuthorGroups(fields);
  const proposals = proposeSemanticMappings(fields).map((p) => {
    const unresolved = p.unresolved || !mayFill(p.confidence);
    return { ...p, unresolved };
  });

  const notes: string[] = [
    'Field values are never used for classification.',
    'Low-confidence mappings remain unresolved and must not be filled.',
  ];

  // Single-group forms have trivial ordering; only block multi-group weak identity.
  if (
    authorGroups.length > 1 &&
    !groupsAreFillSafe(authorGroups)
  ) {
    notes.push(
      'Author group identity/order is not sufficiently confident for generic fill.',
    );
    for (const p of proposals) {
      if (p.source === 'semantic_label' || p.source === 'structural_guess') {
        p.unresolved = true;
        p.evidence = [...p.evidence, 'blocked:weak-author-groups'];
      }
    }
  }

  if (authorGroups.length === 0) {
    notes.push('No repeated author groups detected.');
  }

  const fillable = proposals.filter((p) => !p.unresolved && p.canonicalField !== 'unknown');
  const unresolved = proposals.filter(
    (p) => p.unresolved || p.canonicalField === 'unknown',
  );

  return {
    fields,
    proposals,
    authorGroups,
    fillable,
    unresolved,
    notes,
  };
}
