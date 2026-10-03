// Step 37, web-app.md §7, §11 test 5: Ask, Eval and Seal become pendings shown
// byte for byte; "Answered on the machine" when it is answered there first.
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
  await page.getByText('weft · Claude Code').click();

  await page.getByRole('button', { name: 'The bar', exact: true }).click();
  await page.getByRole('dialog', { name: 'Weft' }).getByRole('button', { name: 'Ask', exact: true }).click();
  await page.getByLabel('What do you want done?').fill('Add a health endpoint');
  await page.getByRole('button', { name: 'Ask', exact: true }).click();
  await expect.poll(() => machine.of('act').length).toBe(1);
  expect(machine.of('act')[0]).toMatchObject({ act: 'ask', agent: '3f9a1c07b2de-0', text: 'Add a health endpoint' });

  const sheet = page.getByRole('dialog', { name: 'Ready to send to claude-code' });
  await expect(sheet).toBeVisible();
  expect(await sheet.locator('pre').textContent()).toBe(EXACT);
  await sheet.getByRole('button', { name: 'Yes, type it' }).click();
  await expect.poll(() => machine.of('resolve').length).toBe(1);
  expect(machine.of('resolve')[0]).toMatchObject({ pending: 'pnd_1', yes: true });
  expect(machine.of('resolve')[0]).not.toHaveProperty('force');
  await expect(sheet).toHaveCount(0);
  await machine.close();
});

test('an Eval answered on the machine first closes the sheet and says so', async ({ page, context }) => {
  const machine = await FakeMachine.start();
  machine.agents = [{ ...agent(0, 'weft', 'claude-code', 'ready'), unit: { id: 'ask_1', title: 'health endpoint', eval: null } }];
  machine.onAct = (m) => pendingFor(m, 'pnd_2', 'Ready to check with codex');
  await signIn(context, person('octo', [{ name: 'studio', address: machine.address }]));
  await page.goto('/');
  await page.getByText('weft · Claude Code').click();
  await page.getByRole('button', { name: 'The bar', exact: true }).click();
  await page.getByRole('dialog', { name: 'Weft' }).getByRole('button', { name: 'Eval', exact: true }).click();
  await expect.poll(() => machine.of('act').length).toBe(1);
  expect(machine.of('act')[0]).toMatchObject({ act: 'eval', agent: '3f9a1c07b2de-0' });
  const sheet = page.getByRole('dialog', { name: 'Ready to check with codex' });
  await expect(sheet).toBeVisible();
  machine.send({ type: 'resolved', id: 'pnd_2', yes: true });
  await expect(page.getByText('Answered on the machine')).toBeVisible();
  await expect(sheet.getByRole('button', { name: 'Yes, type it' })).toHaveCount(0);
  expect(machine.of('resolve')).toHaveLength(0);
  await machine.close();
});

test('the Eval record shows what was met and not, with its evidence, and seals from there', async ({ page, context }) => {
  const machine = await FakeMachine.start();
  machine.agents = [{ ...agent(0, 'weft', 'claude-code', 'ready'), unit: { id: 'ask_1', title: 'health endpoint', eval: 'evl_1' } }];
  machine.onRead = (m) => ({
    type: 'ok',
    req: m.req,
    record: {
      eval_id: 'evl_1',
      closed: true,
      verdict: 'drifted',
      confidence: 0.67,
      groups: [
        {
          key: 'g1',
          title: 'health endpoint',
          steps: [
            { id: 's1', label: '1', text: 'answers 200 with the build number', done_when: '', state: 'met', changes: [], readings: [{ role: 'trace', vote: 'met', reason: 'server.ts returns { status, build }', missing: '', counted: true, cites: [] }], findings: [] },
            { id: 's2', label: '2', text: 'the build number is set in CI', done_when: '', state: 'not_met', changes: [], readings: [{ role: 'adversary', vote: 'not_met', reason: 'nothing in .github/workflows sets BUILD_NUMBER', missing: '', counted: true, cites: [] }], findings: [] },
          ],
        },
      ],
      progress: [], findings: [], unexplained: [], changes: [], checks: [], limitations: [],
    },
  });
  machine.onAct = (m) => pendingFor(m, 'pnd_3', 'Ready to seal');
  await signIn(context, person('octo', [{ name: 'studio', address: machine.address }]));
  await page.goto('/');
  await page.getByText('weft · Claude Code').click();
  await page.getByRole('button', { name: 'The bar', exact: true }).click();
  await page.getByRole('dialog', { name: 'Weft' }).getByRole('button', { name: 'Eval view' }).click();
  const record = page.getByRole('dialog', { name: 'Eval record' });
  await expect(record.getByText('Met · answers 200 with the build number')).toBeVisible();
  await expect(record.getByText('Not met · the build number is set in CI')).toBeVisible();
  await expect(record.getByText('nothing in .github/workflows sets BUILD_NUMBER')).toBeVisible();
  await record.getByRole('button', { name: 'Seal' }).click();
  await expect.poll(() => machine.of('act').length).toBe(1);
  expect(machine.of('act')[0]).toMatchObject({ act: 'seal', agent: '3f9a1c07b2de-0' });
  await expect(page.getByRole('dialog', { name: 'Ready to seal' })).toBeVisible();
  await machine.close();
});
