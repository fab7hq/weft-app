// The menu and Settings (19.1–19.11): on a desktop ☰ opens the menu under it
// (the machines, Settings…, Sign out), and Settings lists its sections beside
// the one shown; on a phone ☰ opens Settings' list, each row its page.
// Advanced settings shows the expert controls in place and every page says
// so. Leaving is coloured by what it costs (M9.4).
import { expect, test, type BrowserContext, type Page, type TestInfo } from '@playwright/test';
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

const desktop = (info: TestInfo) => info.project.name === 'desktop';

/** Settings, at one of its sections: a desktop through ☰ › Settings… and its list, a phone through ☰ and its list. */
async function settings(page: Page, info: TestInfo, section?: RegExp) {
  await page.getByRole('button', { name: 'Menu' }).click();
  if (desktop(info)) await page.getByRole('menu').getByRole('button', { name: 'Settings…' }).click();
  if (!section) return;
  if (desktop(info)) await page.getByRole('navigation', { name: 'Settings' }).getByRole('button', { name: section }).click();
  else await page.locator('.set-list').getByRole('button', { name: section }).click();
}

test('19.1: a phone\'s Settings lists the machine\'s sections, each with what it holds, then this device & account', async ({ page, context }, info) => {
  test.skip(info.project.name !== 'iphone', 'the phone');
  const machine = await opened(page, context);
  await settings(page, info);
  await expect(page.locator('.appbar h1')).toHaveText('Settings');
  await expect(page.getByRole('combobox', { name: 'Machines' })).toHaveValue(/.+/);
  await expect(page.locator('.set-list .fab7-group')).toHaveText(['studio', 'You']);
  const rows = page.locator('.set-list-row');
  await expect(rows).toHaveText([/^General/, /^EvalBalanced · /, /^Rules3 kinds of work/, /^Agent apps■ 1 needs an update/, /^This device & accountocto/]);
  // An agent starts from a project's +, not from here.
  await expect(page.getByRole('button', { name: 'Start an agent', exact: true })).toHaveCount(0);
  // A row opens its page, and Back comes back.
  await rows.nth(0).click();
  await expect(page.locator('.appbar h1')).toHaveText('General');
  await page.getByRole('button', { name: '‹ Settings' }).click();
  await expect(page.locator('.appbar h1')).toHaveText('Settings');
  await machine.close();
});

test('19.1: ☰ at the top right opens the menu under it: the machines, Settings… and Sign out; a click outside closes it', async ({ page, context }, info) => {
  test.skip(!desktop(info), 'a desktop');
  const machine = await opened(page, context);
  // The bar keeps Ask, Eval and Seal; the menu is not on it.
  await expect(page.locator('.tree-acts').getByRole('button')).toHaveText(['Ask', 'Eval', 'Seal']);
  const open = page.getByRole('button', { name: 'Menu' });
  await open.click();
  const menu = page.getByRole('menu', { name: 'Weft' });
  await expect(menu).toBeVisible();
  // It drops down from ☰, at the right, just under the header.
  const header = (await page.locator('.appbar').boundingBox())!;
  const box = (await menu.boundingBox())!;
  const at = (await open.boundingBox())!;
  expect(box.y).toBeGreaterThan(at.y + at.height);
  expect(Math.abs(box.y - (header.y + header.height + 6))).toBeLessThanOrEqual(1);
  expect(Math.abs(box.x + box.width - (at.x + at.width))).toBeLessThan(24);
  await expect(menu.locator('.fab7-group')).toHaveText(['Machines']);
  await expect(menu.getByRole('button')).toHaveText([/studio/, /laptop/, 'Settings…', 'Sign out']);
  await expect(menu.getByLabel(/Notifications/)).toHaveCount(0);
  await page.mouse.click(200, 300);
  await expect(menu).toHaveCount(0);

  await open.click();
  await menu.getByRole('button', { name: 'Settings…' }).click();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  const list = page.getByRole('navigation', { name: 'Settings' });
  await expect(list.getByRole('button')).toHaveText(['General', 'Eval', 'Rules', 'Agent apps■ 1', 'This device & account']);
  await expect(list.getByRole('button', { name: 'General' })).toHaveAttribute('aria-current', 'page');
  await page.getByRole('button', { name: '‹ Back' }).click();
  await page.getByRole('button', { name: 'Menu' }).click();
  await menu.getByRole('button', { name: /laptop/ }).click();
  await expect(page.locator('.appbar .mark')).toBeVisible();
  await machine.close();
});

