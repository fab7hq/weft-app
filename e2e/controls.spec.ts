// web-app.md §4, §6, §7: the controls, as the TUI. Under the
// pane one row, Message… [▶], and the key bar under it; Ask at the top.
import { expect, test, type Page } from '@playwright/test';
import { FakeMachine, agent } from './fake-machine';
import { openAgent } from './open';
import { person, signIn } from './seed';

async function opened(page: Page, machine: FakeMachine) {
  await page.goto('/');
  await openAgent(page, 'claude-code · no Ask yet');
  await expect.poll(() => machine.of('watch').length).toBeGreaterThan(0);
}

test('M3.11: one row under the pane, the key bar under it, Ask at the top', async ({ page, context }, info) => {
  test.skip(info.project.name !== 'iphone', 'the phone layout');
  const machine = await FakeMachine.start();
  machine.agents = [agent(0, 'weft', 'claude-code', 'ready')];
  await signIn(context, person('octo', [{ name: 'studio', address: machine.address }]));
  await opened(page, machine);

  // The row, the key bar under it, and no sheet to open.
  await expect(page.locator('.appbar').getByRole('button', { name: 'Ask', exact: true })).toBeVisible();
  await expect(page.getByLabel('Message')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeVisible();
  const keys = page.getByRole('toolbar', { name: 'Keys' });
  await expect(keys).toBeVisible();
  expect((await keys.boundingBox())!.y).toBeGreaterThan((await page.getByLabel('Message').boundingBox())!.y);
  await expect(page.getByRole('button', { name: 'The bar', exact: true })).toHaveCount(0);
  // The pane keeps most of the screen, in sight above them.
  const pane = await page.getByLabel("The agent's screen").boundingBox();
  const viewport = page.viewportSize()!;
  expect(pane!.height / viewport.height).toBeGreaterThan(0.5);

  // No [L]IST [H]ISTORY [W]EFT row.
  for (const name of ['List', 'History', 'Weft']) await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0);
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
  const bar = page.getByRole('toolbar', { name: 'Keys' });
  const ctrl = bar.getByRole('button', { name: 'Ctrl', exact: true });
  await ctrl.click();
  await expect(ctrl).toHaveAttribute('aria-pressed', 'true');
  await page.getByLabel('Message').pressSequentially('r');
  await expect.poll(keysSent).toEqual(['12']);
  await expect(page.getByLabel('Message')).toHaveValue('');
  await page.getByLabel('Message').pressSequentially('s');
  await expect(page.getByLabel('Message')).toHaveValue('s');
  await page.getByLabel('Message').fill('');

  // Two taps lock it: every letter is a key until it is tapped off.
  await ctrl.click();
  await ctrl.click();
  await expect(ctrl).toHaveAttribute('data-lit', 'locked');
  await page.getByLabel('Message').pressSequentially('ox');
  await expect.poll(keysSent).toEqual(['12', '0f', '18']);
  await ctrl.click();
  await expect(ctrl).toHaveAttribute('aria-pressed', 'false');

  // ⇧ then Tab, and the arrows the bar now has.
  await bar.getByRole('button', { name: '⇧', exact: true }).click();
  await bar.getByRole('button', { name: 'Tab', exact: true }).click();
  await bar.getByRole('button', { name: 'Left', exact: true }).click();
  await expect.poll(keysSent).toEqual(['12', '0f', '18', '1b 5b 5a', '1b 5b 44']);
  await machine.close();
});

test('M3.10: the key bar stays under the message row while the message box has focus, and its keys go to the agent', async ({ page, context }, info) => {
  test.skip(info.project.name !== 'iphone', 'the phone layout');
  const machine = await FakeMachine.start();
  machine.agents = [agent(0, 'weft', 'claude-code', 'ready')];
  await signIn(context, person('octo', [{ name: 'studio', address: machine.address }]));
  await opened(page, machine);
  const keys = page.getByRole('toolbar', { name: 'Keys' });
  await expect(keys).toBeVisible();

  await page.getByLabel('Message').focus();
  await expect(keys).toBeVisible();
  // Under the message row, on top of the keyboard (M3.10).
  const bar = (await keys.boundingBox())!;
  const row = (await page.getByLabel('Message').boundingBox())!;
  expect(bar.y).toBeGreaterThanOrEqual(row.y + row.height - 1);
  // A key from it reaches the agent and leaves the keyboard up.
  await keys.getByRole('button', { name: 'Up', exact: true }).click();
  await expect.poll(() => machine.of('keys').map((k) => hex(k.bytes))).toEqual(['1b 5b 41']);
  await expect(page.getByLabel('Message')).toBeFocused();
  // ⇧ then Tab from the same bar: one ⇧Tab.
  await keys.getByRole('button', { name: '⇧', exact: true }).click();
  await keys.getByRole('button', { name: 'Tab', exact: true }).click();
  await expect.poll(() => machine.of('keys').map((k) => hex(k.bytes))).toEqual(['1b 5b 41', '1b 5b 5a']);
  await expect(page.getByLabel('Message')).toBeFocused();

  // ⌫ deletes in the agent, not in the message box.
  await page.getByLabel('Message').fill('yes');
  await keys.getByRole('button', { name: 'Backspace', exact: true }).click();
  await expect.poll(() => machine.of('keys').map((k) => hex(k.bytes))).toEqual(['1b 5b 41', '1b 5b 5a', '7f']);
  await expect(page.getByLabel('Message')).toHaveValue('yes');

  await page.getByLabel('Message').blur();
  await expect(keys).toBeVisible();
  await machine.close();
});

test('step 50: the open agents as tabs; the one that needs you is amber; a tap opens it', async ({ page, context }, info) => {
  test.skip(info.project.name === 'desktop-push', 'covered by desktop');
  const machine = await FakeMachine.start();
  machine.agents = [agent(0, 'weft', 'claude-code', 'working'), agent(1, 'docs', 'codex', 'waiting')];
  await signIn(context, person('octo', [{ name: 'studio', address: machine.address }]));
  await opened(page, machine);
  const tabs = page.getByRole('navigation', { name: 'Tabs' });
  await expect(tabs.getByRole('button')).toHaveText(['weft · claude-code', 'docs · codex ●']);
  const first = tabs.getByRole('button', { name: /^weft / });
  const second = tabs.getByRole('button', { name: /^docs / });
  await expect(first).toHaveAttribute('aria-current', 'page');
  await expect(second).toHaveAttribute('data-needs-you', 'true');
  await expect(first).not.toHaveAttribute('data-needs-you', 'true');

  await second.click();
  await expect.poll(() => machine.of('watch').at(-1)?.agent).toBe('3f9a1c07b2de-1');
  await expect(second).toHaveAttribute('aria-current', 'page');
  if (info.project.name === 'iphone') {
    // A tab replaces the open agent: back goes to the list, as the TUI's tabs do.
    await page.goBack();
    await expect(page.getByLabel('Message')).toHaveCount(0);
  }
  await machine.close();
});
