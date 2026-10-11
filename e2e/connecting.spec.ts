// web-app.md §11 test 3: nothing is sent while reconnecting, and a
// key says why; a new epoch clears the list. And the first connection pairs.
import { expect, test } from '@playwright/test';
import { FakeMachine, agent } from './fake-machine';
import { openAgent } from './open';
import { person, signIn } from './seed';

test('a first connection pairs, then says hello with its token', async ({ page, context }) => {
  const machine = await FakeMachine.start();
  machine.agents = [agent(0, 'weft', 'claude-code', 'working')];
  await signIn(context, person('octo', [{ name: 'studio', address: machine.address }]));
  await page.goto('/');
  await expect(page.getByRole('treeitem', { name: 'weft', exact: true }).first()).toBeVisible();
  const [pair] = machine.of('pair');
  expect(pair).toMatchObject({ v: FakeMachine.VERSION, name: expect.any(String) });
  expect(String(pair.assertion)).toMatch(/^[\w-]+\.[\w-]+$/);
  expect(machine.of('hello')).toEqual([{ type: 'hello', v: FakeMachine.VERSION, device: pair.device, token: 't_good' }]);
  // Next time, straight to hello: the token was kept.
  await page.reload();
  await expect(page.getByRole('treeitem', { name: 'weft', exact: true }).first()).toBeVisible();
  expect(machine.of('pair')).toHaveLength(1);
  expect(machine.of('hello')).toHaveLength(2);
  await machine.close();
});

test('nothing is sent while reconnecting and a key says why; a new epoch clears the list', async ({ page, context }) => {
  const machine = await FakeMachine.start();
  machine.agents = [agent(0, 'weft', 'claude-code', 'waiting'), agent(1, 'homepage', 'codex', 'working')];
  await signIn(context, person('octo', [{ name: 'studio', address: machine.address }]));
  await page.goto('/');
  await openAgent(page, 'claude-code · no Ask yet');
  const esc = page.getByRole('toolbar', { name: 'Keys' }).getByRole('button', { name: 'Esc' });
  await expect(esc).toBeVisible();

  machine.down = true;
  machine.drop();
  await expect(page.getByText('Reconnecting')).toBeVisible();
  const before = machine.heard.length;
  await esc.click();
  await expect(page.getByText('Not connected to the machine.')).toBeVisible();
  await page.waitForTimeout(500);
  expect(machine.heard.slice(before).filter((m) => m.type === 'keys')).toEqual([]);

  machine.epoch = 'e2';
  machine.agents = [agent(7, 'docs', 'codex', 'ready')];
  machine.down = false;
  // Back to the tree: on a phone the agent was opened from its session (M11.5).
  await page.goBack();
  if (page.viewportSize()!.width < 768) await page.goBack();
  await expect(page.getByRole('treeitem', { name: 'docs', exact: true }).first()).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole('treeitem', { name: 'weft', exact: true }).first()).toHaveCount(0);
  await expect(page.getByText('Reconnecting')).toHaveCount(0);
  await machine.close();
});
