import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { isAllowedManifestContentScriptMatch } from '../../src/autofill/hosts';
import { isFirstPartyWebsiteMatch } from '../../src/messaging/websiteHandshake';

export const E2E_EXTENSION_PATH = path.resolve('.wxt/playwright-extension');
const PRODUCTION_EXTENSION_PATH = path.resolve('.output/chrome-mv3');
const REQUIRED_PERMISSIONS = ['activeTab', 'scripting', 'storage'];

type Manifest = {
  name?: string;
  permissions?: string[];
  host_permissions?: string[];
  content_scripts?: Array<{ matches?: string[] }>;
};

export default async function globalSetup(): Promise<void> {
  const manifestPath = path.join(PRODUCTION_EXTENSION_PATH, 'manifest.json');
  const manifest = JSON.parse(
    await readFile(manifestPath, 'utf8'),
  ) as Manifest;
  const actualPermissions = [...(manifest.permissions ?? [])].sort();

  if (
    actualPermissions.length !== REQUIRED_PERMISSIONS.length ||
    actualPermissions.some(
      (permission, index) => permission !== REQUIRED_PERMISSIONS[index],
    )
  ) {
    throw new Error(
      `Production permissions changed: ${actualPermissions.join(', ')}`,
    );
  }
  if ((manifest.host_permissions?.length ?? 0) > 0) {
    throw new Error('Production manifest must not contain host permissions');
  }
  const websiteScripts = manifest.content_scripts ?? [];
  if (websiteScripts.length === 0) {
    throw new Error(
      'Production manifest must include the corresponding.app handshake content script',
    );
  }
  const hasWebsiteHandshake = websiteScripts.some((script) =>
    (script.matches ?? []).some((match) => isFirstPartyWebsiteMatch(match)),
  );
  if (!hasWebsiteHandshake) {
    throw new Error(
      'Production manifest must include the corresponding.app handshake content script',
    );
  }
  for (const script of websiteScripts) {
    const matches = script.matches ?? [];
    if (
      matches.length === 0 ||
      matches.some((match) => !isAllowedManifestContentScriptMatch(match))
    ) {
      throw new Error(
        'Production content scripts may only match corresponding.app, local Vite ports, or known journal autofill hosts',
      );
    }
  }

  await rm(E2E_EXTENSION_PATH, { recursive: true, force: true });
  await mkdir(path.dirname(E2E_EXTENSION_PATH), { recursive: true });
  await cp(PRODUCTION_EXTENSION_PATH, E2E_EXTENSION_PATH, { recursive: true });

  const testManifest: Manifest = {
    ...manifest,
    name: `${manifest.name ?? 'Corresponding'} E2E`,
    // Test artifact only: direct popup tabs do not receive activeTab's toolbar
    // user gesture, so narrowly grant the intercepted localhost fixture.
    host_permissions: ['http://localhost/*'],
  };
  await writeFile(
    path.join(E2E_EXTENSION_PATH, 'manifest.json'),
    `${JSON.stringify(testManifest, null, 2)}\n`,
  );
}
