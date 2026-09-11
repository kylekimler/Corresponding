import { afterEach, describe, expect, it } from 'vitest';
import {
  createAutofillUi,
  FIELD_CARD_ATTR,
  PAGE_CHIP_ATTR,
} from '@/autofill/ui';
import { makeAuthor } from '../helpers/roster';

afterEach(() => {
  document.getElementById('corresponding-autofill-root')?.remove();
});

describe('autofill UI lifecycle and position', () => {
  it('positions the field card under the focused control and removes it on hide', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.getBoundingClientRect = () =>
      ({
        x: 80,
        y: 40,
        top: 40,
        bottom: 64,
        left: 80,
        right: 280,
        width: 200,
        height: 24,
        toJSON() {
          return {};
        },
      }) as DOMRect;

    const ui = createAutofillUi(document);
    ui.showFieldCard({
      author: makeAuthor({
        givenName: 'Kyle',
        familyName: 'Kimler',
        sequence: 1,
        email: 'kkimler@broadinstitute.org',
        affiliations: [{ institution: 'Broad Institute', isPrimary: true }],
      }),
      anchor: input,
      onFillOne: () => undefined,
    });

    const card = ui.shadow.querySelector(`[${FIELD_CARD_ATTR}]`) as HTMLElement;
    expect(card).toBeTruthy();
    expect(card.textContent).toContain('Fill with Corresponding');
    expect(card.textContent).toContain('Kyle Kimler');
    expect(card.textContent).toContain('Broad Institute');
    expect(card.textContent).toContain('kkimler@...');
    expect(card.style.top).toBe('70px');
    expect(card.style.left).toBe('80px');

    ui.hideFieldCard();
    expect(ui.shadow.querySelector(`[${FIELD_CARD_ATTR}]`)).toBeNull();
    ui.destroy();
  });

  it('shows and hides the page chip without a modal', () => {
    const ui = createAutofillUi(document);
    ui.showPageChip({ authorCount: 18, onFillAll: () => undefined });
    const chip = ui.shadow.querySelector(`[${PAGE_CHIP_ATTR}]`);
    expect(chip?.textContent).toContain('Corresponding can fill 18 authors');
    expect(chip?.textContent).toContain('Fill authors');
    expect(ui.shadow.querySelector('[role="dialog"]')).toBeNull();
    ui.hidePageChip();
    expect(ui.shadow.querySelector(`[${PAGE_CHIP_ATTR}]`)).toBeNull();
    ui.destroy();
  });
});