test('19.4 19.11: Advanced settings shows each section\'s expert controls, marks every page, and is kept by the browser', async ({ page, context }, info) => {
  const machine = await opened(page, context);
  await settings(page, info, /^Eval/);
  const mark = page.locator('.set-mode');
  await expect(mark).toHaveCount(0);
  await expect(page.getByText('Each reader')).toHaveCount(0);
  await expect(page.getByText('Who runs each step')).toHaveCount(0);
  if (!desktop(info)) await page.getByRole('button', { name: '‹ Settings' }).click();
  await page.getByLabel('Advanced settings').click({ force: true });
  await expect(mark).toHaveText('ADVANCED');
  await expect(page.locator('.appbar')).toHaveClass(/appbar--advanced/);
  if (!desktop(info)) await page.locator('.set-list').getByRole('button', { name: /^Eval/ }).click();
  await expect(page.locator('.rf-head')).toContainText(['How carefully it reads your work', 'Who reads it', 'Each readerADVANCED', 'Who runs each stepADVANCED', 'While reading, Eval never']);
  await expect(mark).toHaveText('ADVANCED');
  // A reload starts at the machines; Settings is still advanced.
  await page.reload();
  await page.getByRole('button', { name: /studio/ }).click();
  await settings(page, info);
  await expect(mark).toHaveText('ADVANCED');
  await machine.close();
});

test('19.2: General names the machine, the system’s name until changed; the section says it', async ({ page, context }, info) => {
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
  await settings(page, info, /^General/);
  const field = page.getByRole('textbox', { name: /^Name/ });
  await expect(field).toHaveValue(system);
  const title = page.locator('.settings .fab7-group').first();
  await expect(title).toHaveText(system);
  await expect(page.locator('.settings .fab7-group')).toHaveText([system, 'Agents']);
  await expect(page.locator('.settings-row .settings-text > span:first-child')).toContainText(['Name', 'Start Weft at login', 'Notify me', 'Keep finished sessions', '⚡ Turbo']);

  await field.fill('  Studio  ');
  await field.press('Enter');
  await expect(title).toHaveText('Studio');
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
  const width = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(width).toBeLessThanOrEqual(0);
  await machine.close();
});

test('19.2 19.10: Keep finished sessions is 3 days, a week, a month, Custom or Keep forever; Custom alone shows the days', async ({ page, context }, info) => {
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
  await settings(page, info, /^General/);
  const choice = page.getByRole('combobox', { name: /^Keep finished sessions/ });
  const days = page.getByRole('textbox', { name: 'days' });
  await expect(choice).toHaveValue('7');
  await expect(choice.locator('option')).toHaveText(['3 days', 'A week', 'A month', 'Custom', 'Keep forever']);
  await expect(days).toHaveCount(0);
  await expect(page.locator('.settings-keep')).toContainText('Older ones leave the list');

  await choice.selectOption({ label: 'A month' });
  await expect.poll(() => sets).toEqual([30]);
  await choice.selectOption({ label: 'Keep forever' });
  await expect.poll(() => sets).toEqual([30, 0]);
  await expect(days).toHaveCount(0);
  // Custom: the days, digits only, sent on Enter.
  await choice.selectOption({ label: 'Custom' });
  expect(sets).toEqual([30, 0]);
  await expect(days).toHaveValue('0');
  await days.fill('');
  await days.pressSequentially('10 days');
  await expect(days).toHaveValue('10');
  await days.press('Enter');
  await expect.poll(() => sets).toEqual([30, 0, 10]);
  // Emptied, the machine's default applies again.
  await days.fill('');
  await days.press('Enter');
  await expect.poll(() => sets).toEqual([30, 0, 10, null]);
  await expect(days).toHaveValue('7');
  expect(machine.of('set').filter((m) => JSON.stringify(m.key) === '["sessions","keep_days"]').every((m) => m.scope === 'machine')).toBe(true);
  // A number the choices do not hold opens on Custom.
  machine.send({ type: 'settings', project: 'weft', settings: { ...machine.settings, effective: { keep_days: 12 } } });
  await expect(days).toHaveValue('12');
  const width = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(width).toBeLessThanOrEqual(0);
  await machine.close();
});

