// Step 37, web-app.md §7, §11 test 5: an Ask becomes a pending shown byte for
// byte; "Answered on the machine" when it is answered there first.
import { expect, test } from '@playwright/test';
import { FakeMachine, agent } from './fake-machine';
import { person, signIn } from './seed';

const EXACT = '/goal Add a /health endpoint  that answers 200.\n\n  Done when: test/health.test.ts passes — "quoted", <tags>, émoji ✓ and 表.\n\ttabbed';

function pendingFor(m: Record<string, unknown>, id: string, what: string) {
  return [
    { type: 'pending', id, agent: m.agent, what, why: 'This is the exact wording RingFrame recorded.', text: EXACT },
    { type: 'ok', req: m.req, pending: id },
  ];
}

test('an Ask is composed, then shown exactly as it will be typed, then said yes to', async ({ page, context }) => {
  const machine = await FakeMachine.start();
  machine.agents = [agent(0, 'weft', 'claude-code', 'ready')];
  machine.onAct = (m) => pendingFor(m, 'pnd_1', 'Ready to send to claude-code');
  await signIn(context, person('octo', [{ name: 'studio', address: machine.address }]));
  await page.goto('/');
  await page.getByRole('treeitem', { name: 'claude-code', exact: true }).first().click();

  await page.getByRole('button', { name: 'The bar', exact: true }).click();
  await page.getByRole('dialog', { name: 'Weft' }).getByRole('button', { name: 'Ask', exact: true }).click();
  await page.getByRole('textbox', { name: 'What do you want done?' }).fill('Add a health endpoint');
  await page.getByRole('button', { name: 'Ask', exact: true }).click();
  await expect.poll(() => machine.of('act').length).toBe(1);
  expect(machine.of('act')[0]).toMatchObject({ act: 'ask', agent: '3f9a1c07b2de-0', text: 'Add a health endpoint' });

  const sheet = page.getByRole('dialog', { name: 'Ready to send to claude-code' });
  await expect(sheet).toBeVisible();
  expect(await sheet.locator('pre').textContent()).toBe(EXACT);
  await sheet.getByRole('button', { name: 'Send', exact: true }).click();
  await expect.poll(() => machine.of('resolve').length).toBe(1);
  expect(machine.of('resolve')[0]).toMatchObject({ pending: 'pnd_1', yes: true });
  expect(machine.of('resolve')[0]).not.toHaveProperty('force');
  await expect(sheet).toHaveCount(0);
  await machine.close();
});

test('an Ask answered on the machine first closes the sheet and says so', async ({ page, context }) => {
  const machine = await FakeMachine.start();
  machine.agents = [agent(0, 'weft', 'claude-code', 'ready')];
  machine.onAct = (m) => pendingFor(m, 'pnd_2', 'Ready to ask claude-code');
  await signIn(context, person('octo', [{ name: 'studio', address: machine.address }]));
  await page.goto('/');
  await page.getByRole('treeitem', { name: 'claude-code', exact: true }).first().click();
  await page.getByRole('button', { name: 'The bar', exact: true }).click();
  await page.getByRole('dialog', { name: 'Weft' }).getByRole('button', { name: 'Ask', exact: true }).click();
  await page.getByRole('textbox', { name: 'What do you want done?' }).fill('Add a health endpoint');
  await page.getByRole('button', { name: 'Ask', exact: true }).click();
  await expect.poll(() => machine.of('act').length).toBe(1);
  const sheet = page.getByRole('dialog', { name: 'Ready to ask claude-code' });
  await expect(sheet).toBeVisible();
  machine.send({ type: 'resolved', id: 'pnd_2', yes: true });
  await expect(page.getByText('Answered on the machine')).toBeVisible();
  await expect(sheet.getByRole('button', { name: 'Send', exact: true })).toHaveCount(0);
  expect(machine.of('resolve')).toHaveLength(0);
  await machine.close();
});
