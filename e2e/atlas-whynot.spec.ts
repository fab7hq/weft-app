// Why-not sentences (M10.1, M10.2, D10.1, D10.2): where an act cannot run, its
// sentence, never a disabled button; the next press clears it.
import { readFileSync } from 'node:fs';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { FakeMachine, atlas } from './fake-machine';
import { person, signIn } from './seed';

const WORDS: Record<string, string> = JSON.parse(readFileSync('web/public/words.json', 'utf8'));
const fill = (s: string, v: Record<string, string>) => Object.entries(v).reduce((t, [k, x]) => t.replaceAll(`{${k}}`, x), s);

async function opened(page: Page, context: BrowserContext) {
  const machine = await FakeMachine.start();
  Object.assign(machine, atlas());
  await signIn(context, person('octo', [{ name: 'studio', address: machine.address }]));
  await page.goto('/');
  await expect(page.getByRole('treeitem', { name: 'weft', exact: true })).toBeVisible();
  return machine;
}

const noneDisabled = async (page: Page) => expect(page.locator('button:disabled, input:disabled, textarea:disabled, select:disabled')).toHaveCount(0);

test('M10.1 D10.1: Eval with nothing picked says so, and the next press clears it', async ({ page, context }) => {
  const machine = await opened(page, context);
  await page.getByRole('button', { name: 'Eval', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Nothing to work on yet.');
  await page.getByRole('treeitem', { name: 'health endpoint', exact: true }).click();
  await page.getByRole('button', { name: 'Eval', exact: true }).click();
  await expect(page.getByText('Nothing to work on yet.')).toHaveCount(0);
  await noneDisabled(page);
  await machine.close();
});

test('M10.1 D10.1: each why-not on a work is said in its sentence', async ({ page, context }) => {
  const machine = await opened(page, context);
  const keys = Object.keys(WORDS).filter((k) => k.startsWith('why.'));
  expect(keys.length).toBeGreaterThan(5);
  await page.getByRole('treeitem', { name: 'health endpoint', exact: true }).click();
  for (const key of keys) {
    const tree = atlas().tree;
    tree[0].harnesses[1].works[0].eval = { key, harness: 'codex', title: 'health endpoint' };
    machine.send({ type: 'tree', tree });
    await page.getByRole('button', { name: 'Eval', exact: true }).click();
    await expect(page.getByRole('status')).toHaveText(fill(WORDS[key], { harness: 'codex', title: 'health endpoint', machine: 'studio' }));
  }
  expect(machine.of('act')).toHaveLength(0);
  await machine.close();
});

test('M10.2 D10.2: a text the machine did not type says why above the message box', async ({ page, context }) => {
  const machine = await opened(page, context);
  machine.onText = (m) => ({ type: 'error', req: m.req, code: 'in_flight', message: 'still typing' });
  await page.getByRole('treeitem', { name: 'claude', exact: true }).first().click();
  const box = page.getByPlaceholder('Message claude…');
  await box.fill('try again');
  await box.press('Enter');
  await expect(page.getByRole('status')).toHaveText('Weft did not type it: it is still typing the last one.');
  await noneDisabled(page);
  // While the machine is away, nothing is disabled either: a press says why.
  machine.down = true;
  machine.drop();
  await expect(page.getByText('Reconnecting')).toBeVisible();
  await noneDisabled(page);
  await box.fill('again');
  await box.press('Enter');
  await expect(page.locator('.tree-said')).toHaveText('Not connected to the machine.');
  await machine.close();
});

test('M10.3: an agent that ends says so at the foot of the tree, in the TUI\'s words; the next tap clears it', async ({ page, context }) => {
  const machine = await opened(page, context);
  const said = fill(WORDS['agent.ended'], { harness: 'claude' });
  const s = atlas();
  s.agents[2].running = false;
  machine.send({ type: 'agents', agents: s.agents });
  await expect(page.locator('.tree-bar').getByRole('status')).toHaveText(said);
  await page.getByRole('treeitem', { name: 'weft', exact: true }).click();
  await expect(page.getByText(said)).toHaveCount(0);
  await machine.close();
});
