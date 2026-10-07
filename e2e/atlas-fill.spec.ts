// The agent's terminal fills its pane (remote.md §9): opening it sends this
// device's size with `watch`; drawn at the Mac's size it is as large as fits,
// and at the device's own size, once the machine gives it, it fills both ways.
import { expect, test, type Page } from '@playwright/test';
import { FakeMachine, atlas } from './fake-machine';
import { person, signIn } from './seed';

const CODEX = '3f9a1c07b2de-1';

/** A whole screen of `rows` lines, each `cols` wide. */
function frame(rows: number, cols: number) {
  const text = Array.from({ length: rows }, (_, i) => `${String(i).padStart(3)} ${'x'.repeat(cols - 5)}|`).join('\r\n');
  return { type: 'screen', agent: CODEX, seq: 1, full: true, rows, cols, bytes: Buffer.from(text).toString('base64') };
}

/** How much of its pane the terminal covers, each way. */
async function covered(page: Page) {
  await page.waitForTimeout(300);
  return page.evaluate(() => {
    const host = document.querySelector('[aria-label="The agent\'s screen"]')!.getBoundingClientRect();
    const drawn = document.querySelector('.xterm-screen')!.getBoundingClientRect();
    return { width: drawn.width / host.width, height: drawn.height / host.height };
  });
}

async function opened(page: Page, context: Parameters<typeof signIn>[0]) {
  const machine = await FakeMachine.start();
  Object.assign(machine, atlas());
  await signIn(context, person('octo', [{ name: 'studio', address: machine.address }]));
  await page.goto('/');
  await page.getByRole('treeitem', { name: 'codex', exact: true }).first().click();
  await expect.poll(() => machine.of('watch').at(-1)?.agent).toBe(CODEX);
  return machine;
}

test('watching at the Mac\'s size, the terminal is as large as fits: one side full, nothing cut off', async ({ page, context }) => {
  const machine = await opened(page, context);
  const watch = machine.of('watch').at(-1)!;
  expect(Number(watch.rows)).toBeGreaterThan(10);
  expect(Number(watch.cols)).toBeGreaterThan(20);
  // A phone fits a wide Mac only below the 5 px floor; there the machine gives it its own size (away).
  const sizes = page.viewportSize()!.width < 768 ? [[30, 100], [24, 80]] : [[30, 100], [44, 158], [24, 80]];
  for (const [rows, cols] of sizes) {
    machine.send(frame(rows, cols));
    const c = await covered(page);
    expect(Math.max(c.width, c.height), `${cols}×${rows}: ${JSON.stringify(c)}`).toBeGreaterThan(0.93);
    expect(Math.max(c.width, c.height), `${cols}×${rows}: ${JSON.stringify(c)}`).toBeLessThanOrEqual(1.001);
  }
  await machine.close();
});

test('at its own size, once the machine gives it, the terminal fills the pane both ways', async ({ page, context }) => {
  const machine = await opened(page, context);
  const first = machine.of('watch').length;
  // As weft remote does with nobody at the Mac: the keys, then a screen at the device's size.
  machine.send({ type: 'control', agent: CODEX, by: 'you' });
  await expect.poll(() => machine.of('watch').length).toBeGreaterThan(first);
  // The size the device gave last: in the Atlas's mono once it has loaded.
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(100);
  const watch = machine.of('watch').at(-1)!;
  machine.send(frame(Number(watch.rows), Number(watch.cols)));
  const c = await covered(page);
  expect(c.width, JSON.stringify(c)).toBeGreaterThan(0.93);
  expect(c.height, JSON.stringify(c)).toBeGreaterThan(0.93);
  expect(Math.max(c.width, c.height), JSON.stringify(c)).toBeLessThanOrEqual(1.001);
  // The size sent before a first key is the one `watch` gave. (On a phone the
  // key comes from ⌃: the message box's focus brings the key bar, and the
  // pane is smaller while it shows.)
  if (await page.getByRole('button', { name: 'The bar', exact: true }).count()) {
    await page.getByRole('button', { name: 'The bar', exact: true }).click();
    await page.getByRole('dialog', { name: 'Weft' }).getByRole('button', { name: 'Tab', exact: true }).click();
  } else {
    await page.getByLabel('Message').fill('hello');
    await page.getByRole('button', { name: 'Send' }).click();
  }
  await expect.poll(() => machine.of('size').length).toBe(1);
  expect(machine.of('size')[0]).toMatchObject({ rows: watch.rows, cols: watch.cols });
  await machine.close();
});
