// The menu and Settings (M9.1, D9.1, D9.2): on a phone ☰ opens Settings, with
// the machines; on a desktop ☰ opens the menu under it, and
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

test('M9.1: Settings has this device, its notifications, the machines and the account', async ({ page, context }, info) => {
  test.skip(info.project.name !== 'iphone', 'the phone');
  const machine = await opened(page, context);
  await page.getByRole('button', { name: 'Menu' }).click();
  await expect(page.locator('.fab7-group')).toHaveText(['This device', 'Machines', 'Account · octo']);
  // An agent starts from a project's +, not from here.
  await expect(page.getByRole('button', { name: 'Start an agent', exact: true })).toHaveCount(0);
  await expect(page.getByLabel(/Notifications from studio/)).toBeVisible();
  const rows = page.locator('.settings-row').filter({ hasText: /^(studio|laptop)/ });
  await expect(rows).toHaveText(['studioconnected ›', 'laptop›']);
  await expect(page.getByText('Projects, setup, turbo and Remote stay on your machine.', { exact: false })).toBeVisible();
  // A machine opens its tree.
  await rows.nth(1).click();
  await expect(page.locator('.appbar .mark')).toBeVisible();
  await expect(page.getByRole('list', { name: 'Your machines' })).toHaveCount(0);
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
  // It drops down from ☰, at the right, just under the header, as ADE 05 draws it.
  const header = (await page.locator('.appbar').boundingBox())!;
  const box = (await menu.boundingBox())!;
  const at = (await open.boundingBox())!;
  expect(box.y).toBeGreaterThan(at.y + at.height);
  expect(Math.abs(box.y - (header.y + header.height + 6))).toBeLessThanOrEqual(1);
  expect(Math.abs(box.x + box.width - (at.x + at.width))).toBeLessThan(24);
  await expect(menu.getByRole('button', { name: 'Start an agent', exact: true })).toHaveCount(0);
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
  await expect(page.locator('.appbar .mark')).toBeVisible();
  await expect(page.getByRole('list', { name: 'Your machines' })).toHaveCount(0);
  await machine.close();
});

test('M9.8 D9.8: General names the machine, the system’s name until changed; the title says it', async ({ page, context }, info) => {
  const machine = await opened(page, context);
  const system = 'Ada’s MacBook Pro';
  machine.settings = { ...machine.settings, effective: { name: system } };
  const sets: unknown[] = [];
  const setting = machine.setting.bind(machine);
  machine.setting = (m) => {
    if (m.type === 'set' && JSON.stringify(m.key) === '["name"]') {
      sets.push(m.value);
      machine.settings = { ...machine.settings, effective: { name: m.value ?? system } };
    }
    return setting(m);
  };
  await page.getByRole('button', { name: 'Menu' }).click();
  if (info.project.name === 'desktop') await page.getByRole('menu').getByRole('button', { name: /studio/ }).click();
  else await page.locator('.settings').getByRole('button', { name: /studio/ }).first().click();
  const field = page.getByRole('textbox', { name: /^Name/ });
  await expect(field).toHaveValue(system);
  const title = info.project.name === 'desktop' ? page.locator('.settings-title') : page.locator('.appbar h1');
  await expect(title).toHaveText(info.project.name === 'desktop' ? `Settings · ${system}` : system);
  await expect(page.locator('.settings .fab7-group')).toHaveText(['This machine', 'Every project on this machine']);

  await field.fill('  Studio  ');
  await field.press('Enter');
  await expect(title).toContainText('Studio');
  await expect(field).toHaveValue('Studio');
  expect(sets).toEqual(['Studio']);
  // Emptied, it is the system's own name again: the machine forgets it.
  await field.fill('');
  await field.press('Enter');
  await expect.poll(() => sets).toEqual(['Studio', null]);
  await expect(field).toHaveValue(system);

  // A name of any length stays inside the page.
  const long = 'A machine whose name is far longer than any field or title it is shown in';
  await field.fill(long);
  await field.press('Enter');
  await expect(field).toHaveValue(long);
  await expect(title).toContainText(long.slice(0, 10));
  const width = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(width).toBeLessThanOrEqual(0);
  await machine.close();
});

