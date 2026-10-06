// The menu and Settings (M9.1, D9.1, D9.2): on a phone ☰ opens Settings, with
// Start an agent and the machines; on a desktop ☰ opens the menu under it, and
// Settings… holds the rest. Leaving is coloured by what it costs (M9.4).
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

test('D9.1 D9.2: ☰ at the top right opens the menu under it; a click outside closes it; Settings… has the rest', async ({ page, context }, info) => {
  test.skip(info.project.name !== 'desktop', 'a desktop');
  const machine = await opened(page, context);
  // The bar keeps Ask, Eval and Seal; the menu is not on it.
  await expect(page.locator('.tree-acts').getByRole('button')).toHaveText(['Ask', 'Eval', 'Seal']);
  await expect(page.getByText('Weft ⌄')).toHaveCount(0);
  const open = page.getByRole('button', { name: 'Menu' });
  await open.click();
  const menu = page.getByRole('menu', { name: 'Weft' });
  await expect(menu).toBeVisible();
  // It drops down from ☰, at the right under the header.
  const header = (await page.locator('.appbar').boundingBox())!;
  const box = (await menu.boundingBox())!;
  const at = (await open.boundingBox())!;
  expect(box.y).toBeGreaterThanOrEqual(header.y + header.height);
  expect(box.y).toBeLessThan(header.y + header.height + 24);
  expect(Math.abs(box.x + box.width - (at.x + at.width))).toBeLessThan(24);
  await expect(menu.getByRole('button', { name: 'Start an agent' })).toBeVisible();
  await expect(menu.locator('.fab7-group')).toHaveText(['This device', 'Machines']);
  await expect(menu.getByLabel(/Notifications from studio/)).toBeVisible();
  await expect(menu.getByRole('button', { name: /laptop/ })).toBeVisible();
  await page.mouse.click(200, 300);
  await expect(menu).toHaveCount(0);

  await open.click();
  await menu.getByRole('button', { name: 'Settings…' }).click();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  // The menu's rows are not repeated here.
  await expect(page.locator('.fab7-group')).toHaveText(['This device', 'Account · octo']);
  await expect(page.getByRole('button', { name: 'Start an agent' })).toHaveCount(0);
  await page.getByRole('button', { name: '‹ Back' }).click();
  await page.getByRole('button', { name: 'Menu' }).click();
  await menu.getByRole('button', { name: /laptop/ }).click();
  await expect(page.getByRole('heading', { name: 'laptop', level: 1 })).toBeVisible();
  await machine.close();
});

test('M9.1 D9.2 M9.4: Forget this device is a warning, deleting the account is dangerous', async ({ page, context }, info) => {
  const machine = await opened(page, context);
  await page.getByRole('button', { name: 'Menu' }).click();
  if (info.project.name === 'desktop') await page.getByRole('menu').getByRole('button', { name: 'Settings…' }).click();
  const colour = (name: string) => page.getByRole('button', { name, exact: true }).evaluate((el) => getComputedStyle(el).color);
  const amber = 'rgb(237, 187, 91)';
  const red = 'rgb(248, 81, 73)';
  expect(await colour('Sign out')).not.toBe(amber);
  expect(await colour('Forget this device')).toBe(amber);
  expect(await colour('Delete my account')).toBe(red);
  await page.getByRole('button', { name: 'Delete my account', exact: true }).click();
  expect(await colour('Delete my account and its machines')).toBe(red);
  await machine.close();
});
