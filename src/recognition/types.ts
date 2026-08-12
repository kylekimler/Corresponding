import type { MappingSource } from './confidence';

/** Canonical fields the recognizer can propose. */
export type CanonicalField =
  | 'givenName'
  | 'middleName'
  | 'familyName'
  | 'email'
  | 'institution'
  | 'department'
  | 'city'
  | 'state'
  | 'country'
  | 'orcid'
  | 'sequence'
  | 'corresponding'
  | 'unknown';

export interface FieldFeatures {
  elementKey: string;
  tag: string;
  inputType?: string;
  id?: string;
  name?: string;
  label?: string;
  ariaLabel?: string;
  placeholder?: string;
  nearbyLabel?: string;
  optionLabels?: string[];
  required: boolean;
  disabled: boolean;
  hidden: boolean;
  groupKey?: string;
  groupIndex?: number;
  /** Normalized blob of structural text features (never field values). */
  normalizedText: string;
}

export interface FieldMappingProposal {
  elementKey: string;
  canonicalField: CanonicalField;
  confidence: number;
  evidence: string[];
  source: MappingSource;
  authorGroupIndex?: number;
  unresolved: boolean;
}

export interface AuthorGroup {
  index: number;
  elementKeys: string[];
  evidence: string[];
  confidence: number;
  pattern: 'numbered_id' | 'numbered_name' | 'fieldset' | 'repeated_subtree' | 'table_row' | 'unknown';
}

export interface RecognitionReport {
  fields: FieldFeatures[];
  proposals: FieldMappingProposal[];
  authorGroups: AuthorGroup[];
  fillable: FieldMappingProposal[];
  unresolved: FieldMappingProposal[];
  notes: string[];
}
