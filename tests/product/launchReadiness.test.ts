import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { isAllowedWebsiteOrigin } from '@/messaging/website';
import { WEBSITE_CONTENT_SCRIPT_MATCHES } from '@/messaging/websiteHandshake';

describe('launch deployment contract', () => {
  it('allows the documented rehearsal port without trusting remote staging hosts', () => {
    for (const host of ['localhost', '127.0.0.1']) {
      const origin = `http://${host}:4173`;
      expect(WEBSITE_CONTENT_SCRIPT_MATCHES).toContain(`${origin}/*`);
      expect(isAllowedWebsiteOrigin(origin, 'production')).toBe(true);
    }
    expect(isAllowedWebsiteOrigin('https://corresponding.app', 'production')).toBe(true);
    for (const origin of ['https://preview.netlify.app', 'https://www.corresponding.app', 'https://corresponding.app.attacker.example']) {
      expect(isAllowedWebsiteOrigin(origin, 'production')).toBe(false);
      expect(WEBSITE_CONTENT_SCRIPT_MATCHES).not.toContain(`${origin}/*`);
    }
  });

  it('publishes only static web output with the documented Node version', () => {
    const config = readFileSync('netlify.toml', 'utf8');
    expect(config).toContain('command = "npm run build:web"');
    expect(config).toContain('publish = "web/dist"');
    expect(config).toContain('NODE_VERSION = "22"');
    const docs = readFileSync('docs/WEB_APP.md', 'utf8');
    expect(docs).toContain('http://127.0.0.1:4173/');
    expect(docs).toContain('cannot synchronize with the extension');
  });

  it('has a usable privacy contact before store publication', () => {
    const policy = readFileSync('docs/PRIVACY.md', 'utf8');
    expect(policy).toContain('mailto:corresponding.app@gmail.com');
    expect(policy).not.toContain('to be filled before publication');
  });
});
