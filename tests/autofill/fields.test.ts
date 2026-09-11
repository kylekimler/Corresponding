import { afterEach, describe, expect, it } from 'vitest';
import { mountBiorxivFixture } from '@/adapters/biorxiv/fixture';
import { mountEditorialManagerFixture } from '@/adapters/editorial-manager/fixture';
import { AUTHOR_FIELD_IDS } from '@/adapters/editorial-manager/ids';
import { mountNatureMtsFixture } from '@/adapters/nature-mts/fixture';
import { mountScholarOneFixture } from '@/adapters/scholarone/fixture';
import {
  AUTHOR_FIRST_NAME,
  FIND_AUTHOR_EMAIL,
} from '@/adapters/scholarone/ids';
import { recognizeAuthorField } from '@/autofill/fields';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('recognizeAuthorField', () => {
  it('rejects disabled and readonly fields even with recognized IDs', () => {
    document.body.innerHTML = '<input id="contrib_auth_1_first_nm" readonly><input id="corr_auth_email" disabled>';
    for (const field of document.querySelectorAll('input')) expect(recognizeAuthorField(field)).toBeNull();
  });
  it('recognizes Nature contributing and corresponding author fields', () => {
    mountNatureMtsFixture({ slots: 2 });
    const first = document.getElementById('contrib_auth_2_first_nm');
    const org = document.getElementById('contrib_auth_1_org');
    const corr = document.getElementById('corr_auth_email');
    expect(recognizeAuthorField(first!)).toEqual(
      expect.objectContaining({
        field: 'givenName',
        sequence: 2,
        source: 'exact_selector',
      }),
    );
    expect(recognizeAuthorField(org!)).toEqual(
      expect.objectContaining({ field: 'institution', sequence: 1 }),
    );
    expect(recognizeAuthorField(corr!)).toEqual(
      expect.objectContaining({ field: 'email', corresponding: true }),
    );
  });

  it('recognizes Editorial Manager, ScholarOne, and bioRxiv author fields', () => {
    mountEditorialManagerFixture({ inIframe: false });
    expect(
      recognizeAuthorField(document.getElementById(AUTHOR_FIELD_IDS.firstName)!),
    ).toEqual(expect.objectContaining({ field: 'givenName' }));
    expect(
      recognizeAuthorField(document.getElementById(AUTHOR_FIELD_IDS.institution)!),
    ).toEqual(expect.objectContaining({ field: 'institution' }));

    mountScholarOneFixture({ formOpen: true });
    expect(recognizeAuthorField(document.getElementById(AUTHOR_FIRST_NAME)!)).toBeNull();
    document.getElementById('create-new-coauthor')!.click();
    expect(
      recognizeAuthorField(document.getElementById(AUTHOR_FIRST_NAME)!),
    ).toEqual(expect.objectContaining({ field: 'givenName' }));

    mountBiorxivFixture({ dialogOpen: true });
    expect(
      recognizeAuthorField(document.querySelector('input[name="firstName"]')!),
    ).toEqual(expect.objectContaining({ field: 'givenName' }));
    expect(
      recognizeAuthorField(document.querySelector('input[name="affiliation"]')!),
    ).toEqual(expect.objectContaining({ field: 'institution' }));
  });

  it('rejects irrelevant, lookup, manuscript, and unsafe controls', () => {
    mountNatureMtsFixture({ slots: 1 });
    expect(recognizeAuthorField(document.getElementById('num_authors')!)).toBeNull();
    expect(recognizeAuthorField(document.getElementById('final_submit')!)).toBeNull();

    document.body.innerHTML = `
      <input id="password" type="password" />
      <input id="q" type="search" name="q" />
      <input id="notes" type="text" aria-label="Comments" />
      <textarea id="txtFullTitle" name="txtFullTitle"></textarea>
    `;
    expect(recognizeAuthorField(document.getElementById('password')!)).toBeNull();
    expect(recognizeAuthorField(document.getElementById('q')!)).toBeNull();
    expect(recognizeAuthorField(document.getElementById('notes')!)).toBeNull();
    expect(recognizeAuthorField(document.getElementById('txtFullTitle')!)).toBeNull();

    mountScholarOneFixture({ formOpen: true });
    expect(
      recognizeAuthorField(document.getElementById(FIND_AUTHOR_EMAIL)!),
    ).toBeNull();
  });
});
