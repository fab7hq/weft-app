// Step 38: on an iPhone, notifications ask for the Home Screen first; the
// account can be left from Settings.
import { expect, test } from '@playwright/test';
import { FakeMachine, agent } from './fake-machine';
import { person, signIn } from './seed';

test('on an iPhone in the browser, notifications first ask for the Home Screen', async ({ page, context }) => {
  const machine = await FakeMachine.start();
  machine.agents = [agent(0, 'weft', 'claude-code', 'working')];
  machine.vapid = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';
  await signIn(context, person('octo', [{ name: 'studio', address: machine.address }]));
  await page.goto('/');
  await expect(page.getByRole('treeitem', { name: 'weft', exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByLabel(/Notifications from studio/).click();
  await expect(page.getByText('Add Weft to your Home Screen first')).toBeVisible();
  expect(machine.of('push')).toHaveLength(0);
  await machine.close();
});

test('signing out ends this session and keeps the device allowed', async ({ page, context }) => {
  const machine = await FakeMachine.start();
  await signIn(context, person('octo', [{ name: 'studio', address: machine.address }]));
  await page.goto('/');
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Proceed' }).click();
  await expect(page.getByRole('link', { name: 'Sign in with GitHub' })).toBeVisible();
  await machine.close();
});

test('deleting the account asks first', async ({ page, context }) => {
  const machine = await FakeMachine.start();
  await signIn(context, person('octo', [{ name: 'studio', address: machine.address }]));
  await page.goto('/');
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('button', { name: 'Delete my account' }).click();
  await page.getByRole('dialog', { name: 'Delete your account?' }).getByRole('button', { name: 'Proceed' }).click();
  await expect(page.getByRole('link', { name: 'Sign in with GitHub' })).toBeVisible();
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Sign in with GitHub' })).toBeVisible();
  await machine.close();
});

test('forgetting this device makes the machine ask again, as a new device', async ({ page, context }) => {
  const machine = await FakeMachine.start();
  machine.agents = [agent(0, 'weft', 'claude-code', 'working')];
  await signIn(context, person('octo', [{ name: 'studio', address: machine.address }]));
  await page.goto('/');
  await expect(page.getByRole('treeitem', { name: 'weft', exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('button', { name: 'Forget this device' }).click();
  await page.getByRole('dialog', { name: 'Forget this device?' }).getByRole('button', { name: 'Proceed' }).click();
  await expect.poll(() => machine.of('pair').length).toBe(2);
  const [first, again] = machine.of('pair');
  expect(again.device).not.toBe(first.device);
  await expect(page.getByRole('treeitem', { name: 'weft', exact: true }).first()).toBeVisible();
  await machine.close();
});
