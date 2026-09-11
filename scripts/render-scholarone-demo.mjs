// Source-specific September 11 website + re-recorded portal edit.
// Raw footage contains account data; keep originals outside Git.
// Usage: node scripts/render-scholarone-demo.mjs website.mov portal.mov [output-dir]
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const [website, portal, output = 'docs/media'] = process.argv.slice(2);
if (!website || !portal) throw new Error('Supply both original recordings: website, then new portal.');
function check(source, width, height, min, max) {
  const probe = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height:format=duration', '-of', 'json', source], { encoding: 'utf8' });
  if (probe.status !== 0) throw new Error('Could not inspect source recording.');
  const metadata = JSON.parse(probe.stdout);
  const duration = Number(metadata.format?.duration);
  if (metadata.streams[0]?.width !== width || metadata.streams[0]?.height !== height || !Number.isFinite(duration) || duration < min || duration > max) {
    throw new Error(`Wrong source: expected ${width} × ${height}, ${min}–${max} seconds.`);
  }
}
check(website, 2464, 1622, 358, 360);
check(portal, 2368, 1616, 35, 36);
const destination = resolve(output);
mkdirSync(destination, { recursive: true });

// Original speed. Clean website sections replace agent-cursor click footage.
// Portal click → first dialog is continuous; repeated dialogs are omitted.
const shots = [
  { source: website, start: 21.2, end: 23.8 },
  { source: website, start: 41.4, end: 44.3 },
  { source: website, start: 64, end: 67, cleanBackground: true },
  { source: portal, start: 9.7, end: 13.6, filter: [
    // Existing author identity/contact/roles before automatic scrolling.
    "drawbox=x=1190:y=350:w=510:h=100:color=0xe8e8e8:t=fill:enable='lte(t,1.45)'",
    "drawbox=x=1690:y=350:w=460:h=150:color=0xe8e8e8:t=fill:enable='lte(t,1.45)'",
    "drawbox=x=1190:y=1110:w=510:h=70:color=0xe8e8e8:t=fill:enable='lte(t,1.45)'",
    // Existing identity below the modal after automatic scrolling.
    "drawbox=x=1190:y=1410:w=960:h=206:color=0xe8e8e8:t=fill:enable='gte(t,1.3)'",
    // Account menu excluded when page scrolls to its header.
    'crop=2368:1456:0:160',
  ].join(',') },
  { source: portal, start: 28, end: 30,
    filter: 'drawbox=x=1190:y=250:w=650:h=110:color=0xe8e8e8:t=fill,crop=2368:1456:0:160,tpad=stop_mode=clone:stop_duration=1' },
];
function run(args) {
  const result = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'warning', ...args], { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`ffmpeg failed (${result.status})`);
}
const inputs = shots.flatMap(({ source, start, end }) => ['-ss', String(start), '-t', String(end - start), '-i', source]);
const filters = [];
shots.forEach(({ filter, cleanBackground }, i) => {
  let input = `[${i}:v]`;
  if (cleanBackground) {
    // Same-frame clean plate: empty background and horizontal rule ONLY.
    // No fields, status wording, or author information are replaced.
    filters.push(`${input}split[base${i}][plate${i}]`);
    filters.push(`[plate${i}]crop=200:170:1850:1200[clean${i}]`);
    filters.push(`[base${i}][clean${i}]overlay=2100:1200[patched${i}]`);
    input = `[patched${i}]`;
  }
  filters.push(`${input}setpts=PTS-STARTPTS,${filter ? `${filter},` : ''}` +
    'fps=60,scale=960:640:force_original_aspect_ratio=decrease:flags=lanczos,' +
    `pad=960:640:(ow-iw)/2:(oh-ih)/2:color=0xf3f1e9,setsar=1[v${i}]`);
});
filters.push(shots.map((_, i) => `[v${i}]`).join('') + `concat=n=${shots.length}:v=1:a=0,format=yuv420p[out]`);
const movie = resolve(destination, 'scholarone-workflow.mp4');
run(['-y', ...inputs, '-filter_complex', filters.join(';'), '-map', '[out]', '-an', '-map_metadata', '-1',
  '-c:v', 'libx264', '-crf', '18', '-preset', 'slow', '-movflags', '+faststart', movie]);
// Exact 40ms GIF delays instead of alternating 60/70ms at 15 fps.
run(['-y', '-i', movie, '-filter_complex', '[0:v]fps=25,split[a][b];[a]palettegen=stats_mode=diff[p];' +
  '[b][p]paletteuse=dither=bayer:bayer_scale=3:diff_mode=rectangle', '-an', '-map_metadata', '-1',
  '-loop', '0', resolve(destination, 'scholarone-workflow.gif')]);
