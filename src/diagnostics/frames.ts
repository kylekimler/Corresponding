/**
 * Same-origin iframe / frame walk for compatibility capture.
 * Cross-origin frames are counted but never read.
 */

import { EMAIL_RE, redactUrl } from './redact';

export const MAX_FRAME_DEPTH = 6;

export interface CaptureFrame {
  depth: number;
  readable: boolean;
  srcPattern?: string;
  fieldCount: number;
  controlCount: number;
}

export interface FrameInventory {
  seen: number;
  readable: number;
  blocked: number;
  frames: CaptureFrame[];
}

export interface ReadableDocument {
  doc: Document;
  depth: number;
  srcPattern?: string;
  /** Index into FrameInventory.frames, or -1 for the top document. */
  frameIndex: number;
}

function redactFrameSrc(raw: string | null | undefined): string | undefined {
  if (!raw || raw === 'about:blank') return undefined;
  const url = redactUrl(raw);
  if (!url) return undefined;
  EMAIL_RE.lastIndex = 0;
  return url.replace(EMAIL_RE, '[REDACTED_EMAIL]');
}

function tryReadFrameDocument(
  el: HTMLIFrameElement | HTMLFrameElement,
): Document | null {
  try {
    if (el.contentDocument) return el.contentDocument;
  } catch {
    return null;
  }
  try {
    const doc = el.contentWindow?.document ?? null;
    return doc;
  } catch {
    return null;
  }
}

function frameElements(doc: Document): Array<HTMLIFrameElement | HTMLFrameElement> {
  return Array.from(doc.querySelectorAll('iframe, frame')).filter(
    (el): el is HTMLIFrameElement | HTMLFrameElement =>
      el instanceof HTMLIFrameElement || el instanceof HTMLFrameElement,
  );
}

/**
 * Collect the top document plus nested same-origin iframe/frame documents.
 * Inaccessible frames appear in the inventory with readable=false.
 */
export function collectReadableDocuments(root: Document): {
  documents: ReadableDocument[];
  inventory: FrameInventory;
} {
  const frames: CaptureFrame[] = [];
  const documents: ReadableDocument[] = [
    { doc: root, depth: 0, frameIndex: -1 },
  ];
  const seen = new WeakSet<Document>([root]);
  const queue: ReadableDocument[] = [{ doc: root, depth: 0, frameIndex: -1 }];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || current.depth >= MAX_FRAME_DEPTH) continue;

    for (const el of frameElements(current.doc)) {
      const srcPattern = redactFrameSrc(el.getAttribute('src') || el.src);
      const child = tryReadFrameDocument(el);
      if (!child || seen.has(child)) {
        frames.push({
          depth: current.depth + 1,
          readable: false,
          srcPattern,
          fieldCount: 0,
          controlCount: 0,
        });
        continue;
      }
      seen.add(child);
      const frameIndex = frames.length;
      frames.push({
        depth: current.depth + 1,
        readable: true,
        srcPattern,
        fieldCount: 0,
        controlCount: 0,
      });
      const readable: ReadableDocument = {
        doc: child,
        depth: current.depth + 1,
        srcPattern,
        frameIndex,
      };
      documents.push(readable);
      queue.push(readable);
    }
  }

  const blocked = frames.filter((f) => !f.readable).length;
  return {
    documents,
    inventory: {
      seen: frames.length,
      readable: frames.length - blocked,
      blocked,
      frames,
    },
  };
}

export function emptyFrameInventory(): FrameInventory {
  return { seen: 0, readable: 0, blocked: 0, frames: [] };
}

export function recordFrameCounts(
  inventory: FrameInventory,
  frameIndex: number,
  fieldCount: number,
  controlCount: number,
): void {
  const frame = inventory.frames[frameIndex];
  if (!frame) return;
  frame.fieldCount = fieldCount;
  frame.controlCount = controlCount;
}
