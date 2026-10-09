// The tree's bar (M11.1, D11.1, M10.1, D10.1): Ask, Eval and Seal on the
// selection; where one cannot run, its sentence; NEEDS YOU opens the next
// agent; no shortcuts. atlas-tree.spec.ts holds what each selection does.
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { FakeMachine, atlas, project } from './fake-machine';
import { person, signIn } from './seed';

async function opened(page: Page, context: BrowserContext, sample = atlas()) {
  const machine = await FakeMachine.start();
  Object.assign(machine, sample);
  machine.onAct = (m) => [
    { type: 'pending', id: 'pnd_1', agent: '3f9a1c07b2de-1', what: 'Eval this work?', why: 'Weft will type /rf:eval into codex.', text: '/rf:eval debate evl_2' },
    { type: 'ok', req: m.req, pending: 'pnd_1' },
  ];
  await signIn(context, person('octo', [{ name: 'studio', address: machine.address }]));
  await page.goto('/');
  await expect(page.locator('.tree-acts').getByRole('button', { name: 'Ask', exact: true })).toBeVisible();
  await expect.poll(() => machine.of('hello').length).toBe(1);
  return machine;
}

const work = (page: Page, name: string) => page.getByRole('treeitem', { name, exact: true }).first();
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });

test('M10.1 D10.1: Eval and Seal with nothing selected say what to select, until the next press', async ({ page, context }) => {
  const machine = await opened(page, context);
  await button(page, 'Eval').click();
  await expect(page.getByRole('status')).toHaveText('Select Open to Eval its Asks.');
  await button(page, 'Seal').click();
  await expect(page.getByRole('status')).toHaveText('Select an Eval to Seal it.');
  await work(page, 'fix login').click();
  await expect(page.getByText('Select an Eval to Seal it.')).toHaveCount(0);
  expect(machine.of('act')).toHaveLength(0);
  await machine.close();
});

test('M10.1 D10.1: Open that cannot be judged says why, and nothing is sent', async ({ page, context }) => {
  const sample = atlas();
  sample.tree[0].work.open.eval = { key: 'why.not_set_up', harness: 'codex' };
  const machine = await opened(page, context, sample);
  await work(page, 'Open').click();
  await button(page, 'Eval').click();
  await expect(page.getByRole('status')).toHaveText('codex is not set up for RingFrame. Set it up in Weft on studio: U.');
  expect(machine.of('act')).toHaveLength(0);
  await machine.close();
});

test('M11.1 D11.1: NEEDS YOU opens the agent that needs you', async ({ page, context }) => {
  const machine = await opened(page, context);
  await page.getByRole('button', { name: 'NEEDS YOU 1' }).click();
  await expect.poll(() => machine.of('watch').at(-1)?.agent).toBe('3f9a1c07b2de-0');
  await machine.close();
});

test('M10.1 D10.1: Ask with no agent running says to start one', async ({ page, context }) => {
  const machine = await opened(page, context, { agents: [], tree: [{ ...project('weft', []), ask: { key: 'why.start_an_agent' } }], harnesses: [], reads: atlas().reads });
  await button(page, 'Ask').click();
  await expect(page.getByRole('status')).toHaveText('Start an agent first — on studio.');
  await machine.close();
});

test('D11.1: letters typed outside a focused pane do nothing', async ({ page, context }, info) => {
  test.skip(info.project.name !== 'desktop', 'a keyboard');
  const machine = await opened(page, context);
  await work(page, 'health endpoint').click();
  for (const key of ['a', 'e', 's', 'w', 'l', 'h', '1', 'Control+BracketRight']) await page.keyboard.press(key);
  await page.waitForTimeout(300);
  expect(machine.of('act')).toHaveLength(0);
  expect(machine.of('keys')).toHaveLength(0);
  await expect(page.getByLabel("The agent's screen")).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await machine.close();
});
