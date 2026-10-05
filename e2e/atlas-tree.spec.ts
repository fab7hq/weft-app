// The tree replaces the agent list (M2.1–M2.9, D2.1–D2.9), on the phone and the desktop.
import { expect, test, type Page } from '@playwright/test';
import { FakeMachine, atlas, type Project } from './fake-machine';
import { person, signIn } from './seed';

async function opened(page: Page, context: import('@playwright/test').BrowserContext, tree: Project[], agents = atlas().agents) {
  const machine = await FakeMachine.start();
  machine.agents = agents;
  machine.tree = tree;
  await signIn(context, person('octo', [{ name: 'studio', address: machine.address }]));
  await page.goto('/');
  return machine;
}

const row = (page: Page, name: string) => page.getByRole('treeitem', { name, exact: true }).first();
const empty = (ask: Project['ask']): Project[] => [{ project: 'weft', open: 0, needs: 0, ask, harnesses: [] }];

test('M2.6 D2.6: the tree, its words, amber only for needs you', async ({ page, context }) => {
  const machine = await opened(page, context, atlas().tree);
  await expect(row(page, 'weft')).toContainText('2 open · 1 ●');
  await expect(row(page, 'claude')).toContainText('● needs you');
  await expect(row(page, 'fix login')).toContainText('waiting · ASKED');
  await expect(row(page, 'telemetry')).toContainText('ASKING');
  await expect(row(page, 'health endpoint')).toContainText('turn ended · EVALED');
  await expect(row(page, 'readme fix')).toContainText('SEALED');
  await expect(row(page, 'docs')).toContainText('1 open');
  await expect(page.getByText('NEEDS YOU 1')).toBeVisible();
  // Only an agent that needs you is marked: its project count, its harness, its turn.
  await expect(page.locator('[data-needs-you]')).toHaveText(['1 ●', '● needs you', 'waiting']);
  // The agent list's groups are gone.
  for (const group of ['Needs you', 'Working', 'Idle']) await expect(page.getByText(group, { exact: true })).toHaveCount(0);
  await machine.close();
});

test('M2.6 D2.6: a tap selects a work, › opens its Details, a harness opens its agent', async ({ page, context }) => {
  const machine = await opened(page, context, atlas().tree);
  const health = row(page, 'health endpoint');
  await health.click();
  await expect(health).toHaveAttribute('aria-selected', 'true');
  await expect(row(page, 'fix login')).toHaveAttribute('aria-selected', 'false');
  machine.onRead = (m) => ({ type: 'ok', req: m.req, detail: { title: 'health endpoint', harness: 'codex', provenance: '', sections: [], proceed: false, eval_view: false, follows: 'ask_3' } });
  await health.getByRole('button', { name: 'Details of health endpoint' }).click();
  await expect(page.getByRole('region', { name: 'health endpoint' })).toBeVisible();
  await page.goBack();
  await row(page, 'claude').click();
  await expect(page.getByLabel("The agent's screen")).toBeVisible();
  await expect.poll(() => machine.of('watch').at(-1)?.agent).toBe('3f9a1c07b2de-0');
  await machine.close();
});

test('M2.6 D2.6: the tree follows the machine', async ({ page, context }) => {
  const sample = atlas();
  const machine = await opened(page, context, sample.tree);
  await expect(page.getByText('NEEDS YOU 1')).toBeVisible();
  const t = sample.tree;
  Object.assign(t[0], { needs: 0 });
  t[0].harnesses[0].turn = 'working';
  t[0].harnesses[0].works[0].turn = 'working';
  t[0].harnesses[1].works.push({ unit: 'ask_9', title: 'new work', word: 'asking', turn: null, eval: null, seal: null });
  machine.agents = sample.agents.map((a, i) => (i === 0 ? { ...a, turn: 'working' } : a));
  machine.send({ type: 'agents', agents: machine.agents });
  machine.send({ type: 'tree', tree: t });
  await expect(row(page, 'new work')).toContainText('ASKING');
  await expect(row(page, 'fix login')).toContainText('working · ASKED');
  await expect(page.getByText('NEEDS YOU 1')).toHaveCount(0);
  await expect(page.locator('[data-needs-you]')).toHaveCount(0);
  await machine.close();
});

