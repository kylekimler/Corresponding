// September 11, 2026 macOS recordings. These timecodes and privacy masks are
// specific to the originals, NOT a general-purpose redactor. Review every edit.
// Usage: node scripts/render-publisher-demos.mjs biorxiv|plos /path/to/source.mov [output-dir]
// Raw footage contains private account data and must stay outside Git.
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const [portal, source, output = 'docs/media'] = process.argv.slice(2);
if (!['biorxiv', 'plos'].includes(portal) || !source) {
  throw new Error('Supply biorxiv|plos and the original macOS recording path.');
}
const probe = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0',
  '-show_entries', 'stream=width,height:format=duration', '-of', 'json', source],
{ encoding: 'utf8' });
if (probe.status !== 0) throw new Error('Could not inspect the source recording.');
const metadata = JSON.parse(probe.stdout);
const [width, height, duration] = portal === 'biorxiv' ? [2758, 1876, 68.7] : [1908, 1704, 80.2];
if (metadata.streams[0]?.width !== width || metadata.streams[0]?.height !== height ||
    Number(metadata.format?.duration) < duration || Number(metadata.format?.duration) > duration + 0.2) {
  throw new Error(`This edit requires the original ${width} × ${height} recording (${duration} seconds).`);
}
const destination = resolve(output);
mkdirSync(destination, { recursive: true });

function run(args) {
  const result = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'warning', ...args], { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`ffmpeg failed (${result.status})`);
}

// Mask before scaling/cropping. Absolute source time is translated to each shot.
function mask(start, x, y, w, h, from, to) {
  const enabled = from === undefined ? '' : `:enable='between(t,${from - start},${to - start})'`;
  return `drawbox=x=${x}:y=${y}:w=${w}:h=${h}:color=0xe8e8e8:t=fill${enabled}`;
}
function bioPrivacy(start) {
  return [
    mask(start, 390, 142, 260, 45, 0, 24.7), // Account menu identity
    mask(start, 390, 142, 260, 45, 31.1, 37),
    mask(start, 390, 367, 355, 45, 0, 24.7), // Private draft identifier
    mask(start, 390, 367, 355, 45, 31.1, 37),
    // Native Chrome address suggestions: personal contact data, not Corresponding.
    mask(start, 1005, 785, 520, 365, 24.35, 24.85),
    mask(start, 450, 675, 510, 350, 27.3, 28.05),
    mask(start, 450, 675, 510, 350, 29.55, 30.3),
    // Saved institution suggestion, below the institution field itself.
    mask(start, 465, 1525, 510, 95, 24.95, 26.45),
    mask(start, 465, 1525, 510, 95, 27.75, 28.1),
    mask(start, 465, 1525, 510, 95, 30.05, 30.45),
  ].join(',');
}

function render(shots, filename, outWidth = 960, outHeight = 640) {
  const inputs = shots.flatMap(({ start, end }) => ['-ss', String(start), '-t', String(end - start), '-i', source]);
  const filters = shots.map(({ filter = '' }, i) =>
    `[${i}:v]setpts=PTS-STARTPTS,${filter ? `${filter},` : ''}` +
    `fps=15,scale=${outWidth}:${outHeight}:force_original_aspect_ratio=decrease:flags=lanczos,` +
    `pad=${outWidth}:${outHeight}:(ow-iw)/2:(oh-ih)/2:color=0xf3f1e9,setsar=1[v${i}]`);
  filters.push(shots.map((_, i) => `[v${i}]`).join('') + `concat=n=${shots.length}:v=1:a=0,format=yuv420p[out]`);
  run(['-y', ...inputs, '-filter_complex', filters.join(';'), '-map', '[out]',
    '-an', '-map_metadata', '-1', '-c:v', 'libx264', '-crf', '19', '-preset', 'slow',
    '-movflags', '+faststart', resolve(destination, filename)]);
}
function gif(movie, filename) {
  run(['-y', '-i', resolve(destination, movie), '-filter_complex',
    '[0:v]split[a][b];[a]palettegen=stats_mode=diff[p];' +
    '[b][p]paletteuse=dither=bayer:bayer_scale=3:diff_mode=rectangle',
    '-an', '-map_metadata', '-1', '-loop', '0', resolve(destination, filename)]);
}

if (portal === 'biorxiv') {
  // The continuous MP4 retains ALL author-entry cycles and transient lookup
  // warnings. Only idle lead/tail are trimmed; no speed changes or time jumps.
  render([{ start: 22.8, end: 37, filter: bioPrivacy(22.8) }], 'biorxiv-workflow.mp4', 1200, 816);
  // Condensed GIF: click → first author → final roster. Caption discloses cuts.
  render([
    { start: 22.8, end: 24.6, filter: `${bioPrivacy(22.8)},crop=2380:750:0:1120` },
    { start: 24.7, end: 26.4, filter: `${bioPrivacy(24.7)},crop=2200:1240:250:490` },
    { start: 33, end: 37, filter: 'crop=1590:735:800:1140' },
  ], 'biorxiv-highlights.mp4');
  gif('biorxiv-highlights.mp4', 'biorxiv-workflow.gif');
} else {
  // Condensed GIF/MP4 at original speed. First/last crops retain the actual
  // contextual UI, original author's (redacted) row, and institutional warnings.
  render([
    { start: 22.8, end: 24.2667, filter: `${mask(22.8, 670, 1190, 725, 82)},crop=1470:664:0:1040` },
    // Real first-author dialog; background existing identity is outside crop.
    { start: 24.3, end: 26.8, filter: 'crop=1260:1300:630:380' },
    { start: 34, end: 38.5, filter: `${mask(34, 670, 1152, 725, 82)},crop=1470:664:0:1040` },
  ], 'plos-genetics-workflow.mp4');
  gif('plos-genetics-workflow.mp4', 'plos-genetics-workflow.gif');
}
