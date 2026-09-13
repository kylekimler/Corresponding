import { describe, expect, it } from 'vitest';
import { mountNatureMtsFixture } from '@/adapters/nature-mts/fixture';
import { handleExtensionRequest } from '@/messaging/handleRequest';
import { createSampleRoster } from '@/roster/sample';

describe('content message handler', () => {
  it.each([
    'https://mts-nature.nature.com/fixtures/nature-mts-sample.html',
    'https://localhost.attacker.example/fixtures/nature-mts-sample.html',
    'http://localhost:3000/author-form',
    'file://localhost/fixtures/nature-mts-sample.html',
  ])('refuses sample Fill outside local fixtures: %s', async (url) => {
    mountNatureMtsFixture({ slots: 3 });
    const before = [...document.querySelectorAll('input')].map((el) => el.value);
    const response = await handleExtensionRequest(
      { type: 'FILL', roster: createSampleRoster(), overwrite: true }, document, url,
    );
    expect(response).toEqual({ type: 'ERROR', message: expect.stringContaining('local practice only') });
    expect([...document.querySelectorAll('input')].map((el) => el.value)).toEqual(before);
  });

  it('detects Editorial Manager from the tab URL, not ScholarOne', async () => {
    document.body.innerHTML =
      '<select id="RoleDropdown"><option>Author</option></select>';
    const response = await handleExtensionRequest(
      { type: 'DETECT' },
      document,
      'https://www.editorialmanager.com/pgenetics/default2.aspx',
    );
    expect(response.type).toBe('DETECT_RESULT');
    if (response.type === 'DETECT_RESULT') {
      expect(response.result.platformId).toBe('editorial-manager');
      expect(response.result.label).not.toMatch(/ScholarOne/);
    }
  });

  it('returns PONG through the Chrome sendResponse-compatible handler', async () => {
    expect(
      await handleExtensionRequest(
        { type: 'PING' },
        document,
        'https://journal.example/submit',
      ),
    ).toEqual({ type: 'PONG' });
  });

  it('refuses malformed messages', async () => {
    const response = await handleExtensionRequest(
      { type: 'FILL' },
      document,
      'https://journal.example/submit',
    );
    expect(response.type).toBe('ERROR');
  });

  it('keeps Preview dry and applies Fill on a detected fixture', async () => {
    mountNatureMtsFixture({ slots: 3 });
    const roster = createSampleRoster();
    const firstName = () =>
      (document.getElementById('contrib_auth_1_first_nm') as HTMLInputElement)
        .value;

    const preview = await handleExtensionRequest(
      { type: 'PREVIEW', roster, overwrite: false },
      document,
      'http://localhost:3000/fixtures/nature-mts-sample.html',
    );
    expect(preview.type).toBe('FILL_RESULT');
    expect(firstName()).toBe('');

    const fill = await handleExtensionRequest(
      { type: 'FILL', roster, overwrite: false },
      document,
      'http://localhost:3000/fixtures/nature-mts-sample.html',
    );
    expect(fill.type).toBe('FILL_RESULT');
    expect(firstName()).toBe('Ada');
  });
});