test('M2.7 D2.7: ▾ ▸ fold a project or a harness, and this browser keeps it', async ({ page, context }) => {
  const machine = await opened(page, context, atlas().tree);
  await row(page, 'docs').click();
  await expect(row(page, 'docs')).toHaveAttribute('aria-expanded', 'false');
  await row(page, 'codex').getByRole('button', { name: 'Fold codex' }).click();
  await expect(row(page, 'health endpoint')).toHaveCount(0);
  await expect(row(page, 'fix login')).toBeVisible();
  await page.reload();
  await expect(row(page, 'docs')).toHaveAttribute('aria-expanded', 'false');
  await expect(row(page, 'health endpoint')).toHaveCount(0);
  await row(page, 'codex').getByRole('button', { name: 'Unfold codex' }).click();
  await expect(row(page, 'health endpoint')).toBeVisible();
  await machine.close();
});

test('M2.9 D2.9: turbo is marked, and work with no agent running shows no turn', async ({ page, context }) => {
  const t = atlas().tree;
  const [claude, codex] = t[0].harnesses;
  claude.turbo = true;
  Object.assign(codex, { agent: null, turn: null, running: false });
  codex.works = codex.works.slice(0, 1).map((w) => ({ ...w, turn: null }));
  const machine = await opened(page, context, t);
  await expect(row(page, 'claude')).toContainText('claude ⚡');
  await expect(row(page, 'codex')).toContainText('codex · not running');
  await expect(row(page, 'health endpoint')).toHaveText(/^health endpointEVALED›$/);
  await machine.close();
});

test('M2.1 D2.1: the empty tree says nothing is asked', async ({ page, context }) => {
  const machine = await opened(page, context, empty({ key: 'why.start_an_agent' }), []);
  await expect(page.getByText('Nothing asked for yet.')).toBeVisible();
  await machine.close();
});

test('M2.3 D2.3: a harness not set up says where to fix it', async ({ page, context }) => {
  const machine = await opened(page, context, empty({ key: 'why.not_set_up', harness: 'claude' }), []);
  await expect(page.getByText('claude is not set up for RingFrame.')).toBeVisible();
  await expect(page.getByText('Your agent runs here either way. Nothing is written down until it is set up.')).toBeVisible();
  await expect(page.getByText('Set it up in Weft on studio: U.')).toBeVisible();
  await machine.close();
});

test('M2.4: no ringframe on the machine', async ({ page, context }) => {
  const machine = await opened(page, context, empty({ key: 'why.no_ringframe' }), []);
  await expect(page.getByText('No ringframe on PATH, so there is no record to read.')).toBeVisible();
  await expect(page.getByText('The agents still run here. Install ringframe to see the work.')).toBeVisible();
  await machine.close();
});

test('M2.5: an agent with nothing asked of it says to ask', async ({ page, context }) => {
  const [claude] = atlas().tree[0].harnesses;
  const t: Project[] = [{ project: 'weft', open: 1, needs: 0, ask: null, harnesses: [{ ...claude, turn: 'ready', works: [] }] }];
  const machine = await opened(page, context, t, atlas().agents.slice(0, 1));
  await expect(row(page, 'weft')).toContainText('1 open');
  await expect(page.getByText('Ask for something and Weft writes it down.')).toBeVisible();
  await machine.close();
});

test('M2.8: a tree longer than the screen scrolls, with no markers', async ({ page, context }) => {
  const t = atlas().tree;
  t[0].harnesses[0].works = Array.from({ length: 24 }, (_, i) => ({ unit: `ask_${i}`, title: `task ${i}`, word: 'asked' as const, turn: null, eval: null, seal: null }));
  const machine = await opened(page, context, t);
  const tree = page.getByRole('tree', { name: 'Work' });
  await expect(row(page, 'task 23')).toHaveCount(1);
  expect(await tree.evaluate((e) => e.scrollHeight > e.clientHeight)).toBe(true);
  await expect(page.getByText(/above|more$/)).toHaveCount(0);
  await machine.close();
});
