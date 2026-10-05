// The menu and Settings (M9.1, D9.1, D9.2): on a phone ☰ opens Settings, with
// Start an agent and the machines; on a desktop Weft ⌄ opens the menu, and
// Settings… holds the rest.
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { FakeMachine, atlas } from './fake-machine';
import { person, signIn } from './seed';

async function opened(page: Page, context: BrowserContext) {
  const machine = await FakeMachine.start();
  Object.assign(machine, atlas());
  await signIn(context, person('octo', [{ name: 'studio', address: machine.address }, { name: 'laptop' }]));
  await page.goto('/');
  await page.getByRole('button', { name: /studio/ }).click();
  await expect(page.getByRole('treeitem', { name: 'weft', exact: true })).toBeVisible();
  return machine;
}

test('M9.1: Settings has Start an agent, this device, its notifications, the machines and the account', async ({ page, context }, info) => {
  test.skip(info.project.name !== 'iphone', 'the phone');
  const machine = await opened(page, context);
  await page.getByRole('button', { name: 'Menu' }).click();
  await expect(page.locator('.fab7-group')).toHaveText(['studio', 'This device', 'Machines', 'Account · octo']);
  await expect(page.getByRole('button', { name: 'Start an agent' })).toBeVisible();
  await expect(page.getByText('It runs on studio, with your own settings.')).toBeVisible();
  await expect(page.getByLabel(/Notifications from studio/)).toBeVisible();
  const rows = page.locator('.settings-row').filter({ hasText: /^(studio|laptop)/ });
  await expect(rows).toHaveText(['studioconnected›', 'laptop›']);
  await expect(page.getByText('Projects, setup, turbo and Remote stay on your machine.', { exact: false })).toBeVisible();
  // A machine opens its tree.
  await rows.nth(1).click();
  await expect(page.getByRole('heading', { name: 'laptop', level: 1 })).toBeVisible();
  await machine.close();
});

test('D9.1 D9.2: Weft ⌄ opens the menu; a click outside closes it; Settings… has the rest', async ({ page, context }, info) => {
  test.skip(info.project.name !== 'desktop', 'a desktop');
  const machine = await opened(page, context);
  await page.getByRole('button', { name: 'Weft ⌄' }).click();
  const menu = page.getByRole('menu', { name: 'Weft' });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('button', { name: 'Start an agent' })).toBeVisible();
  await expect(menu.locator('.fab7-group')).toHaveText(['This device', 'Machines']);
  await expect(menu.getByLabel(/Notifications from studio/)).toBeVisible();
  await expect(menu.getByRole('button', { name: /laptop/ })).toBeVisible();
  await page.mouse.click(200, 300);
  await expect(menu).toHaveCount(0);

  await page.getByRole('button', { name: 'Weft ⌄' }).click();
  await menu.getByRole('button', { name: 'Settings…' }).click();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  // The menu's rows are not repeated here.
  await expect(page.locator('.fab7-group')).toHaveText(['This device', 'Account · octo']);
  await expect(page.getByRole('button', { name: 'Start an agent' })).toHaveCount(0);
  await page.getByRole('button', { name: '‹ Back' }).click();
  await page.getByRole('button', { name: 'Weft ⌄' }).click();
  await menu.getByRole('button', { name: /laptop/ }).click();
  await expect(page.getByRole('heading', { name: 'laptop', level: 1 })).toBeVisible();
  await machine.close();
});
