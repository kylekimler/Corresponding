import { defaultRegistry } from '@/adapters/registry';
import type { AdapterRegistry, DetectResult, PlatformId } from '@/adapters/types';
import { normalizeIdPattern, normalizeNamePattern } from '@/diagnostics/redact';
import { recognizeForm } from '@/recognition/recognize';
import type { CanonicalField, FieldMappingProposal } from '@/recognition/types';
import type { FixtureCorpusEntry } from './corpus';
import { loadFixtureCorpus } from './loadCorpus';

export interface AdapterReplayResult {
  adapterId: PlatformId;
  detect: DetectResult;
  inspectAuthorSlots: number;
  isExpectedPlatform: boolean;
}

export interface MappingReplayResult {
  idPattern?: string;
  namePattern?: string;
  expected: CanonicalField;
  actual?: CanonicalField;
  confidence?: number;
  unresolved?: boolean;
  pass: boolean;
}

export interface FixtureReplayResult {
  fixtureId: string;
  platformFamily: string;
  detection: {
    expected: PlatformId | 'unknown';
    actual: PlatformId;
    confidence: number;
    pass: boolean;
  };
  mappings: {
    expected: number;
    passed: number;
    failed: number;
    details: MappingReplayResult[];
  };
  unsupported: {
    expected: string[];
    matched: string[];
    pass: boolean;
  };
  adapters: AdapterReplayResult[];
  recognitionNotes: string[];
}

export interface FixtureReplayReport {
  generatedAt: string;
  summary: {
    fixtureCount: number;
    adapterCount: number;
    totalAdapterRuns: number;
    detectionPassRate: number;
    mappingPassRate: number;
    unsupportedPassRate: number;
  };
  fixtures: FixtureReplayResult[];
}

function mountFixtureHtml(doc: Document, html: string): void {
  doc.body.innerHTML = html;
}

function fieldKeyFromProposal(
  p: FieldMappingProposal,
  fields: ReturnType<typeof recognizeForm>['fields'],
): { idPattern?: string; namePattern?: string } {
  const feat = fields.find((f) => f.elementKey === p.elementKey);
  return {
    idPattern: feat?.id ? normalizeIdPattern(feat.id) : undefined,
    namePattern: feat?.name ? normalizeNamePattern(feat.name) : undefined,
  };
}

function findProposal(
  proposals: FieldMappingProposal[],
  fields: ReturnType<typeof recognizeForm>['fields'],
  expected: FixtureCorpusEntry['expectedMappings'][number],
): FieldMappingProposal | undefined {
  return proposals.find((p) => {
    const keys = fieldKeyFromProposal(p, fields);
    if (expected.idPattern && keys.idPattern !== expected.idPattern) return false;
    if (expected.namePattern && keys.namePattern !== expected.namePattern) {
      return false;
    }
    if (expected.authorGroupIndex !== undefined) {
      if (p.authorGroupIndex !== expected.authorGroupIndex) return false;
    }
    return true;
  });
}

function evaluateUnsupported(
  recognition: ReturnType<typeof recognizeForm>,
  expectedPatterns: string[],
): { matched: string[]; pass: boolean } {
  const unresolvedKeys = recognition.unresolved.map((p) => {
    const feat = recognition.fields.find((f) => f.elementKey === p.elementKey);
    return {
      idPattern: feat?.id ? normalizeIdPattern(feat.id) : undefined,
      namePattern: feat?.name ? normalizeNamePattern(feat.name) : undefined,
    };
  });

  const matched: string[] = [];
  for (const pattern of expectedPatterns) {
    const hit = unresolvedKeys.some(
      (k) => k.idPattern === pattern || k.namePattern === pattern,
    );
    if (hit) matched.push(pattern);
  }

  const pass =
    expectedPatterns.length === 0 ||
    matched.length === expectedPatterns.length;
  return { matched, pass };
}

