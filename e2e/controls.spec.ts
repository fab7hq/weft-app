// Phase 6 slice J, web-app.md §4, §6, §7: the controls, as the TUI. Under the
// pane one row, [⌃] Message… [▶]; the TUI's bar is a sheet behind ⌃.
import { expect, test, type Page } from '@playwright/test';
import { FakeMachine, agent } from './fake-machine';
import { person, signIn } from './seed';

async function opened(page: Page, machine: FakeMachine) {
  await page.goto('/');
  await page.getByText('weft · Claude Code').click();
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
  // No Ask on the board: Eval and Seal dim, with the TUI's reason.
  await expect(bar.getByRole('button', { name: 'Eval', exact: true })).toBeDisabled();
  await expect(bar.getByRole('button', { name: 'Seal', exact: true })).toBeDisabled();
  await expect(bar.getByText('Nothing to work on yet.')).toBeVisible();
  await expect(bar.getByRole('toolbar', { name: 'Keys' })).toBeVisible();

  // History from the sheet.
  machine.onRead = (m) => ({ type: 'ok', req: m.req, text: 'the newest line' });
  await bar.getByRole('button', { name: 'History', exact: true }).click();
  await expect(page.getByText('the newest line')).toBeVisible();
  await expect(bar).toHaveCount(0);
  await page.getByRole('button', { name: 'Back to the screen' }).click();

  // [W]EFT opens Settings; [L]IST goes back to the list.
  await page.getByRole('button', { name: 'The bar', exact: true }).click();
  await page.getByRole('dialog', { name: 'Weft' }).getByRole('button', { name: 'List', exact: true }).click();
  await expect(page.getByText('weft · Claude Code')).toBeVisible();
  await expect(page.getByLabel('Message')).toHaveCount(0);
  await machine.close();
});

test('step 45: with an Ask on the board, Eval goes from the sheet', async ({ page, context }, info) => {
  test.skip(info.project.name !== 'iphone', 'the phone layout');
  const machine = await FakeMachine.start();
  machine.agents = [{ ...agent(0, 'weft', 'claude-code', 'ended'), unit: { id: 'ask_1', title: 'health endpoint', eval: null } }];
  machine.onAct = (m) => [
    { type: 'pending', id: 'pnd_1', agent: m.agent, what: 'Ready to check with codex', why: 'why', text: '/rf:eval ask_1' },
    { type: 'ok', req: m.req, pending: 'pnd_1' },
  ];
  await signIn(context, person('octo', [{ name: 'studio', address: machine.address }]));
  await opened(page, machine);
  await page.getByRole('button', { name: 'The bar', exact: true }).click();
  const bar = page.getByRole('dialog', { name: 'Weft' });
  await expect(bar.getByText('Nothing to work on yet.')).toHaveCount(0);
  await bar.getByRole('button', { name: 'Eval', exact: true }).click();
  await expect.poll(() => machine.of('act').length).toBe(1);
  expect(machine.of('act')[0]).toMatchObject({ act: 'eval', agent: '3f9a1c07b2de-0' });
  await expect(page.getByRole('dialog', { name: 'Ready to check with codex' })).toBeVisible();
  await machine.close();
});
