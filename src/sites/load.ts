import type { PlatformAdapter } from '@/adapters/types';
import { createSiteAdapter } from './engine';
import { parseSiteDefinition, type SiteDefinition } from './schema';

const siteModules = import.meta.glob('../../sites/*.json', {
  eager: true,
  import: 'default',
});

function fileName(path: string): string {
  return path.split('/').pop() ?? path;
}

export function loadSiteDefinitions(): SiteDefinition[] {
  const definitions: SiteDefinition[] = [];
  for (const [path, raw] of Object.entries(siteModules)) {
    if (fileName(path).startsWith('_')) continue;
    definitions.push(parseSiteDefinition(raw));
  }
  return definitions.sort((a, b) => a.id.localeCompare(b.id));
}

export function loadSiteAdapters(): PlatformAdapter[] {
  return loadSiteDefinitions().map(createSiteAdapter);
}

const adaptersById = new Map(
  loadSiteAdapters().map((adapter) => [adapter.id, adapter]),
);

export function getSiteAdapter(id: string): PlatformAdapter {
  const adapter = adaptersById.get(id);
  if (!adapter) throw new Error(`Unknown site adapter: ${id}`);
  return adapter;
}