export function replayFixture(
  fixture: FixtureCorpusEntry,
  doc: Document,
  registry: AdapterRegistry = defaultRegistry,
): FixtureReplayResult {
  mountFixtureHtml(doc, fixture.sanitizedHtml);

  const registryDetect = registry.detect(doc);
  const recognition = recognizeForm(doc);
  const adapters = registry.list().map((adapter) => {
    const detect = adapter.detect(doc);
    const inspect = adapter.inspect(doc);
    return {
      adapterId: adapter.id,
      detect,
      inspectAuthorSlots: inspect.authorSlots,
      isExpectedPlatform: detect.platformId === fixture.expectedDetection.platformId,
    };
  });

  const minConfidence = fixture.expectedDetection.minConfidence ?? 0;
  const detectionPass =
    registryDetect.platformId === fixture.expectedDetection.platformId &&
    registryDetect.confidence >= minConfidence;

  const mappingDetails: MappingReplayResult[] = fixture.expectedMappings.map(
    (exp) => {
      const proposal = findProposal(
        recognition.proposals,
        recognition.fields,
        exp,
      );
      const min = exp.minConfidence ?? 0.4;
      const pass =
        !!proposal &&
        proposal.canonicalField === exp.canonicalField &&
        proposal.confidence >= min &&
        !proposal.unresolved;

      return {
        idPattern: exp.idPattern,
        namePattern: exp.namePattern,
        expected: exp.canonicalField,
        actual: proposal?.canonicalField,
        confidence: proposal?.confidence,
        unresolved: proposal?.unresolved,
        pass,
      };
    },
  );

  const mappingPassed = mappingDetails.filter((d) => d.pass).length;
  const unsupported = evaluateUnsupported(
    recognition,
    fixture.expectedUnsupportedFields ?? [],
  );

  return {
    fixtureId: fixture.id,
    platformFamily: fixture.platformFamily,
    detection: {
      expected: fixture.expectedDetection.platformId,
      actual: registryDetect.platformId,
      confidence: registryDetect.confidence,
      pass: detectionPass,
    },
    mappings: {
      expected: fixture.expectedMappings.length,
      passed: mappingPassed,
      failed: fixture.expectedMappings.length - mappingPassed,
      details: mappingDetails,
    },
    unsupported: {
      expected: fixture.expectedUnsupportedFields ?? [],
      ...unsupported,
    },
    adapters,
    recognitionNotes: recognition.notes,
  };
}

export function replayAllFixtures(
  fixtures: FixtureCorpusEntry[] = loadFixtureCorpus(),
  doc: Document = document,
  registry: AdapterRegistry = defaultRegistry,
): FixtureReplayReport {
  const results = fixtures.map((f) => replayFixture(f, doc, registry));
  const adapterCount = registry.list().length;
  const detectionPasses = results.filter((r) => r.detection.pass).length;
  const mappingTotals = results.reduce(
    (acc, r) => ({
      expected: acc.expected + r.mappings.expected,
      passed: acc.passed + r.mappings.passed,
    }),
    { expected: 0, passed: 0 },
  );
  const unsupportedPasses = results.filter((r) => r.unsupported.pass).length;

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      fixtureCount: results.length,
      adapterCount,
      totalAdapterRuns: results.length * adapterCount,
      detectionPassRate:
        results.length === 0 ? 0 : detectionPasses / results.length,
      mappingPassRate:
        mappingTotals.expected === 0
          ? 1
          : mappingTotals.passed / mappingTotals.expected,
      unsupportedPassRate:
        results.length === 0 ? 0 : unsupportedPasses / results.length,
    },
    fixtures: results,
  };
}

export interface FixtureReplayCaseResult {
  id: string;
  platformFamily: string;
  detectionOk: boolean;
  mappingHits: number;
  mappingMisses: number;
  notes: string[];
}

export interface FixtureReplaySummary {
  generatedAt: string;
  total: number;
  detectionPass: number;
  mappingPass: number;
  cases: FixtureReplayCaseResult[];
}

export function replayCorpus(
  fixtures: FixtureCorpusEntry[],
  doc: Document = document,
  registry: AdapterRegistry = defaultRegistry,
): FixtureReplaySummary {
  const cases: FixtureReplayCaseResult[] = fixtures.map((fixture) => {
    const result = replayFixture(fixture, doc, registry);
    return {
      id: result.fixtureId,
      platformFamily: result.platformFamily,
      detectionOk: result.detection.pass,
      mappingHits: result.mappings.passed,
      mappingMisses: result.mappings.failed,
      notes: result.recognitionNotes,
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    total: cases.length,
    detectionPass: cases.filter((c) => c.detectionOk).length,
    mappingPass: cases.filter((c) => c.mappingMisses === 0).length,
    cases,
  };
}
