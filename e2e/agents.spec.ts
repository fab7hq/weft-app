// Step 35: NEEDS YOU first; the badge counts; rows change only from `agents`.
import { expect, test } from '@playwright/test';
import { FakeMachine, agent } from './fake-machine';
import { person, signIn } from './seed';

test('the list opens on what needs you, counts it, and follows the machine', async ({ page, context }) => {
  const machine = await FakeMachine.start();
  machine.agents = [
    agent(0, 'docs', 'codex', 'ready'),
    agent(1, 'homepage', 'claude-code', 'working'),
    agent(2, 'weft', 'claude-code', 'waiting'),
    agent(3, 'weft', 'codex', 'ended'),
    agent(4, 'weft-app', 'codex', 'waiting'),
  ];
  await signIn(context, person('octo', [{ name: 'studio', address: machine.address }]));
  await page.goto('/');

  const groups = page.locator('.fab7-group');
  await expect(groups).toHaveText(['Needs you', 'Working', 'Idle']);
  const rows = page.locator('.fab7-row__title');
  await expect(rows).toHaveText([
    'weft · Claude Code',
    'weft-app · Codex',
    'homepage · Claude Code',
    'docs · Codex',
    'weft · Codex',
  ]);
  await expect(page.getByLabel('2 need you')).toHaveText('2');
  await expect(page.locator('.fab7-row__meta').first()).toHaveText('waiting for you');

  // A pending is not a row, and does not move one.
  machine.send({ type: 'pending', id: 'pnd_1', agent: '3f9a1c07b2de-1', what: 'Ready to send', why: 'w', text: 't' });
  await page.waitForTimeout(300);
  await expect(rows).toHaveCount(5);
  await expect(page.getByLabel('2 need you')).toHaveText('2');

  // The machine says one is waiting no more.
  machine.agents[2] = agent(2, 'weft', 'claude-code', 'working');
  machine.send({ type: 'agents', agents: machine.agents });
  await expect(page.getByLabel('1 needs you')).toHaveText('1');
  await expect(rows.first()).toHaveText('weft-app · Codex');

  // Nothing needs you: no group, no badge.
  machine.agents[4] = agent(4, 'weft-app', 'codex', 'ready');
  machine.send({ type: 'agents', agents: machine.agents });
  await expect(groups).toHaveText(['Working', 'Idle']);
  await expect(page.locator('.fab7-pill--count')).toHaveCount(0);
  await machine.close();
});
