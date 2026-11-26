import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';

const entry = 'plugins/game-activity-toggle/index.js';
const source = await readFile(entry, 'utf8');
const banner = source.split('\n').filter(line => line.startsWith('// @')).join('\n');
await build({
  entryPoints: [entry],
  outfile: 'dist/game-activity-toggle.js',
  bundle: true,
  format: 'iife',
  platform: 'neutral',
  target: 'es2023',
  banner: { js: banner },
});