test('M9.8 D9.8: Keep ended sessions sets the machine\'s days under Notifications; emptied, its default again; 0 keeps them all', async ({ page, context }, info) => {
  const machine = await opened(page, context);
  // Nothing set, the machine says its default applies.
  machine.settings = { ...machine.settings, effective: { keep_days: 7 } };
  const sets: unknown[] = [];
  const setting = machine.setting.bind(machine);
  machine.setting = (m) => {
    if (m.type === 'set' && JSON.stringify(m.key) === '["sessions","keep_days"]') {
      sets.push(m.value);
      machine.settings = { ...machine.settings, effective: { keep_days: m.value ?? 7 } };
    }
    return setting(m);
  };
  await page.getByRole('button', { name: 'Menu' }).click();
  if (info.project.name === 'desktop') await page.getByRole('menu').getByRole('button', { name: /studio/ }).click();
  else await page.locator('.settings').getByRole('button', { name: /studio/ }).first().click();
  const field = page.getByRole('textbox', { name: /^Keep ended sessions/ });
  await expect(field).toHaveValue('7');
  const keep = page.locator('.settings-keep');
  await expect(keep).toContainText('Older ones are archived and no longer listed; 0 keeps them all');
  await expect(keep.locator('.settings-unit')).toHaveText('days');
  // Under Notifications, before the foot.
  const [notify, at] = await Promise.all([page.locator('label[for="machine-notify"]').boundingBox(), keep.boundingBox()]);
  expect(at!.y).toBeGreaterThan(notify!.y);

  await field.fill('30');
  await field.press('Enter');
  await expect.poll(() => sets).toEqual([30]);
  await expect(field).toHaveValue('30');
  // 0 keeps every session.
  await field.fill('0');
  await field.blur();
  await expect.poll(() => sets).toEqual([30, 0]);
  await expect(field).toHaveValue('0');
  // Only digits can be typed in it.
  await field.fill('');
  await field.pressSequentially('2 weeks');
  await expect(field).toHaveValue('2');
  await field.press('Enter');
  await expect.poll(() => sets).toEqual([30, 0, 2]);
  // Emptied, the machine's default applies again.
  await field.fill('');
  await field.press('Enter');
  await expect.poll(() => sets).toEqual([30, 0, 2, null]);
  await expect(field).toHaveValue('7');
  expect(machine.of('set').filter((m) => JSON.stringify(m.key) === '["sessions","keep_days"]').every((m) => m.scope === 'machine')).toBe(true);
  const width = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(width).toBeLessThanOrEqual(0);
  await machine.close();
});

