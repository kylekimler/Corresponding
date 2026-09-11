// Edit decision list for the September 11, 2026 macOS recording.
// Raw footage contains account information: keep it outside the repository.
// Usage: node scripts/render-scholarone-demo.mjs /absolute/path/to/recording.mov
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const source = process.argv[2];
if (!source) throw new Error('Supply the original macOS recording path.');
const probe = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0',
  '-show_entries', 'stream=width,height:format=duration', '-of', 'json', source],
{ encoding: 'utf8' });
if (probe.status !== 0) throw new Error('Could not inspect the source recording.');
const metadata = JSON.parse(probe.stdout);
if (metadata.streams[0]?.width !== 2464 || metadata.streams[0]?.height !== 1622 ||
    Number(metadata.format?.duration) < 158) {
  throw new Error('This edit requires the original 2464 × 1622 recording, at least 158 seconds long.');
}
const destination = resolve(process.argv[3] ?? 'docs/media');
mkdirSync(destination, { recursive: true });

// No speed changes. Idle intervals and some repeated dialog cycles are cut.
// Coordinates refer to the original 2464 × 1622 selected-region recording.
const shots = [
  { start: 21.2, end: 25.6 }, // Homepage → Create manuscript
  { start: 39.2, end: 44.3 }, // Title and spreadsheet paste
  { start: 48.9, end: 51.8 }, // Import into structured authors
  { start: 64, end: 67 }, // Successful extension sync
  {
    start: 115.8, end: 118.1, // Explicit contextual Fill click
    filter: [
      // Redact the pre-existing submitting author's identity and contact data.
      'drawbox=x=1210:y=300:w=1180:h=135:color=0xe8e8e8:t=fill',
      'drawbox=x=1210:y=1063:w=590:h=42:color=0xe8e8e8:t=fill',
      // ScholarOne scrolls to the top immediately after the click; the existing
      // author then appears at the bottom edge during the transition.
      'drawbox=x=1210:y=1510:w=1180:h=112:color=0xe8e8e8:t=fill',
    ].join(','),
  },
  {
    start: 119.4, end: 124.4,
    // Reframe the real dialog; exclude account header and background roster.
    filter: 'crop=1500:1120:490:300',
  },
  {
    start: 154, end: 158,
    // Only the three synthetic coauthors; retain institutional warning icons.
    filter: 'crop=1800:1200:650:384',
  },
];

function run(args) {
  const result = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'warning', ...args], {
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`ffmpeg failed (${result.status})`);
}

const inputs = shots.flatMap(({ start, end }) => [
  '-ss', String(start), '-t', String(end - start), '-i', source,
]);
const filters = shots.map(({ filter }, i) =>
  `[${i}:v]setpts=PTS-STARTPTS,${filter ? `${filter},` : ''}` +
  'fps=15,scale=960:640:force_original_aspect_ratio=decrease:flags=lanczos,' +
  `pad=960:640:(ow-iw)/2:(oh-ih)/2:color=0xf3f1e9,setsar=1[v${i}]`,
);
filters.push(shots.map((_, i) => `[v${i}]`).join('') +
  `concat=n=${shots.length}:v=1:a=0,format=yuv420p[out]`);
const movie = resolve(destination, 'scholarone-workflow.mp4');
run(['-y', ...inputs, '-filter_complex', filters.join(';'), '-map', '[out]',
  '-an', '-map_metadata', '-1', '-c:v', 'libx264', '-crf', '19',
  '-preset', 'slow', '-movflags', '+faststart', movie]);
run(['-y', '-i', movie, '-filter_complex',
  '[0:v]split[a][b];[a]palettegen=stats_mode=diff[p];' +
  '[b][p]paletteuse=dither=bayer:bayer_scale=3:diff_mode=rectangle',
  '-an', '-map_metadata', '-1', '-loop', '0',
  resolve(destination, 'scholarone-workflow.gif')]);
