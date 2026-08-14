import { biorxivAdapter } from './biorxiv/adapter';
import { natureMtsAdapter } from './nature-mts/adapter';
import { scholarOneAdapter } from './scholarone/adapter';
import {
  eJournalPressGenericStub,
  editorialManagerStub,
} from './stubs';
import type {
  AdapterRegistry,
  DetectResult,
  PlatformAdapter,
  PlatformId,
} from './types';

const adapters: PlatformAdapter[] = [
  biorxivAdapter,
  natureMtsAdapter,
  scholarOneAdapter,
  eJournalPressGenericStub,
  editorialManagerStub,
];

export function createAdapterRegistry(
  list: PlatformAdapter[] = adapters,
): AdapterRegistry {
  const byId = new Map(list.map((a) => [a.id, a]));

  return {
    list: () => [...list],
    get: (id: PlatformId) => byId.get(id),
    require: (id: PlatformId) => {
      const a = byId.get(id);
      if (!a) throw new Error(`Unknown adapter: ${id}`);
      return a;
    },
    detect(doc: Document): DetectResult {
      const results = list
        .map((a) => a.detect(doc))
        .sort((a, b) => b.confidence - a.confidence);

      const best = results[0];
      if (!best || best.confidence < 0.5) {
        return {
          platformId: 'unknown',
          confidence: best?.confidence ?? 0,
          label: 'Unsupported or unknown platform',
          evidence: best?.evidence ?? [],
        };
      }
      return best;
    },
  };
}

export const defaultRegistry = createAdapterRegistry();
