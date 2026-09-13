import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const demos = ['scholarone-workflow', 'plos-genetics-workflow', 'biorxiv-workflow'];
const read = (path: string) => readFileSync(resolve(process.cwd(), path));

describe('README publisher demos', () => {
  it.each(demos)('links a small GIF and pausable MP4 for %s', (demo) => {
    const readme = read('README.md').toString();
    const gifPath = `docs/media/${demo}.gif`;
    const moviePath = `docs/media/${demo}.mp4`;
    expect(readme).toContain(`src="${gifPath}"`);
    expect(readme).toContain(`](${moviePath})`);

    const gif = read(gifPath);
    expect(gif.subarray(0, 6).toString()).toBe('GIF89a');
    expect(gif.readUInt16LE(6)).toBe(960);
    expect(gif.readUInt16LE(8)).toBe(640);
    // Higher-motion 25 fps lead demo; keep the other previews under 2 MB.
    expect(gif.byteLength).toBeLessThan(demo === 'scholarone-workflow' ? 3_000_000 : 2_000_000);

    const movie = read(moviePath);
    expect(movie.subarray(4, 8).toString()).toBe('ftyp');
    expect(movie.byteLength).toBeLessThan(2_000_000);
  });

  it('uses even 40ms frame timing in the refreshed ScholarOne GIF', () => {
    const gif = read('docs/media/scholarone-workflow.gif');
    let cursor = 13 + ((gif[10]! & 0x80) ? 3 * 2 ** ((gif[10]! & 7) + 1) : 0);
    const delays: number[] = [];
    const skipBlocks = () => {
      while (cursor < gif.length) {
        const size = gif[cursor++]!;
        if (!size) return;
        cursor += size;
      }
      throw new Error('Truncated GIF sub-blocks');
    };
    while (cursor < gif.length) {
      const marker = gif[cursor++];
      if (marker === 0x3b) break;
      if (marker === 0x21) {
        const label = gif[cursor++];
        if (label === 0xf9) {
          expect(gif[cursor++]).toBe(4);
          delays.push(gif.readUInt16LE(cursor + 1));
          cursor += 5;
        } else skipBlocks();
      } else if (marker === 0x2c) {
        const packed = gif[cursor + 8]!;
        cursor += 9 + ((packed & 0x80) ? 3 * 2 ** ((packed & 7) + 1) : 0);
        cursor++; // LZW minimum code size
        skipBlocks();
      } else throw new Error('Unexpected GIF block');
    }
    expect(delays.length).toBeGreaterThan(100);
    expect([...new Set(delays)]).toEqual([4]);
  });

  it('distinguishes edited highlights from complete submission readiness', () => {
    const readme = read('README.md').toString();
    // The concise README links the detailed recording limitations rather than
    // duplicating them beneath every preview.
    expect(readme).toContain('](docs/media/README.md#biorxiv)');
    expect(readme).toContain('](docs/media/README.md#editorial-manager--plos-genetics)');
    const notes = read('docs/media/README.md').toString().replace(/\s+/g, ' ');
    expect(notes).toContain("including the portal's transient lookup warnings");
    expect(notes).toContain('Save / Continue was not clicked');
    expect(notes).toContain('persistent review notice remain visible');
    expect(notes).toContain('Institutional verification remains manual');
    expect(readme).not.toMatch(/docs\/media\/[^\s"()]+\.mov/);
  });
});
