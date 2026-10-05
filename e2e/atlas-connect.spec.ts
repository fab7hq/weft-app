// Start (M1.5, M1.7, D1.5, D1.7): Add a machine moves on by itself when the
// machine joins; Connecting is the pill and the tree's shape, nothing else.
import { expect, test } from '@playwright/test';
import { FakeMachine, atlas } from './fake-machine';
import { addMachine, person, signIn } from './seed';

test('M1.5 D1.5: Add a machine moves on to its tree when the machine joins, unreloaded', async ({ page, context }) => {
  const machine = await FakeMachine.start();
  Object.assign(machine, atlas());
  const p = person('octo', []);
  await signIn(context, p);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Add a machine' })).toBeVisible();
  await expect(page.getByText('Signed in as octo')).toBeVisible();
  let loads = 0;
  page.on('load', () => loads++);
  addMachine(p, 'studio', machine.address);
  await expect(page.getByRole('treeitem', { name: 'weft', exact: true })).toBeVisible({ timeout: 10_000 });
  expect(loads).toBe(0);
  await machine.close();
});

test('M1.7 D1.7: connecting is the pill and the tree\'s shape, never an empty tree\'s words', async ({ page, context }) => {
  const machine = await FakeMachine.start();
  Object.assign(machine, atlas());
  machine.down = true;
  await signIn(context, person('octo', [{ name: 'studio', address: machine.address }]));
  await page.goto('/');
  await expect(page.getByText('Connecting', { exact: true })).toBeVisible();
  await expect(page.locator('.tree-skeleton')).toBeVisible();
  // It has not failed to reach the machine: it is still reaching it.
  await page.waitForTimeout(1500);
  await expect(page.getByText('Connecting', { exact: true })).toBeVisible();
  for (const said of ['No agent is running', 'Nothing asked', 'Reconnecting']) await expect(page.getByText(said)).toHaveCount(0);
  machine.down = false;
  await expect(page.getByRole('treeitem', { name: 'weft', exact: true })).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('.tree-skeleton')).toHaveCount(0);
  await expect(page.getByText('Connecting', { exact: true })).toHaveCount(0);
  await machine.close();
});