test('M9.8 D9.8: what the machine says while a field is typed in neither replaces what is typed nor stops it being sent', async ({ page, context }, info) => {
  const machine = await opened(page, context);
  const system = 'Ada’s MacBook Pro';
  const effective = { name: system, keep_days: 7 };
  const told = (more: Record<string, unknown>) => ({ ...machine.settings, effective: { ...effective, ...more } });
  machine.settings = told({});
  // The machine's answer to a change is held until the test lets it go.
  const held: { req: unknown; key: string; value: unknown }[] = [];
  const setting = machine.setting.bind(machine);
  machine.setting = (m) => {
    if (m.type !== 'set') return setting(m);
    held.push({ req: m.req, key: JSON.stringify(m.key), value: m.value });
    return { type: 'ok', req: -1 };
  };
  const answer = (said: Record<string, unknown>) => {
    const { req } = held.shift()!;
    machine.settings = told(said);
    machine.send({ type: 'ok', req, settings: machine.settings });
  };
  await page.getByRole('button', { name: 'Menu' }).click();
  if (info.project.name === 'desktop') await page.getByRole('menu').getByRole('button', { name: /studio/ }).click();
  else await page.locator('.settings').getByRole('button', { name: /studio/ }).first().click();
  const title = info.project.name === 'desktop' ? page.locator('.settings-title') : page.locator('.appbar h1');
  const name = page.getByRole('textbox', { name: /^Name/ });
  const days = page.getByRole('textbox', { name: /^Keep ended sessions/ });
  await expect(name).toHaveValue(system);

  for (const [field, first, second, key, said] of [
    [name, 'Studio', 'Studio 2', '["name"]', (v: string) => ({ name: v })],
    [days, '30', '45', '["sessions","keep_days"]', (v: string) => ({ keep_days: Number(v) })],
  ] as const) {
    await field.fill(first);
    await field.press('Enter');
    await expect.poll(() => held.map((h) => [h.key, h.value])).toEqual([[key, key === '["name"]' ? first : Number(first)]]);
    // Typing again before the machine answers.
    await field.fill(second);
    // The answer to the first, and a change told by the machine, arrive mid-typing.
    answer(said(first));
    machine.send({ type: 'settings', project: 'weft', settings: told({ name: 'Elsewhere', keep_days: 99 }) });
    await expect(title).toContainText('Elsewhere');
    await expect(field).toHaveValue(second);
    // Left, what was typed is sent, and once answered the field says it.
    await field.press('Enter');
    await expect.poll(() => held.map((h) => [h.key, h.value])).toEqual([[key, key === '["name"]' ? second : Number(second)]]);
    answer(said(second));
    await expect(field).toHaveValue(second);
    expect(held).toEqual([]);
  }
  // A field not typed in says what the machine says.
  machine.send({ type: 'settings', project: 'weft', settings: told({ name: 'Studio 3', keep_days: 60 }) });
  await expect(name).toHaveValue('Studio 3');
  await expect(days).toHaveValue('60');
  await machine.close();
});

test('M9.10 D9.10: each practice turned on has its own rules under Software development\'s, edited in its own catalog; turned off, its section goes', async ({ page, context }, info) => {
  const machine = await opened(page, context);
  if (info.project.name === 'desktop') {
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('menu').getByRole('button', { name: /studio/ }).click();
  } else {
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.locator('.settings').getByRole('button', { name: /studio/ }).first().click();
  }
  await page.getByRole('tab', { name: 'RingFrame' }).click();
  const heads = page.locator('.rf-head .fab7-group');
  await expect(heads).toHaveText(['Practices', 'Software development · rules', 'Autonomous trading · rules', 'Machine learning · rules', /^Eval readers/]);
  await expect(page.locator('.rf-rule .rf-name > span:first-child')).toContainText(['KISS', 'No Lookahead', 'Indicator Code', 'Simplest Model']);
  // A practice's rule is changed in its own catalog.
  await page.locator('[id="rule-practices/autonomous-trading-trading.no_lookahead"]').click({ force: true });
  await expect.poll(() => machine.of('set').at(-1)).toEqual(expect.objectContaining({ scope: 'machine', key: ['ringframe', 'deltas', 'practices/autonomous-trading', 'entries'], value: [{ id: 'trading.no_lookahead', enabled: false }] }));
  // Turned off, its section goes.
  const deltas = (machine.settings.machine as { ringframe: { deltas: Record<string, unknown> } }).ringframe.deltas;
  delete deltas['practices/autonomous-trading'];
  await page.locator('[id="practice-autonomous-trading"]').click({ force: true });
  await expect.poll(() => machine.of('set').at(-1)).toEqual(expect.objectContaining({ key: ['ringframe', 'deltas', 'practices/autonomous-trading'], value: null }));
  await expect(heads).toHaveText(['Practices', 'Software development · rules', 'Machine learning · rules', /^Eval readers/]);
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
