// Build the file viewer as a page of its own, viewer.html, for the desktop's
// viewer window, and copy it where the desktop builds it into its binary.
// Its paths are relative: the desktop serves it under weft://app/. WEFT names
// the weft checkout; ../weft by default. `--no-copy` only builds.
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { build } from 'vite';

const out = resolve('web/dist-viewer');
await build({
  configFile: resolve('web/vite.config.ts'),
  root: resolve('web'),
  base: './',
  // Only what the page reads: its words and fonts, not the app's icons or service worker.
  publicDir: false,
  build: { outDir: out, emptyOutDir: true, rollupOptions: { input: resolve('web/viewer.html') } },
  logLevel: 'warn',
});
cpSync('web/public/words.json', resolve(out, 'words.json'));
mkdirSync(resolve(out, 'fonts'), { recursive: true });
for (const f of ['sora-latin.woff2', 'sora-latin-ext.woff2', 'jetbrains-mono-latin.woff2', 'jetbrains-mono-latin-ext.woff2']) cpSync(`web/public/fonts/${f}`, resolve(out, 'fonts', f));
console.log(`viewer built in ${out}`);

if (!process.argv.includes('--no-copy')) {
  const target = resolve(process.env.WEFT ?? '../weft', 'crates/weft-desktop/viewer');
  rmSync(target, { recursive: true, force: true });
  cpSync(out, target, { recursive: true });
  console.log(`viewer copied to ${target}`);
}
