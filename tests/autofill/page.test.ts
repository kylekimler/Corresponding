import { afterEach, describe, expect, it } from 'vitest';
import { mountBiorxivFixture } from '@/adapters/biorxiv/fixture';
import { mountEditorialManagerFixture } from '@/adapters/editorial-manager/fixture';
import { HOST_FAMILY_CONFIDENCE } from '@/adapters/hosts';
import { mountNatureMtsFixture } from '@/adapters/nature-mts/fixture';
import { defaultRegistry } from '@/adapters/registry';
import { mountScholarOneFixture } from '@/adapters/scholarone/fixture';
import {
  detectContextualPage,
  pageSupportsContextualAutofill,
  shouldShowPageChip,
} from '@/autofill/page';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('page-level contextual autofill', () => {
  it('is confident on every in-repo fillable author fixture', () => {
    mountNatureMtsFixture({ slots: 1 });
    expect(pageSupportsContextualAutofill(detectContextualPage(document))).toBe(
      true,
    );

    mountEditorialManagerFixture();
    expect(pageSupportsContextualAutofill(detectContextualPage(document))).toBe(
      true,
    );

    mountScholarOneFixture({ formOpen: true });
    expect(pageSupportsContextualAutofill(detectContextualPage(document))).toBe(
      true,
    );

    mountBiorxivFixture();
    expect(pageSupportsContextualAutofill(detectContextualPage(document))).toBe(
      true,
    );
  });

  it('does not treat host-only or unknown pages as confident', () => {
    document.body.innerHTML = '<select id="RoleDropdown"></select>';
    expect(pageSupportsContextualAutofill(detectContextualPage(document))).toBe(
      false,
    );
    expect(
      pageSupportsContextualAutofill({
        platformId: 'editorial-manager',
        confidence: HOST_FAMILY_CONFIDENCE,
        label: 'Editorial Manager',
        evidence: ['host:www.editorialmanager.com'],
      }),
    ).toBe(false);
    expect(
      shouldShowPageChip(defaultRegistry.detect(document), 3, true),
    ).toBe(false);
  });
});
