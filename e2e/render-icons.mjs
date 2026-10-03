// Renders web/public/icons/*.png from the Weft mark, for the manifest and
// the Home Screen. Run once when the mark changes: node e2e/render-icons.mjs
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';

const svg = readFileSync(new URL('../web/public/icons/weft-mark.svg', import.meta.url), 'utf8');
const browser = await chromium.launch();
for (const [name, size, inset] of [['icon-192.png', 192, 0], ['icon-512.png', 512, 0], ['apple-touch-icon.png', 180, 0], ['icon-maskable-512.png', 512, 0.12]]) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  const pad = Math.round(size * inset);
  await page.setContent(`<body style="margin:0;background:#090d16"><div style="padding:${pad}px;width:${size - 2 * pad}px;height:${size - 2 * pad}px">${svg.replace('<svg ', '<svg style="width:100%;height:100%" ')}</div></body>`);
  await page.screenshot({ path: new URL(`../web/public/icons/${name}`, import.meta.url).pathname });
  await page.close();
}
await browser.close();
