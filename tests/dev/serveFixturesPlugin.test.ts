import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createFixturesMiddleware,
  resolveFixturePath,
} from '../../scripts/serveFixturesPlugin';

const projectRoot = path.resolve(__dirname, '../..');
const fixturesRoot = path.join(projectRoot, 'fixtures');

describe('resolveFixturePath', () => {
  it('resolves the Nature fixture', () => {
    const resolved = resolveFixturePath(
      '/fixtures/nature-mts-sample.html',
      fixturesRoot,
    );
    expect(resolved).toBe(path.join(fixturesRoot, 'nature-mts-sample.html'));
  });

  it('rejects path traversal', () => {
    expect(resolveFixturePath('/fixtures/../package.json', fixturesRoot)).toBeNull();
    expect(
      resolveFixturePath('/fixtures/%2e%2e/package.json', fixturesRoot),
    ).toBeNull();
  });
});

describe('createFixturesMiddleware', () => {
  let server: http.Server;
  let baseUrl = '';

  beforeAll(async () => {
    const middleware = createFixturesMiddleware(projectRoot);
    server = http.createServer((req, res) => {
      middleware(req, res, () => {
        res.statusCode = 404;
        res.end('no middleware match');
      });
    });
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });
    const addr = server.address();
    if (!addr || typeof addr === 'string') throw new Error('no port');
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it('serves the Nature fixture HTML', async () => {
    const res = await fetch(`${baseUrl}/fixtures/nature-mts-sample.html`);
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain('Synthetic Nature MTS author form');
    expect(body).toBe(
      fs.readFileSync(path.join(fixturesRoot, 'nature-mts-sample.html'), 'utf8'),
    );
  });

  it('rejects encoded traversal without leaking package.json', async () => {
    // Use raw ClientRequest so the path is not normalized away by fetch().
    const body = await new Promise<string>((resolve, reject) => {
      const req = http.request(
        `${baseUrl}/fixtures/%2e%2e/package.json`,
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (c) => chunks.push(c));
          res.on('end', () => {
            expect([400, 404]).toContain(res.statusCode);
            resolve(Buffer.concat(chunks).toString('utf8'));
          });
        },
      );
      req.on('error', reject);
      req.end();
    });
    expect(body).not.toContain('"name": "corresponding"');
  });
});

describe('AutomationControlled flag provenance', () => {
  it('is injected by web-ext; our chromiumArgs do not set it', () => {
    const config = fs.readFileSync(path.join(projectRoot, 'wxt.config.ts'), 'utf8');
    const chromiumArgsMatch = config.match(/chromiumArgs:\s*\[([^\]]*)\]/s);
    expect(chromiumArgsMatch?.[1] ?? '').not.toMatch(/AutomationControlled/);
    expect(config).toMatch(/startUrls/);

    const webExtChromium = fs.readFileSync(
      path.join(
        projectRoot,
        'node_modules/web-ext/lib/extension-runners/chromium.js',
      ),
      'utf8',
    );
    expect(webExtChromium).toContain(
      '--disable-blink-features=AutomationControlled',
    );
  });
});
