// Phase 6 slice J, web-app.md §4, §6, §7: the controls, as the TUI. Under the
// pane one row, [⌃] Message… [▶]; the TUI's bar is a sheet behind ⌃.
import { expect, test, type Page } from '@playwright/test';
import { FakeMachine, agent } from './fake-machine';
import { person, signIn } from './seed';

async function opened(page: Page, machine: FakeMachine) {
  await page.goto('/');
  await page.getByRole('treeitem', { name: 'claude-code', exact: true }).first().click();
  await expect.poll(() => machine.of('watch').length).toBeGreaterThan(0);
}

test('step 45: one row under the pane; the bar is a sheet behind ⌃', async ({ page, context }, info) => {
  test.skip(info.project.name !== 'iphone', 'the phone layout');
  const machine = await FakeMachine.start();
  machine.agents = [agent(0, 'weft', 'claude-code', 'ready')];
  await signIn(context, person('octo', [{ name: 'studio', address: machine.address }]));
  await opened(page, machine);

  // Nothing but the row: no acts, no key bar, until the bar is opened.
  await expect(page.getByRole('button', { name: 'Ask', exact: true })).toHaveCount(0);
  await expect(page.getByRole('toolbar', { name: 'Keys' })).toHaveCount(0);
  await expect(page.getByLabel('Message')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeVisible();
  // The pane has the height the row gave back.
  const pane = await page.getByLabel("The agent's screen").boundingBox();
  const viewport = page.viewportSize()!;
  expect(pane!.height / viewport.height).toBeGreaterThan(0.6);

  await page.getByRole('button', { name: 'The bar', exact: true }).click();
  const bar = page.getByRole('dialog', { name: 'Weft' });
  await expect(bar).toBeVisible();
  await expect(bar.getByRole('button', { name: 'Ask', exact: true })).toHaveText('[A]SK');
  await expect(bar.getByRole('toolbar', { name: 'Keys' })).toBeVisible();

  // No [L]IST [H]ISTORY [W]EFT row: the sheet is the acts and the keys.
  for (const name of ['List', 'History', 'Weft']) await expect(bar.getByRole('button', { name, exact: true })).toHaveCount(0);
  await machine.close();
});

const hex = (b64: unknown) => [...Buffer.from(String(b64), 'base64')].map((b) => b.toString(16).padStart(2, '0')).join(' ');

test('step 46: sticky modifiers: Ctrl then r sends ^R, a double tap locks, ⇧ then Tab', async ({ page, context }, info) => {
  test.skip(info.project.name !== 'iphone', 'the phone layout');
  const machine = await FakeMachine.start();
  machine.agents = [agent(0, 'weft', 'claude-code', 'ready')];
  await signIn(context, person('octo', [{ name: 'studio', address: machine.address }]));
  await opened(page, machine);
  const keysSent = () => machine.of('keys').map((k) => hex(k.bytes));

  // Ctrl lit once, then a letter typed: one key, nothing in the message box, Ctrl off.
  await page.getByRole('button', { name: 'The bar', exact: true }).click();
  const bar = page.getByRole('dialog', { name: 'Weft' });
  const ctrl = bar.getByRole('button', { name: 'Ctrl', exact: true });
  await ctrl.click();
  await expect(ctrl).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Escape');
  await page.getByLabel('Message').pressSequentially('r');
  await expect.poll(keysSent).toEqual(['12']);
  await expect(page.getByLabel('Message')).toHaveValue('');
  await page.getByLabel('Message').pressSequentially('s');
  await expect(page.getByLabel('Message')).toHaveValue('s');
  await page.getByLabel('Message').fill('');

  // Two taps lock it: every letter is a key until it is tapped off.
  await page.getByRole('button', { name: 'The bar', exact: true }).click();
  await ctrl.click();
  await ctrl.click();
  await expect(ctrl).toHaveAttribute('data-lit', 'locked');
  await page.keyboard.press('Escape');
  await page.getByLabel('Message').pressSequentially('ox');
  await expect.poll(keysSent).toEqual(['12', '0f', '18']);
  await page.getByRole('button', { name: 'The bar', exact: true }).click();
  await ctrl.click();
  await expect(ctrl).toHaveAttribute('aria-pressed', 'false');

  // ⇧ then Tab, and the arrows the bar now has.
  await bar.getByRole('button', { name: '⇧', exact: true }).click();
  await bar.getByRole('button', { name: 'Tab', exact: true }).click();
  await bar.getByRole('button', { name: 'Left', exact: true }).click();
  await expect.poll(keysSent).toEqual(['12', '0f', '18', '1b 5b 5a', '1b 5b 44']);
  await machine.close();
});

test('step 47: the key bar rides on the keyboard while the message box has focus', async ({ page, context }, info) => {
  test.skip(info.project.name !== 'iphone', 'the phone layout');
  const machine = await FakeMachine.start();
  machine.agents = [agent(0, 'weft', 'claude-code', 'ready')];
  await signIn(context, person('octo', [{ name: 'studio', address: machine.address }]));
  await opened(page, machine);
  const keys = page.getByRole('toolbar', { name: 'Keys' });
  await expect(keys).toHaveCount(0);

  await page.getByLabel('Message').focus();
  await expect(keys).toBeVisible();
  // Just above the message row.
  const bar = (await keys.boundingBox())!;
  const row = (await page.getByLabel('Message').boundingBox())!;
  expect(bar.y + bar.height).toBeLessThanOrEqual(row.y + 1);
  // A key from it reaches the agent and leaves the keyboard up.
  await keys.getByRole('button', { name: 'Up', exact: true }).click();
  await expect.poll(() => machine.of('keys').map((k) => hex(k.bytes))).toEqual(['1b 5b 41']);
  await expect(page.getByLabel('Message')).toBeFocused();

  await page.getByLabel('Message').blur();
  await expect(keys).toHaveCount(0);
  await machine.close();
});

test('step 48: while the agent waits, the answer strip offers 1 2 3 Esc ⏎', async ({ page, context }, info) => {
  test.skip(info.project.name !== 'iphone', 'the phone layout');
  const machine = await FakeMachine.start();
  machine.agents = [agent(0, 'weft', 'claude-code', 'working')];
  await signIn(context, person('octo', [{ name: 'studio', address: machine.address }]));
  await opened(page, machine);
  const strip = page.getByRole('toolbar', { name: 'Answer' });
  await expect(strip).toHaveCount(0);

  machine.agents = [agent(0, 'weft', 'claude-code', 'waiting')];
  machine.send({ type: 'agents', agents: machine.agents });
  await expect(strip).toBeVisible();
  await expect(strip.getByText('NEEDS YOU')).toBeVisible();
  expect(await strip.getByRole('button').allTextContents()).toEqual(['1', '2', '3', 'Esc', '⏎']);
  await strip.getByRole('button', { name: '1', exact: true }).click();
  await strip.getByRole('button', { name: 'Enter', exact: true }).click();
  await expect.poll(() => machine.of('keys').map((k) => hex(k.bytes))).toEqual(['31', '0d']);

  machine.agents = [agent(0, 'weft', 'claude-code', 'working')];
  machine.send({ type: 'agents', agents: machine.agents });
  await expect(strip).toHaveCount(0);
  await machine.close();
});

test('step 50: the open agents as tabs; the one that needs you is amber; a tap opens it', async ({ page, context }, info) => {
  test.skip(info.project.name === 'desktop-push', 'covered by desktop');
  const machine = await FakeMachine.start();
  machine.agents = [agent(0, 'weft', 'claude-code', 'working'), agent(1, 'docs', 'codex', 'waiting')];
  await signIn(context, person('octo', [{ name: 'studio', address: machine.address }]));
  await opened(page, machine);
  const tabs = page.getByRole('navigation', { name: 'Tabs' });
  await expect(tabs.getByRole('button')).toHaveText(['1 claude-code', '2 codex ●']);
  const first = tabs.getByRole('button', { name: /^1 / });
  const second = tabs.getByRole('button', { name: /^2 / });
  await expect(first).toHaveAttribute('aria-current', 'page');
  await expect(second).toHaveAttribute('data-needs-you', 'true');
  await expect(first).not.toHaveAttribute('data-needs-you', 'true');

  await second.click();
  await expect.poll(() => machine.of('watch').at(-1)).toEqual({ type: 'watch', agent: '3f9a1c07b2de-1' });
  await expect(second).toHaveAttribute('aria-current', 'page');
  if (info.project.name === 'iphone') {
    // A tab replaces the open agent: back goes to the list, as the TUI's tabs do.
    await page.goBack();
    await expect(page.getByLabel('Message')).toHaveCount(0);
  }
  await machine.close();
});

/** A finger pulling the element down by `by` pixels: scrolling up. */
async function pull(page: Page, label: string, by: number) {
  await page.getByLabel(label).evaluate((el, by) => {
    const r = el.getBoundingClientRect();
    const at = (y: number) => [new Touch({ identifier: 1, target: el, clientX: r.x + 50, clientY: y })];
    el.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: at(r.y + 40), changedTouches: at(r.y + 40) }));
    el.dispatchEvent(new TouchEvent('touchmove', { bubbles: true, touches: at(r.y + 40 + by), changedTouches: at(r.y + 40 + by) }));
    el.dispatchEvent(new TouchEvent('touchend', { bubbles: true, touches: [], changedTouches: at(r.y + 40 + by) }));
  }, by);
}

