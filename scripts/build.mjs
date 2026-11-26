import { build } from 'esbuild';
import { readFile, readdir } from 'node:fs/promises';

for (const plugin of await readdir('plugins', { withFileTypes: true })) {
  if (!plugin.isDirectory()) continue;
  const entry = `plugins/${plugin.name}/index.ts`;
  const source = await readFile(entry, 'utf8');
  const banner = source.split('\n').filter(line => line.startsWith('// @')).join('\n');
  await build({
    entryPoints: [entry],
    outfile: `dist/${plugin.name}.js`,
    bundle: true,
    format: 'iife',
    platform: 'neutral',
    target: 'es2023',
    banner: { js: banner },
  });
}

await build({entryPoints: ['plugins/game-activity-toggle/proto.ts', 'plugins/game-activity-toggle/controller.ts'], outdir: '.test-build', bundle: true, format: 'esm', platform: 'neutral', target: 'es2023'});
