import { build } from 'esbuild';
import { readFile, readdir, mkdir, copyFile, writeFile } from 'node:fs/promises';

const catalog = [];
await mkdir('catalog', { recursive: true });

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
  const metadata = Object.fromEntries([...source.matchAll(/^\/\/ @(\w+) (.+)$/gm)].map(match => [match[1], match[2]]));
  await copyFile(`dist/${plugin.name}.js`, `catalog/${plugin.name}.js`);
  catalog.push({ name: plugin.name, description: metadata.description, version: metadata.version, author: metadata.author });
}
await writeFile('catalog/index.json', JSON.stringify(catalog, null, 2) + '\n');

await build({entryPoints: ['plugins/game-activity-toggle/proto.ts', 'plugins/game-activity-toggle/controller.ts'], outdir: '.test-build', bundle: true, format: 'esm', platform: 'neutral', target: 'es2023'});