test('step 62: the pane, once tapped, scrolls through its history inside itself', async ({ page, context }, info) => {
  test.skip(info.project.name !== 'iphone', 'the phone layout');
  const machine = await FakeMachine.start();
  machine.agents = [agent(0, 'weft', 'claude-code', 'ready')];
  machine.onRead = (m) => ({ type: 'ok', req: m.req, text: Array.from({ length: 200 }, (_, i) => `line ${i + 1}`).join('\n') });
  await signIn(context, person('octo', [{ name: 'studio', address: machine.address }]));
  await opened(page, machine);
  const pane = page.getByLabel('The agent', { exact: true });

  // Inactive: the app is for its buttons; a pull reads nothing.
  await expect(pane).toHaveAttribute('data-active', 'false');
  await pull(page, "The agent's screen", 200);
  await page.waitForTimeout(300);
  expect(machine.of('read')).toHaveLength(0);

  // Tapped: active, and a pull shows the history inside the pane, newest at the bottom.
  await pane.click();
  await expect(pane).toHaveAttribute('data-active', 'true');
  await pull(page, "The agent's screen", 200);
  await expect.poll(() => machine.of('read').length).toBe(1);
  const history = pane.getByLabel('History');
  await expect(history).toBeVisible();
  await expect(history.getByText('line 200')).toBeInViewport();
  const inside = (await history.boundingBox())!;
  const box = (await pane.boundingBox())!;
  expect(inside.y).toBeGreaterThanOrEqual(box.y - 1);
  expect(inside.y + inside.height).toBeLessThanOrEqual(box.y + box.height + 1);
  // The message row is still there: this is the pane, not another view.
  await expect(page.getByLabel('Message')).toBeVisible();

  // LIVE brings the screen back.
  await pane.getByRole('button', { name: 'LIVE' }).click();
  await expect(history).toHaveCount(0);
  await expect(page.getByLabel("The agent's screen")).toBeVisible();
  await machine.close();
});
