import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildNatureMtsFixtureHtml, mountNatureMtsFixture } from '@/adapters/nature-mts/fixture';
import { startContextualAutofill } from '@/autofill/controller';
import { FIELD_CARD_ATTR, PAGE_CHIP_ATTR, REVIEW_NOTICE_ATTR } from '@/autofill/ui';
import { runContextualFill, type ContextualFillResult } from '@/autofill/fill';
import { makeAuthor, makeNAuthors, makeRoster } from '../helpers/roster';
import type { Roster } from '@/schema/author';

afterEach(() => {
  document.body.innerHTML = '';
  document.getElementById('corresponding-autofill-root')?.remove();
});

function kyleAdaRoster(): Roster {
  return makeRoster([
    makeAuthor({
      givenName: 'Kyle',
      familyName: 'Kimler',
      sequence: 1,
      isCorresponding: true,
      email: 'kkimler@broadinstitute.org',
      affiliations: [{ institution: 'Broad Institute', isPrimary: true }],
    }),
    makeAuthor({
      givenName: 'Ada',
      familyName: 'Lovelace',
      sequence: 2,
      email: 'ada@example.org',
      affiliations: [{ institution: 'Analytical Engine', isPrimary: true }],
    }),
  ]);
}

function chip(controller: ReturnType<typeof startContextualAutofill>) {
  return controller.ui.shadow.querySelector(`[${PAGE_CHIP_ATTR}]`);
}

function card(controller: ReturnType<typeof startContextualAutofill>) {
  return controller.ui.shadow.querySelector(`[${FIELD_CARD_ATTR}]`);
}

async function start(options: {
  roster?: Roster | undefined;
  subscribe?: (listener: () => void) => () => void;
  fill?: typeof runContextualFill;
}) {
  let current = options.roster;
  const controller = startContextualAutofill({
    document,
    debounceMs: 10,
    blurDelayMs: 15,
    isTopFrame: true,
    getActiveRoster: async () => current,
    subscribeRoster: options.subscribe,
    fill: options.fill,
  });
  await controller.refresh();
  return {
    controller,
    setRoster(next: Roster | undefined) {
      current = next;
    },
  };
}

