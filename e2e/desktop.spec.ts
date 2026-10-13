// web-app.md §11 test 4: on a desktop the list sits beside the
// agent; typing in the screen sends keys; Cmd shortcuts stay the browser's.
import { expect, test } from '@playwright/test';
import { FakeMachine, agent } from './fake-machine';
import { openAgent } from './open';
import { person, signIn } from './seed';

const decoded = (m: Record<string, unknown>) => Buffer.from(String(m.bytes), 'base64').toString('latin1');

test('the list beside the agent; typing goes to the agent; Cmd+R stays the browser\'s', async ({ page, context }) => {
  const machine = await FakeMachine.start();
  machine.agents = [agent(0, 'weft', 'claude-code', 'waiting'), agent(1, 'docs', 'codex', 'ready')];
  await signIn(context, person('octo', [{ name: 'studio', address: machine.address }]));
  await page.goto('/');
  await openAgent(page, 'claude-code · no Ask yet');

  const list = page.getByRole('navigation', { name: 'Work' });
  const screen = page.getByLabel("The agent's screen");
  await expect(list).toBeVisible();
  await expect(screen).toBeVisible();
  const [l, s] = [await list.boundingBox(), await screen.boundingBox()];
  expect(l!.x + l!.width).toBeLessThanOrEqual(s!.x);
  // 380 and its line, as the cards draw the list.
  expect(l!.width).toBe(381);

  await screen.click();
  await page.keyboard.type('ls');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Control+C');
  await page.keyboard.press('ArrowUp');
  await expect.poll(() => machine.of('keys').map(decoded).join('')).toBe('ls\r\x03\x1b[A');
  expect(machine.of('size')).toHaveLength(0);

  const before = machine.of('keys').length;
  const waited = page.evaluate(
    () =>
      new Promise<boolean>((done) => {
        addEventListener('keydown', (e) => setTimeout(() => done(e.defaultPrevented)), { once: true });
      }),
  );
  await page.keyboard.press('Meta+R');
  expect(await waited).toBe(false);
  expect(machine.of('keys')).toHaveLength(before);
  await machine.close();
});

const hex = (b64: unknown) => [...Buffer.from(String(b64), 'base64')].map((b) => b.toString(16).padStart(2, '0')).join(' ');

async function opened(page: import('@playwright/test').Page, machine: FakeMachine) {
  await page.goto('/');
  await openAgent(page, 'claude-code · no Ask yet');
  await expect.poll(() => machine.of('watch').length).toBeGreaterThan(0);
}
