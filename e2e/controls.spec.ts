// web-app.md §4, §6, §7: the controls, as the TUI. Under the
// pane one row, Message… [▶], and the key bar under it; Ask at the top.
import { expect, test, type Page } from '@playwright/test';
import { FakeMachine, agent } from './fake-machine';
import { openAgent, wideOf } from './open';
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

test('the key bar: Fn opens row two; a row-two key, then a row-one key, is one combination; ⌫ held repeats', async ({ page, context }, info) => {
  test.skip(info.project.name !== 'iphone', 'the phone layout');
  const machine = await FakeMachine.start();
  machine.agents = [agent(0, 'weft', 'claude-code', 'ready')];
  await signIn(context, person('octo', [{ name: 'studio', address: machine.address }]));
  await opened(page, machine);
  const keysSent = () => machine.of('keys').map((k) => hex(k.bytes));
  const bar = page.getByRole('toolbar', { name: 'Keys' });
  const key = (name: string) => bar.getByRole('button', { name, exact: true });

  // Row two is closed until Fn opens it.
  await expect(key('Ctrl')).toHaveCount(0);
  await key('Fn').click();
  await expect(key('Fn')).toHaveAttribute('aria-expanded', 'true');
  for (const name of ['Ctrl', 'Alt', 'Tab']) await expect(key(name)).toBeVisible();

  // Ctrl, then a letter typed: one key, nothing in the message box, Ctrl off.
  await key('Ctrl').click();
  await expect(key('Ctrl')).toHaveAttribute('aria-pressed', 'true');
  await page.getByLabel('Message').pressSequentially('r');
  await expect.poll(keysSent).toEqual(['12']);
  await expect(page.getByLabel('Message')).toHaveValue('');
  await expect(key('Ctrl')).toHaveAttribute('aria-pressed', 'false');

  // Ctrl then ←, Tab then →: each one combination, in one send.
  await key('Ctrl').click();
  await key('Left').click();
  await key('Tab').click();
  await key('Right').click();
  await expect.poll(keysSent).toEqual(['12', '1b 5b 31 3b 35 44', '09 1b 5b 43']);
  // A lit Tab tapped again is a Tab.
  await key('Tab').click();
  await key('Tab').click();
  await expect.poll(keysSent).toEqual(['12', '1b 5b 31 3b 35 44', '09 1b 5b 43', '09']);

  // ⌫ held deletes again and again until it is let go.
  const box = (await key('Backspace').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(600);
  await page.mouse.up();
  const deletes = keysSent().filter((k) => k === '7f').length;
  expect(deletes).toBeGreaterThanOrEqual(3);
  await page.waitForTimeout(300);
  expect(keysSent().filter((k) => k === '7f').length).toBe(deletes);
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
  // Fn, then Tab then → from the same bar: one combination.
  await keys.getByRole('button', { name: 'Fn', exact: true }).click();
  await keys.getByRole('button', { name: 'Tab', exact: true }).click();
  await keys.getByRole('button', { name: 'Right', exact: true }).click();
  await expect.poll(() => machine.of('keys').map((k) => hex(k.bytes))).toEqual(['1b 5b 41', '09 1b 5b 43']);
  await expect(page.getByLabel('Message')).toBeFocused();

  // ⌫ deletes in the agent, not in the message box.
  await page.getByLabel('Message').fill('yes');
  await keys.getByRole('button', { name: 'Backspace', exact: true }).click();
  await expect.poll(() => machine.of('keys').map((k) => hex(k.bytes))).toEqual(['1b 5b 41', '09 1b 5b 43', '7f']);
  await expect(page.getByLabel('Message')).toHaveValue('yes');

  await page.getByLabel('Message').blur();
  await expect(keys).toBeVisible();
  await machine.close();
});

test('step 50: the open agents as tabs, or dots and a list on a phone; the one that needs you is amber; a tap opens it', async ({ page, context }, info) => {
  test.skip(info.project.name === 'desktop-push', 'covered by desktop');
  const machine = await FakeMachine.start();
  machine.agents = [agent(0, 'weft', 'claude-code', 'working'), agent(1, 'docs', 'codex', 'waiting')];
  await signIn(context, person('octo', [{ name: 'studio', address: machine.address }]));
  await opened(page, machine);
  if (!wideOf(page)) {
    const dots = page.locator('.agent-dot');
    await expect(dots).toHaveCount(2);
    await expect(dots.nth(0)).toHaveClass(/agent-dot--shown/);
    await expect(dots.nth(1)).toHaveClass(/agent-dot--needs-you/);
    await page.locator('.agent-name').click();
    await page.getByRole('dialog', { name: 'Agents' }).getByRole('region', { name: 'NEEDS YOU' }).getByRole('button').click();
    await expect.poll(() => machine.of('watch').at(-1)?.agent).toBe('3f9a1c07b2de-1');
    await expect(page.locator('.agent-name')).toHaveAccessibleName('docs · codex');
    if (info.project.name === 'iphone') {
      // The list replaces the open agent: back goes to the tree.
      await page.goBack();
      await expect(page.getByLabel('Message')).toHaveCount(0);
    }
    await machine.close();
    return;
  }
  const tabs = page.getByRole('navigation', { name: 'Tabs' });
  await expect(tabs.getByRole('button')).toHaveText(['●weft · claude-code', '■docs · codex']);
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
