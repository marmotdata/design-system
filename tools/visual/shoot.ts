/**
 * Screenshots stories from a built Storybook in Light and Peat.
 *   node shoot.ts --static ../../apps/storybook/storybook-static --filter "foundations-" --out ./shots
 * Also the visual-regression runner: --compare <baselineDir> fails on pixel differences.
 */
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { createRequire } from 'node:module';
import { serve } from './serve.ts';

const require = createRequire(resolve('../../apps/storybook/package.json'));
const { chromium } = require('playwright') as typeof import('playwright');

const { values } = parseArgs({
  options: {
    static: { type: 'string', default: '../../apps/storybook/storybook-static' },
    filter: { type: 'string', default: '' },
    out: { type: 'string', default: './shots' },
    themes: { type: 'string', default: 'light,dark' },
    width: { type: 'string', default: '1440' },
    height: { type: 'string', default: '900' },
    full: { type: 'boolean', default: false },
    compare: { type: 'string', default: '' },
    update: { type: 'boolean', default: false },
  },
});

const root = resolve(values.static!);
const server = await serve(root);
const port = (server.address() as import('node:net').AddressInfo).port;
const index = JSON.parse(await readFile(join(root, 'index.json'), 'utf8')) as { entries: Record<string, { id: string; type: string; title: string; name: string; tags?: string[] }> };
const filters = values.filter!.split(',').filter(Boolean);
const stories = Object.values(index.entries).filter((e) => e.type === 'story' && (!filters.length || filters.some((f) => e.id.startsWith(f))));
await mkdir(values.out!, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: Number(values.width), height: Number(values.height) }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
const page = await ctx.newPage();
const errors: string[] = [];
page.on('pageerror', (e) => errors.push(e.message));
let n = 0;
for (const s of stories) {
  for (const theme of values.themes!.split(',')) {
    const url = `http://localhost:${port}/iframe.html?id=${s.id}&viewMode=story&globals=theme:${theme};motion:reduce`;
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(250);
    await page.screenshot({ path: join(values.out!, `${s.id}--${theme}.png`), fullPage: values.full });
    n++;
  }
}
await browser.close();
server.close();
console.log(`shot ${n} images of ${stories.length} stories into ${values.out}`);
if (errors.length) console.log('page errors:\n' + [...new Set(errors)].join('\n'));

/*
 * Visual regression: compare every shot with its baseline (Git LFS). Fails on any pixel difference
 * beyond anti-aliasing noise. `--update` copies the current shots over the baselines after review.
 */
if (values.compare) {
  const { PNG } = await import('pngjs');
  const pixelmatch = (await import('pixelmatch')).default;
  const { copyFile } = await import('node:fs/promises');
  const baseDir = resolve(values.compare);
  const diffDir = resolve('./diffs');
  await mkdir(diffDir, { recursive: true });
  await mkdir(baseDir, { recursive: true });
  const failed: string[] = [];
  const added: string[] = [];
  for (const file of (await readdir(values.out!)).filter((f) => f.endsWith('.png'))) {
    const cur = join(values.out!, file);
    const base = join(baseDir, file);
    if (values.update) {
      await copyFile(cur, base);
      continue;
    }
    if (!existsSync(base)) {
      added.push(file);
      continue;
    }
    const a = PNG.sync.read(await readFile(base));
    const b = PNG.sync.read(await readFile(cur));
    if (a.width !== b.width || a.height !== b.height) {
      failed.push(`${file} (size ${a.width}×${a.height} → ${b.width}×${b.height})`);
      continue;
    }
    const diff = new PNG({ width: a.width, height: a.height });
    const px = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold: 0.1 });
    if (px > 0) {
      failed.push(`${file} (${px} px)`);
      await writeFile(join(diffDir, file), PNG.sync.write(diff));
    }
  }
  if (values.update) console.log(`visual: baselines updated in ${baseDir}`);
  else {
    if (added.length) console.log(`visual: ${added.length} new stories without a baseline (run with --update after review)`);
    if (failed.length) {
      console.error(`visual: ${failed.length} differences\n  ${failed.join('\n  ')}`);
      process.exit(1);
    }
    console.log('visual: no differences');
  }
}
