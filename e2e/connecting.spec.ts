// Step 34, web-app.md §11 test 3: keys are disabled and nothing is sent while
// reconnecting; a new epoch clears the list. And the first connection pairs.
import { expect, test } from '@playwright/test';
import { FakeMachine, agent } from './fake-machine';
import { person, signIn } from './seed';

test('a first connection pairs, then says hello with its token', async ({ page, context }) => {
  const machine = await FakeMachine.start();
  machine.agents = [agent(0, 'weft', 'claude-code', 'working')];
  await signIn(context, person('octo', [{ name: 'studio', address: machine.address }]));
  await page.goto('/');
  await expect(page.getByText('weft · Claude Code')).toBeVisible();
  const [pair] = machine.of('pair');
  expect(pair).toMatchObject({ v: 1, name: expect.any(String) });
  expect(String(pair.assertion)).toMatch(/^[\w-]+\.[\w-]+$/);
  expect(machine.of('hello')).toEqual([{ type: 'hello', v: 1, device: pair.device, token: 't_good' }]);
  // Next time, straight to hello: the token was kept.
  await page.reload();
  await expect(page.getByText('weft · Claude Code')).toBeVisible();
  expect(machine.of('pair')).toHaveLength(1);
  expect(machine.of('hello')).toHaveLength(2);
  await machine.close();
});

test('keys are off and nothing is sent while reconnecting; a new epoch clears the list', async ({ page, context }) => {
  const machine = await FakeMachine.start();
  machine.agents = [agent(0, 'weft', 'claude-code', 'waiting'), agent(1, 'homepage', 'codex', 'working')];
  await signIn(context, person('octo', [{ name: 'studio', address: machine.address }]));
  await page.goto('/');
  await page.getByText('weft · Claude Code').click();
  const esc = page.getByRole('button', { name: 'Esc' });
  await expect(esc).toBeEnabled();

  machine.down = true;
  machine.drop();
  await expect(page.getByText('Reconnecting')).toBeVisible();
  await expect(esc).toBeDisabled();
  const before = machine.heard.length;
  await esc.click({ force: true });
  await page.waitForTimeout(500);
  expect(machine.heard.slice(before).filter((m) => m.type === 'keys')).toEqual([]);

  machine.epoch = 'e2';
  machine.agents = [agent(7, 'docs', 'codex', 'ready')];
  machine.down = false;
  await page.goBack();
  await expect(page.getByText('docs · Codex')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('weft · Claude Code')).toHaveCount(0);
  await expect(page.getByText('Reconnecting')).toHaveCount(0);
  await machine.close();
});