describe('contextual autofill controller', () => {
  const review = (controller: ReturnType<typeof startContextualAutofill>) =>
    controller.ui.shadow.querySelector(`[${REVIEW_NOTICE_ATTR}]`);
  const fillWithWarning: typeof runContextualFill = async (...args) => {
    const result = await runContextualFill(...args);
    if (result.ok) result.report.warnings.push('Author 1 saved with journal validation marks.');
    return result;
  };

  it('keeps warnings visible after fill, focus changes, and DOM refresh without offering a duplicate fill', async () => {
    mountNatureMtsFixture({ slots: 2 });
    const fill = vi.fn(fillWithWarning);
    const { controller } = await start({ roster: kyleAdaRoster(), fill });
    chip(controller)!.querySelector('button')!.click();
    await vi.waitFor(() => expect(review(controller)?.textContent).toContain('journal validation marks'));
    expect(chip(controller)).toBeNull();
    document.getElementById('contrib_auth_1_first_nm')!.dispatchEvent(new Event('focusin', { bubbles: true }));
    await controller.refresh();
    expect(review(controller)).toBeTruthy();
    expect(card(controller)).toBeNull();
    expect(review(controller)?.textContent).not.toContain('Fill authors');
    review(controller)!.querySelector('button')!.click();
    await controller.refresh();
    expect(review(controller)).toBeNull();
    expect(chip(controller)).toBeNull();
    expect(fill).toHaveBeenCalledTimes(1);
    controller.destroy();
  });

  it('shows a persistent review notice after a one-author fill as well', async () => {
    mountNatureMtsFixture({ slots: 2 });
    const { controller } = await start({ roster: kyleAdaRoster(), fill: fillWithWarning });
    document.getElementById('contrib_auth_2_first_nm')!.dispatchEvent(new Event('focusin', { bubbles: true }));
    card(controller)!.querySelector('button')!.click();
    await vi.waitFor(() => expect(review(controller)).toBeTruthy());
    expect(card(controller)).toBeNull();
    expect((document.getElementById('contrib_auth_1_first_nm') as HTMLInputElement).value).toBe('');
    controller.destroy();
  });

  it('clears old review notices when the website updates or removes the roster', async () => {
    mountNatureMtsFixture({ slots: 2 });
    const data = kyleAdaRoster();
    const { controller, setRoster } = await start({ roster: data, fill: fillWithWarning });
    chip(controller)!.querySelector('button')!.click();
    await vi.waitFor(() => expect(review(controller)).toBeTruthy());
    setRoster({ ...data, updatedAt: '2026-09-12T00:00:00.000Z' });
    await controller.refresh();
    expect(review(controller)).toBeNull();
    expect(chip(controller)).toBeTruthy();
    setRoster(undefined);
    await controller.refresh();
    expect(chip(controller)).toBeNull();
    controller.destroy();
  });

  it('clears review notices on SPA navigation and hides them on unsupported content', async () => {
    mountNatureMtsFixture({ slots: 2 });
    const { controller } = await start({ roster: kyleAdaRoster(), fill: fillWithWarning });
    chip(controller)!.querySelector('button')!.click();
    await vi.waitFor(() => expect(review(controller)).toBeTruthy());
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    expect(review(controller)).toBeNull();
    await controller.refresh();
    expect(chip(controller)).toBeTruthy();
    document.body.innerHTML = '<input id="unrelated">';
    await controller.refresh();
    expect(chip(controller)).toBeNull();
    controller.destroy();
  });

  it('does not attach an old asynchronous fill result to a newly synced roster', async () => {
    mountNatureMtsFixture({ slots: 2 });
    let finish!: (value: ContextualFillResult) => void;
    const pending = new Promise<ContextualFillResult>((resolve) => { finish = resolve; });
    const data = kyleAdaRoster();
    const { controller, setRoster } = await start({ roster: data, fill: () => pending });
    chip(controller)!.querySelector('button')!.click();
    const result = await fillWithWarning(document, data, { mode: 'all' });
    setRoster(makeRoster(makeNAuthors(3)));
    await controller.refresh();
    finish(result);
    await vi.waitFor(() => expect(chip(controller)?.textContent).toContain('Fill authors'));
    expect(review(controller)).toBeNull();
    controller.destroy();
  });

  it('does not offer an immediate full-roster retry after a partially failed fill', async () => {
    mountNatureMtsFixture({ slots: 2 });
    const { controller } = await start({ roster: kyleAdaRoster(), fill: async (...args) => {
      const result = await runContextualFill(...args);
      if (!result.ok) return result;
      return { ok: false, reason: 'Some author fields were preserved because of conflicts.', report: result.report };
    } });
    chip(controller)!.querySelector('button')!.click();
    await vi.waitFor(() => expect(review(controller)?.textContent).toContain('conflicts'));
    expect(chip(controller)).toBeNull();
    review(controller)!.querySelector('button')!.click();
    await controller.refresh();
    expect(chip(controller)).toBeNull();
    controller.destroy();
  });

  it('shows a page chip on a supported author page when a roster exists', async () => {
    mountNatureMtsFixture({ slots: 2 });
    const { controller } = await start({ roster: kyleAdaRoster() });
    expect(chip(controller)?.textContent).toContain('Corresponding can fill 2 authors');
    expect(
      (document.getElementById('contrib_auth_1_first_nm') as HTMLInputElement).value,
    ).toBe('');
    controller.destroy();
  });

  it('stays invisible when no roster exists', async () => {
    mountNatureMtsFixture({ slots: 2 });
    const { controller } = await start({ roster: undefined });
    expect(chip(controller)).toBeNull();
    document.getElementById('contrib_auth_1_first_nm')?.dispatchEvent(
      new Event('focusin', { bubbles: true }),
    );
    expect(card(controller)).toBeNull();
    controller.destroy();
  });

  it('falls back to no contextual UI on unsupported pages', async () => {
    document.body.innerHTML =
      '<form><input id="title" /><input id="password" type="password" /></form>';
    const { controller } = await start({ roster: makeRoster(makeNAuthors(2)) });
    expect(chip(controller)).toBeNull();
    document.getElementById('title')?.dispatchEvent(
      new Event('focusin', { bubbles: true }),
    );
    expect(card(controller)).toBeNull();
    controller.destroy();
  });

  it('shows a field suggestion on a recognized control and dismisses on blur or Escape', async () => {
    mountNatureMtsFixture({ slots: 2 });
    const { controller } = await start({ roster: kyleAdaRoster() });
    const field = document.getElementById('contrib_auth_1_first_nm')!;
    field.dispatchEvent(new Event('focusin', { bubbles: true }));
    expect(card(controller)?.textContent).toContain('Kyle Kimler');
    expect(card(controller)?.textContent).toContain('Fill author');

    field.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    await vi.waitFor(() => expect(card(controller)).toBeNull());

    field.dispatchEvent(new Event('focusin', { bubbles: true }));
    expect(card(controller)).toBeTruthy();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(card(controller)).toBeNull();
    controller.destroy();
  });

  it('fills one author from the field card without filling the rest', async () => {
    mountNatureMtsFixture({ slots: 2 });
    const { controller } = await start({ roster: kyleAdaRoster() });
    document.getElementById('contrib_auth_2_first_nm')!.dispatchEvent(
      new Event('focusin', { bubbles: true }),
    );
    const button = card(controller)?.querySelector('button');
    button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await vi.waitFor(() => {
      expect(
        (document.getElementById('contrib_auth_2_first_nm') as HTMLInputElement).value,
      ).toBe('Ada');
    });
    expect(
      (document.getElementById('contrib_auth_1_first_nm') as HTMLInputElement).value,
    ).toBe('');
    expect(card(controller)).toBeNull();
    controller.destroy();
  });

  it('fills the entire roster in order from the page chip', async () => {
    mountNatureMtsFixture({ slots: 2 });
    const { controller } = await start({ roster: kyleAdaRoster() });
    const button = chip(controller)?.querySelector('button');
    button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await vi.waitFor(() => {
      expect(
        (document.getElementById('contrib_auth_1_first_nm') as HTMLInputElement).value,
      ).toBe('Kyle');
    });
    expect(
      (document.getElementById('contrib_auth_2_first_nm') as HTMLInputElement).value,
    ).toBe('Ada');
    expect(
      (document.getElementById('contrib_auth_1_author_seq') as HTMLInputElement).value,
    ).toBe('1');
    expect(chip(controller)).toBeNull();
    controller.destroy();
  });

  it('appears after SPA / dynamic author fields are inserted', async () => {
    const { controller } = await start({ roster: kyleAdaRoster() });
    expect(chip(controller)).toBeNull();
    document.body.innerHTML = buildNatureMtsFixtureHtml({ slots: 2 });
    await vi.waitFor(() => {
      expect(chip(controller)?.textContent).toContain('2 authors');
    });
    controller.destroy();
  });

  it('updates the chip when the website changes the active roster', async () => {
    mountNatureMtsFixture({ slots: 2 });
    const listeners = new Set<() => void>();
    const { controller, setRoster } = await start({
      roster: makeRoster(makeNAuthors(2)),
      subscribe: (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    });
    expect(chip(controller)?.textContent).toContain('2 authors');
    setRoster(makeRoster(makeNAuthors(18)));
    listeners.forEach((listener) => listener());
    await vi.waitFor(() => {
      expect(chip(controller)?.textContent).toContain('18 authors');
    });
    controller.destroy();
  });
});
