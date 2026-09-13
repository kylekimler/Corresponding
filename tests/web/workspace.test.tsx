import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { Workspace } from '../../web/src/pages/Workspace';
import { Home } from '../../web/src/pages/Home';
import { compileManuscriptRoster, createEmptyManuscript } from '@/schema/manuscript';
import { makeNAuthors } from '../helpers/roster';
import { loadLocalManuscript, saveLocalManuscript, listLocalManuscripts } from '../../web/src/storage/localManuscript';

vi.mock('../../web/src/bridge/client', () => ({
  pingExtension: vi.fn(async () => ({ type: 'ERROR', code: 'NOT_INSTALLED' })),
  loadSelectedRoster: vi.fn(async () => ({ type: 'SELECTED_ROSTER', roster: null })),
  saveRosterToExtension: vi.fn(async (roster) => ({ type: 'SAVED', roster })),
}));

let root: Root;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const values = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  });
  document.body.innerHTML = '<div id="app"></div>';
  root = createRoot(document.getElementById('app')!);
});
afterEach(async () => { await act(async () => root?.unmount()); vi.unstubAllGlobals(); });

async function mount() {
  const manuscript = createEmptyManuscript('Atlas');
  manuscript.roster.authors = makeNAuthors(1);
  manuscript.roster.authors[0]!.affiliations.push({ institution: 'Second institute', isPrimary: false });
  saveLocalManuscript(manuscript);
  await act(async () => { root.render(<Workspace />); });
}
async function type(label: string, value: string) {
  const field = [...document.querySelectorAll('label')].find((el) => el.querySelector('span')?.textContent === label)?.querySelector('input');
  if (!field) throw new Error(`Missing ${label}`);
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(field, value);
    field.dispatchEvent(new Event('input', { bubbles: true }));
  });
  return field;
}

describe('release workspace regressions', () => {
  it('keeps the existing draft and the sample safety marker through editing and sync', async () => {
    const existing = createEmptyManuscript('Real work');
    saveLocalManuscript(existing);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await act(async () => { root.render(<Home hasDraft />); });
    const button = [...document.querySelectorAll('button')].find((el) => el.textContent === 'Try a sample roster')!;
    await act(async () => button.click());
    expect(listLocalManuscripts().some((item) => item.id === existing.id)).toBe(true);
    expect(loadLocalManuscript()!.roster.authors).toHaveLength(6);
    await act(async () => { root.render(<Workspace />); });
    await type('Email', 'edited@example.org');
    expect(compileManuscriptRoster(loadLocalManuscript()!).source).toBe('sample');
    expect(document.body.textContent).toContain('cannot fill live journal pages');
    vi.restoreAllMocks();
  });

  it('uses the approved README introduction and motivational closing line', async () => {
    await act(async () => { root.render(<Home hasDraft={false} />); });
    expect(document.querySelector('.intro')?.textContent?.trim()).toBe(
      'Paste your manuscript authors once into the web app, then use the Chrome extension to fill supported journal submission forms.',
    );
    expect(document.querySelector('.site-footer p')?.textContent).toBe(
      "Because filling out grant and publication forms shouldn't be a scientist's full time job",
    );
    expect(document.body.textContent).not.toContain('Every submission.');
    expect(document.body.textContent).toContain('The Chrome extension is not connected');
  });

  it('lets the user finish typing an email without crashing or saving a partial address', async () => {
    await mount();
    const original = loadLocalManuscript()!.roster.authors[0]!.email;
    const field = await type('Email', 'ada@');
    expect(field.value).toBe('ada@');
    expect(document.body.textContent).toContain('Finish editing to sync');
    expect(loadLocalManuscript()!.roster.authors[0]!.email).toBe(original);
    await type('Email', 'ada@example.org');
    expect(loadLocalManuscript()!.roster.authors[0]!.email).toBe('ada@example.org');
  });

  it('preserves extra affiliations and spaces while editing an institution', async () => {
    await mount();
    await type('Institution', 'Broad ');
    const affiliations = loadLocalManuscript()!.roster.authors[0]!.affiliations;
    expect(affiliations[0]!.institution).toBe('Broad ');
    expect(affiliations[1]!.institution).toBe('Second institute');
  });

  it('keeps the previous manuscript when starting another', () => {
    const first = createEmptyManuscript('First');
    saveLocalManuscript(first);
    saveLocalManuscript(createEmptyManuscript('Second'));
    expect(listLocalManuscripts().map((item) => item.title)).toEqual(['First']);
  });
});
