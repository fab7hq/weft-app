// Weft owns an agent's size (ADR-0038, remote.md §9); the app mirrors it. An
// agent is drawn at the size its frames carry: narrower than its pane at the
// normal 13 px, the rest empty (D3.14); wider, smaller to fit, down to 9 px,
// and past that it scrolls sideways (M3.14). The app never sends a `size`.
import { expect, test, type Page } from '@playwright/test';
import { FakeMachine, atlas } from './fake-machine';
import { openAgent } from './open';
import { person, signIn } from './seed';

const CODEX = '3f9a1c07b2de-1';

/** A whole screen of `rows` lines, each `cols` wide. */
function frame(rows: number, cols: number) {
  const text = Array.from({ length: rows }, (_, i) => `${String(i).padStart(3)} ${'x'.repeat(cols - 5)}|`).join('\r\n');
  return { type: 'screen', agent: CODEX, seq: 1, full: true, rows, cols, bytes: Buffer.from(text).toString('base64') };
}

/** The text size it is drawn at, and how it sits in its area. */
async function drawn(page: Page) {
  await page.waitForTimeout(400);
  return page.evaluate(() => {
    const host = document.querySelector('.pane-screen') as HTMLElement;
    const rows = document.querySelector('.xterm-rows') as HTMLElement;
    const screen = document.querySelector('.xterm-screen')!.getBoundingClientRect();
    return {
      font: parseFloat(getComputedStyle(rows).fontSize),
      width: screen.width / host.clientWidth,
      sideways: host.scrollWidth > host.clientWidth + 1,
      bar: Boolean(document.querySelector('.pane-bar--h')),
    };
  });
}

async function opened(page: Page, context: Parameters<typeof signIn>[0]) {
  const machine = await FakeMachine.start();
  Object.assign(machine, atlas());
  await signIn(context, person('octo', [{ name: 'studio', address: machine.address }]));
  await page.goto('/');
  await openAgent(page, 'codex · health endpoint');
  await expect.poll(() => machine.of('watch').at(-1)?.agent).toBe(CODEX);
  await page.evaluate(() => document.fonts.ready);
  return machine;
}

test('D3.14 M3.14: an agent is drawn at its own size: narrower at 13 px; wider, smaller down to 9 px, then sideways', async ({ page, context }) => {
  const machine = await opened(page, context);
  const phone = page.viewportSize()!.width < 768;

  // Narrower than the pane: the normal text size, the rest of the pane empty.
  machine.send(frame(20, 30));
  const narrow = await drawn(page);
  expect(narrow.font, JSON.stringify(narrow)).toBe(13);
  expect(narrow.width, JSON.stringify(narrow)).toBeLessThan(0.95);
  expect(narrow.sideways).toBe(false);

  // Far wider: the readable minimum, and the rest to the right.
  machine.send(frame(30, 220));
  const wide = await drawn(page);
  expect(wide.font, JSON.stringify(wide)).toBe(9);
  expect(wide.sideways, JSON.stringify(wide)).toBe(true);
  // On a phone a bar says how much is to the right (M3.14).
  expect(wide.bar).toBe(phone);

  // A little wider: smaller to fit, between the two, nothing to the right.
  const cols = phone ? 46 : 120;
  machine.send(frame(20, cols));
  const fitted = await drawn(page);
  expect(fitted.font, JSON.stringify(fitted)).toBeGreaterThanOrEqual(9);
  expect(fitted.font, JSON.stringify(fitted)).toBeLessThanOrEqual(13);
  expect(fitted.sideways, JSON.stringify(fitted)).toBe(false);
  await machine.close();
});

test('ADR-0038: typing sends no size; the agent keeps the Mac\'s', async ({ page, context }) => {
  const machine = await opened(page, context);
  machine.send(frame(24, 80));
  machine.send({ type: 'control', agent: CODEX, by: 'you' });
  // A key, from the key bar on a phone; a message on a desktop.
  if (await page.getByRole('toolbar', { name: 'Keys' }).count()) {
    await page.getByRole('toolbar', { name: 'Keys' }).getByRole('button', { name: 'Tab', exact: true }).click();
    await expect.poll(() => machine.of('keys').length).toBe(1);
  } else {
    await page.getByLabel('Message').fill('hello');
    await page.getByRole('button', { name: 'Send' }).click();
    await expect.poll(() => machine.of('text').length).toBe(1);
  }
  expect(machine.of('size')).toHaveLength(0);
  await machine.close();
});