test('19.2: what the machine says while a field is typed in neither replaces what is typed nor stops it being sent', async ({ page, context }, info) => {
  const machine = await opened(page, context);
  const system = 'Ada’s MacBook Pro';
  const effective = { name: system, keep_days: 12 };
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
  await settings(page, info, /^General/);
  const title = page.locator('.settings .fab7-group').first();
  const name = page.getByRole('textbox', { name: /^Name/ });
  const days = page.getByRole('textbox', { name: 'days' });
  await expect(name).toHaveValue(system);
  await expect(days).toHaveValue('12');

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
    await expect(title).toHaveText('Elsewhere');
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

test('19.3: Eval is how carefully it reads, who reads it and what it never does; a line is removed on the machine', async ({ page, context }, info) => {
  const machine = await opened(page, context);
  await settings(page, info, /^Eval/);
  const care = page.getByRole('radiogroup', { name: 'How carefully it reads your work' });
  await expect(care.getByRole('radio')).toHaveText([/^Quick/, /^Balanced/, /^Thorough/]);
  await expect(care.getByRole('radio', { name: /^Balanced/ })).toHaveAttribute('aria-checked', 'true');
  await care.getByRole('radio', { name: /^Thorough/ }).click();
  await expect.poll(() => machine.of('set').filter((m) => JSON.stringify(m.key).includes('effort')).map((m) => m.value)).toEqual(['high', 'high']);
  await expect(page.getByText('Read by', { exact: true })).toBeVisible();
  const never = page.locator('.rf-deny');
  await expect(never).toContainText(['Push to any remote.built in']);
  await never.getByRole('button', { name: 'Remove' }).click();
  await expect.poll(() => machine.of('set').at(-1)).toEqual(expect.objectContaining({ scope: 'machine', key: ['ringframe', 'eval', 'deny'], value: [] }));
  await machine.close();
});

test('19.5 19.6: each practice turned on has its rules, switched in its own catalog; turned off, its group goes', async ({ page, context }, info) => {
  const machine = await opened(page, context);
  await settings(page, info, /^Rules/);
  await expect(page.locator('.rf-head .fab7-group')).toHaveText(['What you work on', 'The rules']);
  const groups = page.locator('.set-group-name');
  await expect(groups).toHaveText(['Software development', 'Autonomous trading', 'Machine learning']);
  // No tier, status or Edit while Advanced settings is off.
  await expect(page.locator('.set-tag').filter({ hasText: /^(core|situational)$/ })).toHaveCount(0);
  if (desktop(info)) await groups.nth(1).click();
  else {
    await groups.nth(1).click();
    await expect(page.locator('.appbar h1')).toHaveText('Autonomous trading');
  }
  await expect(page.locator('.set-rule-name > span:first-child')).toHaveText(['No Lookahead', 'Indicator Code']);
  // A practice's rule is changed in its own catalog.
  await page.locator('[id="rule-practices/autonomous-trading-trading.no_lookahead"]').click({ force: true });
  await expect.poll(() => machine.of('set').at(-1)).toEqual(expect.objectContaining({ scope: 'machine', key: ['ringframe', 'deltas', 'practices/autonomous-trading', 'entries'], value: [{ id: 'trading.no_lookahead', enabled: false }] }));
  if (!desktop(info)) await page.getByRole('button', { name: '‹ Rules' }).click();
  // Turned off, its group goes.
  const deltas = (machine.settings.machine as { ringframe: { deltas: Record<string, unknown> } }).ringframe.deltas;
  delete deltas['practices/autonomous-trading'];
  await page.locator('[id="practice-autonomous-trading"]').click({ force: true });
  await expect.poll(() => machine.of('set').at(-1)).toEqual(expect.objectContaining({ key: ['ringframe', 'deltas', 'practices/autonomous-trading'], value: null }));
  await expect(groups).toHaveText(['Software development', 'Machine learning']);
  await machine.close();
});

test('19.7: Agent apps says how each stands and what to do; never who sends', async ({ page, context }, info) => {
  const machine = await opened(page, context);
  await settings(page, info, /^Agent apps/);
  const apps = page.locator('.set-app');
  await expect(apps).toHaveCount(4);
  await expect(apps.filter({ hasText: 'Claude Code' }).locator('.set-chip')).toHaveText('Needs an update');
  await expect(apps.filter({ hasText: 'Claude Code' })).toContainText('Update it on studio, in Updates.');
  await expect(apps.filter({ hasText: 'Codex' }).locator('.set-chip')).toHaveText('Not installed');
  await expect(apps.filter({ hasText: 'Antigravity' }).locator('.set-chip')).toHaveText('Ready');
  await expect(page.getByText(/you send|Weft sends/)).toHaveCount(0);
  await machine.close();
});

test('M9.1: Forget this device is a warning, deleting the account is dangerous', async ({ page, context }, info) => {
  const machine = await opened(page, context);
  await settings(page, info, /^This device & account/);
  const colour = (name: string) => page.getByRole('button', { name, exact: true }).evaluate((el) => getComputedStyle(el).color);
  expect(await colour('Sign out')).not.toBe(AMBER);
  expect(await colour('Forget this device')).toBe(AMBER);
  expect(await colour('Delete my account')).toBe(RED);
  await expect(page.getByLabel(/Notifications on this device/)).toBeVisible();
  await machine.close();
});

test('M9.4 M9.5 M9.6: each act that leaves asks first, and Cancel, Esc or a press outside does nothing', async ({ page, context }, info) => {
  const machine = await opened(page, context);
  await settings(page, info, /^This device & account/);
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
  await expect(page.getByRole('heading', { name: desktop(info) ? 'Settings' : 'This device & account' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('link', { name: 'Sign in with GitHub' })).toHaveCount(0);
  await machine.close();
});

test('19.1: Sign out in the menu asks first', async ({ page, context }, info) => {
  test.skip(!desktop(info), 'a desktop');
  const machine = await opened(page, context);
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('menu').getByRole('button', { name: 'Sign out' }).click();
  const sure = page.getByRole('dialog', { name: 'Sign out of Weft here?' });
  await sure.getByRole('button', { name: 'Proceed' }).click();
  await expect(page.getByRole('link', { name: 'Sign in with GitHub' })).toBeVisible();
  await machine.close();
});
