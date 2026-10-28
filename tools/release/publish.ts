/**
 * Publishes every public package whose version is not on npm yet. Each package is packed with pnpm,
 * which turns `workspace:*` dependencies into real versions, and the tarball is published with npm,
 * whose trusted publishing (OIDC) needs no token in CI.
 *
 *   node tools/release/publish.ts           in CI: publish with provenance
 *   node tools/release/publish.ts --local   the one-off first publish of a new package from a laptop
 *                                           (`npm login` first; provenance needs CI)
 *
 * Prints "New tag: name@version" per package, which changesets/action turns into git tags and releases.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const local = process.argv.includes('--local');
const out = mkdtempSync(join(tmpdir(), 'marmot-release-'));

const published = (name: string, version: string) => {
  try {
    return execFileSync('npm', ['view', `${name}@${version}`, 'version'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() === version;
  } catch {
    return false;
  }
};

for (const dir of readdirSync(join(root, 'packages')).sort()) {
  const pkgPath = join(root, 'packages', dir, 'package.json');
  if (!existsSync(pkgPath)) continue;
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { name: string; version: string; private?: boolean };
  if (pkg.private) continue;
  if (published(pkg.name, pkg.version)) {
    console.log(`${pkg.name}@${pkg.version} is already on npm`);
    continue;
  }
  const before = new Set(readdirSync(out));
  execFileSync('pnpm', ['pack', '--pack-destination', out], { cwd: join(root, 'packages', dir), stdio: 'inherit' });
  const tarball = readdirSync(out).find((f) => !before.has(f) && f.endsWith('.tgz'))!;
  const args = ['publish', join(out, tarball), '--access', 'public', ...(local ? ['--provenance=false'] : ['--provenance'])];
  execFileSync('npm', args, { stdio: 'inherit' });
  console.log(`New tag: ${pkg.name}@${pkg.version}`);
}
