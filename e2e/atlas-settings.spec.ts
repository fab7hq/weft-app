// The menu and Settings (M9.1, D9.1, D9.2): on a phone ☰ opens Settings, with
// Start an agent and the machines; on a desktop ☰ opens the menu under it, and
// Settings… holds the rest. Leaving is coloured by what it costs (M9.4).
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { FakeMachine, atlas } from './fake-machine';
import { person, signIn } from './seed';

const AMBER = 'rgb(237, 187, 91)';
const RED = 'rgb(248, 81, 73)';
const BLUE = 'rgb(88, 166, 255)';

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
  // It drops down from ☰, at the right, over the header's line as D9.1 draws it.
  const header = (await page.locator('.appbar').boundingBox())!;
  const box = (await menu.boundingBox())!;
  const at = (await open.boundingBox())!;
  expect(box.y).toBeGreaterThan(at.y + at.height);
  expect(Math.abs(box.y - (header.y + header.height - 5))).toBeLessThanOrEqual(1);
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

test('M9.1 D9.2: Forget this device is a warning, deleting the account is dangerous', async ({ page, context }, info) => {
  const machine = await opened(page, context);
  await page.getByRole('button', { name: 'Menu' }).click();
  if (info.project.name === 'desktop') await page.getByRole('menu').getByRole('button', { name: 'Settings…' }).click();
  const colour = (name: string) => page.getByRole('button', { name, exact: true }).evaluate((el) => getComputedStyle(el).color);
  expect(await colour('Sign out')).not.toBe(AMBER);
  expect(await colour('Forget this device')).toBe(AMBER);
  expect(await colour('Delete my account')).toBe(RED);
  await machine.close();
});

test('M9.4 M9.5 M9.6 D9.4: each act that leaves asks first, and Cancel, Esc or a press outside does nothing', async ({ page, context }, info) => {
  const machine = await opened(page, context);
  await page.getByRole('button', { name: 'Menu' }).click();
  if (info.project.name === 'desktop') await page.getByRole('menu').getByRole('button', { name: 'Settings…' }).click();
  const asks: [string, string, string, string][] = [
    ['Sign out', 'Sign out of Weft here?', 'You sign out on this device. It stays allowed on your machines, so signing in again opens them.', BLUE],
    ['Sign out everywhere', 'Sign out everywhere?', 'Every phone and browser signed in as octo signs out. Each stays allowed on your machines.', BLUE],
    ['Forget this device', 'Forget this device?', 'This device drops its name, its tokens and its notifications.', AMBER],
    ['Delete my account', 'Delete your account?', "Your account, its sign-ins and its machines leave Weft's service, on every device.", RED],
  ];
  for (const [act, question, what, colour] of asks) {
    await page.getByRole('button', { name: act, exact: true }).click();
    const sure = page.getByRole('dialog', { name: question });
    await expect(sure).toContainText(what);
    await expect(sure.getByRole('button')).toHaveText(['Cancel', 'Proceed']);
    expect(await sure.getByRole('button', { name: 'Proceed' }).evaluate((el) => getComputedStyle(el).color)).toBe(colour);
    await sure.getByRole('button', { name: 'Cancel' }).click();
    await expect(sure).toHaveCount(0);
    await page.getByRole('button', { name: act, exact: true }).click();
    await expect(sure).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(sure).toHaveCount(0);
    await page.getByRole('button', { name: act, exact: true }).click();
    await expect(sure).toBeVisible();
    await page.mouse.click(5, 5);
    await expect(sure).toHaveCount(0);
  }
  // Nothing left: still signed in, on Settings.
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('link', { name: 'Sign in with GitHub' })).toHaveCount(0);
  await machine.close();
});

test('D9.1: Sign out in the menu asks first', async ({ page, context }, info) => {
  test.skip(info.project.name !== 'desktop', 'a desktop');
  const machine = await opened(page, context);
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('menu').getByRole('button', { name: 'Sign out' }).click();
  const sure = page.getByRole('dialog', { name: 'Sign out of Weft here?' });
  await sure.getByRole('button', { name: 'Proceed' }).click();
  await expect(page.getByRole('link', { name: 'Sign in with GitHub' })).toBeVisible();
  await machine.close();
});
