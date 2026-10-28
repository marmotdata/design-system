/**
 * Sets one version on every public package (they always release together):
 *
 *   pnpm bump 0.1.1
 *
 * Then commit, tag `v0.1.1` and push the tag; the Release workflow publishes it.
 */
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const version = process.argv[2];
if (!version || !/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(version)) {
  console.error('Usage: pnpm bump <version>, e.g. pnpm bump 0.1.1');
  process.exit(1);
}
const root = fileURLToPath(new URL('../..', import.meta.url));
for (const dir of readdirSync(join(root, 'packages')).sort()) {
  const path = join(root, 'packages', dir, 'package.json');
  if (!existsSync(path)) continue;
  const src = readFileSync(path, 'utf8');
  const pkg = JSON.parse(src) as { name: string; version: string; private?: boolean };
  if (pkg.private) continue;
  // Replace only the version line, so the file keeps its formatting.
  writeFileSync(path, src.replace(/"version":\s*"[^"]*"/, `"version": "${version}"`));
  console.log(`${pkg.name} ${pkg.version} → ${version}`);
}
