import { describe, expect, it } from 'vitest';
import { mountNatureMtsFixture } from '@/adapters/nature-mts/fixture';
import { handleExtensionRequest } from '@/messaging/handleRequest';
import { createSampleRoster } from '@/roster/sample';

describe('content message handler', () => {
  it('returns PONG through the Chrome sendResponse-compatible handler', () => {
    expect(
      handleExtensionRequest(
        { type: 'PING' },
        document,
        'https://journal.example/submit',
      ),
    ).toEqual({ type: 'PONG' });
  });

  it('refuses malformed messages', () => {
    const response = handleExtensionRequest(
      { type: 'FILL' },
      document,
      'https://journal.example/submit',
    );
    expect(response.type).toBe('ERROR');
  });

  it('keeps Preview dry and applies Fill on a detected fixture', () => {
    mountNatureMtsFixture({ slots: 3 });
    const roster = createSampleRoster();
    const firstName = () =>
      (document.getElementById('contrib_auth_1_first_nm') as HTMLInputElement)
        .value;

    const preview = handleExtensionRequest(
      { type: 'PREVIEW', roster, overwrite: false },
      document,
      'http://localhost:3000/fixtures/nature-mts-sample.html',
    );
    expect(preview.type).toBe('FILL_RESULT');
    expect(firstName()).toBe('');

    const fill = handleExtensionRequest(
      { type: 'FILL', roster, overwrite: false },
      document,
      'http://localhost:3000/fixtures/nature-mts-sample.html',
    );
    expect(fill.type).toBe('FILL_RESULT');
    expect(firstName()).toBe('Ada');
  });
});
