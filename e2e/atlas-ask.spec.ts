// Ask is a sheet with SEND TO, the project's running agents (M4.1–M4.4, D4.1–D4.4).
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { FakeMachine, atlas } from './fake-machine';
import { person, signIn } from './seed';

async function opened(page: Page, context: BrowserContext) {
  const machine = await FakeMachine.start();
  Object.assign(machine, atlas());
  machine.onAct = (m) => [
    { type: 'pending', id: 'pnd_1', agent: m.agent, what: 'Ready to ask codex', why: 'Weft will type /rf:ask into codex.', text: String(m.text) },
    { type: 'ok', req: m.req, pending: 'pnd_1' },
  ];
  await signIn(context, person('octo', [{ name: 'studio', address: machine.address }]));
  await page.goto('/');
  await expect(page.getByRole('tree', { name: 'Work' })).toBeVisible();
  return machine;
}

test('M4.1 M4.3 D4.1 D4.3: typing, picking codex, Ask sends act ask to codex', async ({ page, context }, info) => {
  const machine = await opened(page, context);
  await page.getByRole('button', { name: 'Ask', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: 'What do you want done?' });
  await expect(sheet).toBeVisible();
  if (info.project.name === 'desktop') {
    // D4.1: a panel docked in the main column, ready to type.
    await expect(page.getByRole('main').getByRole('dialog', { name: 'What do you want done?' })).toBeVisible();
    await expect(sheet.getByLabel('What do you want done?')).toBeFocused();
  }
  const to = sheet.getByRole('button', { name: /^SEND TO / });
  await expect(to).toHaveAccessibleName('SEND TO claude');
  await sheet.getByLabel('What do you want done?').fill('Read the build number from the environment and show it on /health');
  // The list in the select's place (M4.3, D4.3): the project's running agents, and no other project's.
  await to.click();
  const list = sheet.getByRole('listbox', { name: 'SEND TO' });
  await expect(list.getByRole('option')).toHaveText(['claude', 'codex']);
  await expect(list.getByRole('option', { selected: true })).toHaveText('claude');
  await list.getByRole('option', { name: 'codex', exact: true }).click();
  await expect(list).toHaveCount(0);
  await expect(to).toHaveAccessibleName('SEND TO codex');
  await sheet.getByRole('button', { name: 'Ask', exact: true }).click();
  await expect.poll(() => machine.of('act')).toEqual([
    expect.objectContaining({ act: 'ask', agent: '3f9a1c07b2de-1', text: 'Read the build number from the environment and show it on /health' }),
  ]);
  await expect(sheet).toHaveCount(0);
  await machine.close();
});

test('M4.3 D4.3: SEND TO by keyboard: arrows move, Enter picks, Escape closes the list and not the Ask', async ({ page, context }) => {
  const machine = await opened(page, context);
  await page.getByRole('button', { name: 'Ask', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: 'What do you want done?' });
  const to = sheet.getByRole('button', { name: /^SEND TO / });
  await to.focus();
  await page.keyboard.press('ArrowDown');
  const list = sheet.getByRole('listbox', { name: 'SEND TO' });
  await expect(list).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(list).toHaveCount(0);
  await expect(sheet).toBeVisible();
  await expect(to).toBeFocused();
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(to).toHaveAccessibleName('SEND TO codex');
  await expect(to).toBeFocused();
  expect(machine.of('act')).toHaveLength(0);
  await machine.close();
});

test('M4.1 D4.1: SEND TO starts on the selected work\'s agent; Cancel sends nothing', async ({ page, context }) => {
  const machine = await opened(page, context);
  await page.getByRole('treeitem', { name: 'health endpoint', exact: true }).click();
  await page.getByRole('button', { name: 'Ask', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: 'What do you want done?' });
  await expect(sheet.getByRole('button', { name: /^SEND TO / })).toHaveAccessibleName('SEND TO codex');
  await sheet.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(sheet).toHaveCount(0);
  expect(machine.of('act')).toHaveLength(0);
  await machine.close();
});
