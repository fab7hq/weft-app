// Why-not sentences (M10.1, M10.2, D10.1, D10.2): where an act cannot run, its
// sentence, never a disabled button; the next press clears it.
import { readFileSync } from 'node:fs';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { FakeMachine, atlas } from './fake-machine';
import { openAgent } from './open';
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

test('M10.1 D10.1 M11.1: Eval with nothing picked says what to select, and the next press clears it', async ({ page, context }) => {
  const machine = await opened(page, context);
  await page.getByRole('button', { name: 'Eval', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Select Open to Eval its Asks.');
  await page.getByRole('treeitem', { name: 'Open', exact: true }).click();
  await expect(page.getByText('Select Open to Eval its Asks.')).toHaveCount(0);
  await noneDisabled(page);
  await machine.close();
});

test('M10.1 D10.1: each why-not on a round is said in its sentence', async ({ page, context }) => {
  const machine = await opened(page, context);
  const keys = Object.keys(WORDS).filter((k) => k.startsWith('why.') && k !== 'why.not_set_up');
  expect(keys.length).toBeGreaterThan(5);
  await page.getByRole('treeitem', { name: 'Open', exact: true }).click();
  for (const key of keys) {
    const tree = atlas().tree;
    tree[0].work.open.eval = { key, harness: 'codex', title: 'health endpoint' };
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
  await openAgent(page, 'claude · fix login');
  const box = page.getByPlaceholder('Message claude…');
  await box.fill('try again');
  // ▶ sends: on a touch screen Enter is a new line (M3.13).
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Weft did not type it: it is still typing the last one.');
  // On a phone the box stands without ▶ until it is used again (M10.2); a desktop keeps it (D10.2).
  const send = page.getByRole('button', { name: 'Send', exact: true });
  const wide = page.viewportSize()!.width >= 768;
  await expect(send).toHaveCount(wide ? 1 : 0);
  await box.pressSequentially('x');
  await expect(send).toHaveCount(1);
  await expect(page.getByText('Weft did not type it: it is still typing the last one.')).toHaveCount(0);
  await noneDisabled(page);
  // While the machine is away, nothing is disabled either: a press says why.
  machine.down = true;
  machine.drop();
  await expect(page.getByText('Reconnecting')).toBeVisible();
  await noneDisabled(page);
  await box.fill('again');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.locator('.tree-said')).toHaveText('Not connected to the machine.');
  await machine.close();
});

test('M10.3: an agent that ends says so at the foot of the tree, in the TUI\'s words; the next tap clears it', async ({ page, context }) => {
  const machine = await opened(page, context);
  const said = fill(WORDS['agent.ended'], { harness: 'claude' });
  const s = atlas();
  s.agents[3].running = false;
  machine.send({ type: 'agents', agents: s.agents });
  await expect(page.locator('.tree-bar').getByRole('status')).toHaveText(said);
  await page.getByRole('treeitem', { name: 'weft', exact: true }).click();
  await expect(page.getByText(said)).toHaveCount(0);
  await machine.close();
});
