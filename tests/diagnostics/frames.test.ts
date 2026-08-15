import { afterEach, describe, expect, it } from 'vitest';
import { captureForm, previewCapture } from '@/diagnostics/capture';
import { probeForm } from '@/diagnostics/formProbe';
import { assertNoLeakedSecrets } from '@/diagnostics/redact';

function writeFrameDocument(iframe: HTMLIFrameElement, html: string): Document {
  const child = iframe.contentDocument;
  if (!child) {
    throw new Error('jsdom did not provide a same-origin iframe document');
  }
  child.open();
  child.write(`<!doctype html><html><body>${html}</body></html>`);
  child.close();
  return iframe.contentDocument ?? child;
}

function mountSameOriginFrame(
  parent: Document,
  html: string,
  src?: string,
): HTMLIFrameElement {
  const iframe = parent.createElement('iframe');
  const host = parent.body ?? parent.documentElement;
  if (!host) {
    throw new Error('parent document has no body to attach an iframe');
  }
  host.appendChild(iframe);
  writeFrameDocument(iframe, html);
  if (src) {
    iframe.setAttribute('src', src);
    // jsdom navigates on src and may replace the document; restore the fixture.
    writeFrameDocument(iframe, html);
  }
  return iframe;
}

function mountBlockedFrame(parent: Document, src: string): HTMLIFrameElement {
  const iframe = parent.createElement('iframe');
  iframe.setAttribute('src', src);
  parent.body.appendChild(iframe);
  Object.defineProperty(iframe, 'contentDocument', {
    configurable: true,
    get() {
      return null;
    },
  });
  Object.defineProperty(iframe, 'contentWindow', {
    configurable: true,
    get() {
      throw new Error('Blocked a frame with origin');
    },
  });
  return iframe;
}

function mountPlosOneShell(): void {
  document.body.innerHTML = `
    <select id="RoleDropdown" name="RoleDropdown">
      <option>Author</option>
      <option>Reviewer</option>
    </select>
    <div id="hamBurger" role="button" aria-label="Open menu">Open menu</div>
    <div id="userIcon" role="button" aria-label="Open account">Open account</div>
  `;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('compatibility capture iframe walk', () => {
  it('includes same-origin iframe author fields', () => {
    mountPlosOneShell();
    mountSameOriginFrame(
      document,
      `
        <label for="givenName">Given Name</label>
        <input id="givenName" name="givenName" />
        <label for="familyName">Family Name</label>
        <input id="familyName" name="familyName" />
        <label for="email">Email</label>
        <input id="email" name="email" type="email" />
        <button id="addAuthor">Add author</button>
      `,
      'https://www.editorialmanager.com/pone/author.aspx',
    );

    const capture = captureForm(document, {
      url: 'https://www.editorialmanager.com/pone/default2.aspx',
    });
    const text = previewCapture(capture);

    expect(capture.frames.seen).toBe(1);
    expect(capture.frames.readable).toBe(1);
    expect(capture.frames.blocked).toBe(0);
    expect(capture.frames.frames[0]).toEqual(
      expect.objectContaining({
        depth: 1,
        readable: true,
        fieldCount: 3,
        controlCount: 1,
      }),
    );
    expect(capture.structuralFields.map((f) => f.idPattern)).toEqual(
      expect.arrayContaining(['RoleDropdown', 'givenName', 'familyName', 'email']),
    );
    expect(capture.fieldCount).toBe(4);
    expect(text).toContain('iframeSeen: 1');
    expect(text).toContain('iframeReadable: 1');
    expect(text).toContain('## frames');
    expect(text).not.toMatch(/Editorial Manager chrome/);
  });

  it('walks nested same-origin frames', () => {
    document.body.innerHTML = '<select id="RoleDropdown" name="RoleDropdown"></select>';
    const outer = mountSameOriginFrame(document, '<div id="outer-shell"></div>');
    const outerDoc = outer.contentDocument;
    if (!outerDoc?.body) {
      throw new Error('outer iframe document was not writable');
    }
    mountSameOriginFrame(
      outerDoc,
      `
        <label for="firstName">First name</label>
        <input id="firstName" name="firstName" />
      `,
    );

    const capture = captureForm(document);
    expect(capture.frames.seen).toBe(2);
    expect(capture.frames.readable).toBe(2);
    expect(capture.structuralFields.some((f) => f.idPattern === 'firstName')).toBe(
      true,
    );
    expect(capture.frames.frames.map((f) => f.depth)).toEqual([1, 2]);
  });

  it('counts inaccessible frames without reading them', () => {
    mountPlosOneShell();
    mountBlockedFrame(
      document,
      'https://cdn.example.org/author-form?token=SECRETTOKENVALUE',
    );

    const capture = captureForm(document, {
      url: 'https://www.editorialmanager.com/pone/default2.aspx',
    });
    const text = previewCapture(capture);

    expect(capture.frames.seen).toBe(1);
    expect(capture.frames.readable).toBe(0);
    expect(capture.frames.blocked).toBe(1);
    expect(capture.frames.frames[0]?.readable).toBe(false);
    expect(capture.fieldCount).toBe(1);
    expect(text).toContain('iframeBlocked: 1');
    expect(text).toMatch(/not readable from the top document/);
    expect(text).not.toContain('SECRETTOKENVALUE');
  });

  it('flags a PLOS ONE / EM chrome-only shell and asks for the author step', () => {
    mountPlosOneShell();
    const capture = captureForm(document, {
      url: 'https://www.editorialmanager.com/pone/default2.aspx',
    });
    const text = previewCapture(capture);

    expect(capture.fieldCount).toBe(1);
    expect(capture.controlCount).toBe(2);
    expect(capture.structure.authorGroupCount).toBe(0);
    expect(capture.frames.seen).toBe(0);
    expect(capture.structuralFields[0]?.idPattern).toBe('RoleDropdown');
    expect(text).toMatch(/Editorial Manager chrome/);
    expect(text).toMatch(/Manuscript Data/);
    expect(text).toContain('iframeSeen: 0');
  });

  it('does not leak iframe src query tokens or emails', () => {
    document.body.innerHTML = '<input id="top" />';
    mountSameOriginFrame(
      document,
      '<input id="innerFirst" name="first_name" />',
      'https://www.editorialmanager.com/pone/default2.aspx?token=abc123secret&email=ada@secret.edu',
    );

    const capture = captureForm(document);
    const text = previewCapture(capture);
    const planted = ['abc123secret', 'ada@secret.edu'];
    expect(findLeaked(text, planted)).toEqual([]);
    assertNoLeakedSecrets(text, planted);
    expect(capture.frames.frames[0]?.srcPattern).toContain('[REDACTED]');
    expect(text).not.toContain('ada@secret.edu');
  });

  it('includes iframe fields in the legacy probe list', () => {
    document.body.innerHTML = '<input id="shell" />';
    mountSameOriginFrame(
      document,
      '<label for="contrib_email">Email</label><input id="contrib_email" name="email" />',
    );
    const report = probeForm(document);
    expect(report.fields.some((f) => f.idPattern === 'contrib_email')).toBe(true);
    expect(report.frames.readable).toBe(1);
  });
});

function findLeaked(exported: string, planted: string[]): string[] {
  return planted.filter((secret) => exported.includes(secret));
}
