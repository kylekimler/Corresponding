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

  it('omits CKEditor and step-indicator chrome so author fields stay visible', () => {
    document.body.innerHTML = `
      <button id="StepIndicator_stepManuscriptDataButton">Manuscript Data</button>
      <a id="cke_12" title="Paste from Word">Paste</a>
      <input id="FirstName" name="FirstName" />
      <a title="Click here to select roles">roles</a>
    `;

    const text = eval(STRUCTURAL_FRAME_PROBE) as string;
    expect(text).toContain('id=FirstName');
    expect(text).toContain('Click here to select roles');
    expect(text).not.toContain('StepIndicator');
    expect(text).not.toContain('id=cke_');
    expect(text).toContain('authorFieldCount:');
    expect(text).toContain('hasOpener:');
  });

  it('lists save/add candidates separately from generic controls', () => {
    document.body.innerHTML = `
      <button class="fl-add-btn" title="Add New Author">Add New Author</button>
      <button class="fl-tool fl-flToolSave" data-toolname="AuthorSave" title="Save This Author"></button>
    `;
    const text = eval(STRUCTURAL_FRAME_PROBE) as string;
    console.log('console probe save-add', text);
    expect(text).toContain('-- save-add --');
    expect(text).toContain('tool=AuthorSave');
    expect(text).toContain('fl-add-btn');
    expect(text).toContain('fl-flToolSave');
  });
});
