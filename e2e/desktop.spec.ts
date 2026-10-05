// Step 39, web-app.md §11 test 4: on a desktop the list sits beside the
// agent; typing in the screen sends keys; Cmd shortcuts stay the browser's.
import { expect, test } from '@playwright/test';
import { FakeMachine, agent } from './fake-machine';
import { person, signIn } from './seed';

const decoded = (m: Record<string, unknown>) => Buffer.from(String(m.bytes), 'base64').toString('latin1');

test('the list beside the agent; typing goes to the agent; Cmd+R stays the browser\'s', async ({ page, context }) => {
  const machine = await FakeMachine.start();
  machine.agents = [agent(0, 'weft', 'claude-code', 'waiting'), agent(1, 'docs', 'codex', 'ready')];
  await signIn(context, person('octo', [{ name: 'studio', address: machine.address }]));
  await page.goto('/');
  await expect(page.getByText('Pick an agent')).toBeVisible();
  await page.getByText('weft · Claude Code').click();

  const list = page.getByRole('navigation', { name: 'Agents' });
  const screen = page.getByLabel("The agent's screen");
  await expect(list).toBeVisible();
  await expect(screen).toBeVisible();
  const [l, s] = [await list.boundingBox(), await screen.boundingBox()];
  expect(l!.x + l!.width).toBeLessThanOrEqual(s!.x);
  expect(l!.width).toBe(360);
  await expect(list.locator('.fab7-row--open')).toHaveText(/weft · Claude Code/);

  await screen.click();
  await page.keyboard.type('ls');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Control+C');
  await page.keyboard.press('ArrowUp');
  await expect.poll(() => machine.of('keys').map(decoded).join('')).toBe('ls\r\x03\x1b[A');
  expect(machine.of('size')).toHaveLength(1);

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
  await page.getByText('weft · Claude Code', { exact: true }).click();
  await expect.poll(() => machine.of('watch').length).toBeGreaterThan(0);
}

test('step 51: wide, the TUI\'s bar under the list and the pane; Ctrl+] gives the keys to Weft', async ({ page, context }) => {
  const machine = await FakeMachine.start();
  machine.agents = [agent(0, 'weft', 'claude-code', 'ended')];
  await signIn(context, person('octo', [{ name: 'studio', address: machine.address }]));
  await opened(page, machine);
  const bar = page.getByRole('toolbar', { name: 'Weft' });
  await expect(bar).toContainText('[A]SK');
  await expect(bar).toContainText('[W]EFT ⌄');
  // The bar spans the list and the pane.
  const list = (await page.getByRole('navigation', { name: 'Agents' }).boundingBox())!;
  const span = (await bar.boundingBox())!;
  expect(span.x).toBeLessThanOrEqual(list.x + 1);

  // The pane has the keys: everything goes to the agent; the bar says how to leave.
  await page.getByLabel("The agent's screen").click();
  await expect(bar).toContainText('Ctrl+]  BACK TO WEFT');
  await page.keyboard.type('x');
  await expect.poll(() => machine.of('keys').map((k) => hex(k.bytes))).toEqual(['78']);

  // Ctrl+] gives the keys to Weft: then a is Ask, and nothing reaches the agent.
  await page.keyboard.press('Control+BracketRight');
  await expect(bar).toContainText('[A]SK');
  await page.keyboard.press('a');
  await expect(page.getByLabel('What do you want done?')).toBeFocused();
  expect(machine.of('keys').map((k) => hex(k.bytes))).toEqual(['78']);
  await page.getByRole('button', { name: 'Cancel' }).click();

  // A click on the pane gives the keys back to the agent.
  await page.getByLabel("The agent's screen").click();
  await page.keyboard.type('y');
  await expect.poll(() => machine.of('keys').map((k) => hex(k.bytes))).toEqual(['78', '79']);
  await machine.close();
});

test('step 62: a click makes the pane active; the wheel scrolls its history inside it and back to live', async ({ page, context }) => {
  const machine = await FakeMachine.start();
  machine.agents = [agent(0, 'weft', 'claude-code', 'ready')];
  machine.onRead = (m) => ({ type: 'ok', req: m.req, text: Array.from({ length: 200 }, (_, i) => `line ${i + 1}`).join('\n') });
  await signIn(context, person('octo', [{ name: 'studio', address: machine.address }]));
  await opened(page, machine);
  const pane = page.getByLabel('The agent', { exact: true });
  await pane.hover();
  await page.mouse.wheel(0, -300);
  await page.waitForTimeout(300);
  expect(machine.of('read')).toHaveLength(0);

  await pane.click();
  await page.mouse.wheel(0, -300);
  const history = pane.getByLabel('History');
  await expect(history).toBeVisible();
  await expect(history.getByText('line 200')).toBeInViewport();
  // Down past the bottom: live again.
  await page.mouse.wheel(0, 2000);
  await page.mouse.wheel(0, 300);
  await expect(history).toHaveCount(0);
  await machine.close();
});
