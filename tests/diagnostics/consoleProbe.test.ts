import { afterEach, describe, expect, it } from 'vitest';
import {
  STRUCTURAL_FRAME_PROBE,
  looksLikeSafeStructuralProbe,
} from '@/diagnostics/consoleProbe';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('structural frame probe', () => {
  it('refuses cookies, storage, and input values in the snippet source', () => {
    expect(looksLikeSafeStructuralProbe(STRUCTURAL_FRAME_PROBE)).toBe(true);
    expect(STRUCTURAL_FRAME_PROBE).not.toMatch(/\.value\b/);
    expect(STRUCTURAL_FRAME_PROBE.toLowerCase()).not.toContain('document.cookie');
  });

  it('reports same-origin iframe fields without leaking values', () => {
    document.body.innerHTML = `
      <select id="RoleDropdown" name="RoleDropdown">
        <option>Author</option>
      </select>
      <iframe id="author-frame"></iframe>
    `;
    const iframe = document.querySelector('iframe') as HTMLIFrameElement;
    const child = iframe.contentDocument;
    if (!child) throw new Error('expected same-origin iframe');
    child.open();
    child.write(`<!doctype html><html><body>
      <label for="givenName">Given Name</label>
      <input id="givenName" name="givenName" value="Ada Lovelace" />
      <label for="email">Email</label>
      <input id="email" name="email" value="ada@secret.edu" />
      <input id="password" type="password" value="hunter2" />
    </body></html>`);
    child.close();

    const text = eval(STRUCTURAL_FRAME_PROBE) as string;
    expect(text).toContain('id=RoleDropdown');
    expect(text).toContain('id=givenName');
    expect(text).toContain('id=email');
    expect(text).not.toContain('Ada Lovelace');
    expect(text).not.toContain('ada@secret.edu');
    expect(text).not.toContain('hunter2');
    expect(text).not.toContain('id=password');
  });
});
