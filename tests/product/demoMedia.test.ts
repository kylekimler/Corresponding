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
    expect(gif.byteLength).toBeLessThan(2_000_000);

    const movie = read(moviePath);
    expect(movie.subarray(4, 8).toString()).toBe('ftyp');
    expect(movie.byteLength).toBeLessThan(2_000_000);
  });

  it('distinguishes edited highlights from complete submission readiness', () => {
    const readme = read('README.md').toString();
    expect(readme).toContain('continuous MP4 retains the transient portal lookup warnings');
    expect(readme).toContain('Save / Continue was not clicked');
    expect(readme).toContain('Institution-verification warnings remain visible');
    expect(readme).not.toMatch(/docs\/media\/[^\s"()]+\.mov/);
  });
});
