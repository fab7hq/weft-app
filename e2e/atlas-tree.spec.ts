// The tree (M11.1, D11.1; M2.1–M2.5, M2.8, M7.1, D2.x): AGENTS, every session
// weftd holds, and WORK by Eval round; the bar's acts follow the selection;
// Sealed unfolds a page at a time. On the phone and the desktop.
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { FakeMachine, atlas, project, type Project, type Session } from './fake-machine';
import { CLAUDE, README_SESSION, large } from './atlas-fixtures';
import { row, wideOf } from './open';
import { person, signIn } from './seed';

async function opened(page: Page, context: BrowserContext, sample: Partial<ReturnType<typeof atlas>> = atlas(), shown = page.getByRole('tree', { name: 'Work' })) {
  const machine = await FakeMachine.start();
  Object.assign(machine, sample);
  machine.onAct = (m) => [
    { type: 'pending', id: 'pnd_1', agent: CLAUDE, what: 'Eval this work?', why: 'The agent will run the judges.', text: '/rf:eval debate' },
    { type: 'ok', req: m.req, pending: 'pnd_1' },
  ];
  await signIn(context, person('octo', [{ name: 'studio', address: machine.address }]));
  await page.goto('/');
  await expect(shown).toBeVisible();
  return machine;
}

const bar = (page: Page, name: string) => page.locator('.tree-bar .tree-acts').getByRole('button', { name, exact: true });
const said = (page: Page) => page.locator('.tree-bar .tree-said');
const empty = (ask: Project['ask'], setup: Project['setup'] = null): Project[] => [{ ...project('weft', []), ask, setup }];
const noneDisabled = (page: Page) => expect(page.locator('button:disabled, input:disabled, textarea:disabled, select:disabled')).toHaveCount(0);

test('M11.1 D11.1: AGENTS and WORK, as the cards draw them, amber only for waiting for you', async ({ page, context }) => {
  const machine = await opened(page, context);
  await expect(row(page, 'weft')).toContainText('2 open · 1 ●');
  await expect(page.locator('.tree-section')).toHaveText(['AGENTS3 running · 15 ended', 'WORKby Eval round', 'AGENTS1 running · 0 ended', 'WORKby Eval round']);
  const agents = page.locator('.tree-row--agent');
  await expect(agents).toHaveCount(7);
  const read = (i: number) => Promise.all(['.agent-harness', '.agent-state', '.agent-at', '.agent-title'].map((c) => agents.nth(i).locator(c).textContent()));
  expect(await read(0)).toEqual(['codex', 'working', '11:31', 'no Ask yet']);
  expect(await read(1)).toEqual(['claude', 'waiting for you', '11:29', 'fix login']);
  expect(await read(2)).toEqual(['codex', 'turn ended', '10:52', 'health endpoint']);
  expect(await read(3)).toEqual(['claude', 'ended', '09:12', 'readme fix']);
  expect(await read(4)).toEqual(['codex', 'ended', '08:30', 'lint pass']);
  expect(await read(5)).toEqual(['claude', 'ended', '08:02', 'no Ask yet']);
  await expect(agents.nth(0).locator('.agent-dot')).toHaveText('●');
  await expect(agents.nth(3).locator('.agent-dot')).toHaveText('○');
  await expect(row(page, '12 earlier sessions')).toBeVisible();
  await expect(row(page, 'Open')).toHaveText(/^▾Open · since Eval 3(Eval)?2$/);
  await expect(row(page, 'fix login')).toContainText('claude · ASKED');
  await expect(row(page, 'telemetry')).toContainText('claude · ASKING');
  await expect(row(page, 'Eval 3')).toContainText('Eval 3 · aligned · 0.67 · not sealed');
  // Under a round, title and harness only: the round says their state.
  await expect(row(page, 'health endpoint').locator('.tree-aside')).toHaveText('codex');
  await expect(row(page, 'build number').locator('.tree-aside')).toHaveText('codex');
  await expect(row(page, 'Sealed')).toHaveText(/^▸Sealed · 4 seals31$/);
  await expect(row(page, 'docs')).toContainText('0 open');
  await expect(page.getByText('NEEDS YOU 1')).toBeVisible();
  // Only an agent that waits for you is amber: its project's count, its dot.
  await expect(page.locator('[data-needs-you]')).toHaveText(['1 ●', '●']);
  await expect(agents.nth(1).locator('.agent-state')).toHaveClass(/needs/);
  for (const outside of ['in Weft', 'outside']) await expect(page.getByText(outside)).toHaveCount(0);
  await machine.close();
});

test('M11.1 D11.1: the bar follows the selection; an act that does not apply says why, and nothing is disabled', async ({ page, context }) => {
  const sample = atlas();
  const machine = await opened(page, context, sample);
  const wide = wideOf(page);
  // An agent: Ask goes to it; Eval and Seal say what to select.
  await row(page, 'claude · fix login').click();
  if (wide) await expect(page.getByLabel("The agent's screen")).toBeVisible();
  await expect(row(page, 'claude · fix login')).toHaveAttribute('aria-selected', 'true');
  await bar(page, 'Eval').click();
  await expect(said(page)).toHaveText('Select Open to Eval its Asks.');
  await bar(page, 'Seal').click();
  await expect(said(page)).toHaveText('Select an Eval to Seal it.');
  await bar(page, 'Ask').click();
  const sheet = page.getByRole('dialog', { name: 'What do you want done?' });
  await expect(sheet.getByRole('button', { name: /^SEND TO/ })).toHaveAccessibleName('SEND TO claude');
  await sheet.getByRole('button', { name: 'Cancel', exact: true }).click();
  if (!wide) await expect(page.getByRole('tree')).toBeVisible();

  // Open: Eval sends act eval on the project; Ask and Seal say what to select.
  await row(page, 'Open').click();
  await bar(page, 'Ask').click();
  await expect(said(page)).toHaveText('Select an agent to Ask.');
  await bar(page, 'Seal').click();
  await expect(said(page)).toHaveText('Select an Eval to Seal it.');
  await bar(page, 'Eval').click();
  await expect.poll(() => machine.of('act')).toEqual([expect.objectContaining({ act: 'eval', project: 'weft' })]);
  expect(machine.of('act')[0]).not.toHaveProperty('unit');
  await page.getByRole('dialog', { name: 'Eval this work?' }).getByRole('button', { name: 'Cancel', exact: true }).click();

  // An Eval: Seal sends act seal with its Eval.
  await row(page, 'Eval 3').click();
  if (wide) await page.getByRole('region', { name: 'Eval 3' }).waitFor();
  await bar(page, 'Eval').click();
  await expect(said(page)).toHaveText('Select Open to Eval its Asks.');
  await bar(page, 'Seal').click();
  await expect.poll(() => machine.of('act').at(-1)).toEqual(expect.objectContaining({ act: 'seal', project: 'weft', eval: 'evl_3' }));
  await page.getByRole('dialog', { name: 'Eval this work?' }).getByRole('button', { name: 'Cancel', exact: true }).click();

  // An Ask acts on its round: under Open, Eval; under Eval 3, Seal.
  await row(page, 'health endpoint').click();
  await bar(page, 'Seal').click();
  await expect.poll(() => machine.of('act').length).toBe(3);
  expect(machine.of('act')[2]).toMatchObject({ act: 'seal', eval: 'evl_3' });
  await page.getByRole('dialog', { name: 'Eval this work?' }).getByRole('button', { name: 'Cancel', exact: true }).click();

  // An ended session: Ask says to resume it (D12.4).
  await row(page, 'claude · readme fix').click();
  if (wide) await page.getByRole('region', { name: /^claude · 3f9c2b71/ }).waitFor();
  await bar(page, 'Ask').click();
  await expect(said(page)).toHaveText('claude has ended: resume this session to Ask it.');
  await noneDisabled(page);

  // A round the machine says cannot be sealed keeps its act, and says why (D12.6).
  const t = sample.tree;
  t[0].work.evals[0].seal = { key: 'why.sealed_already', title: 'Eval 3' };
  machine.send({ type: 'tree', tree: t });
  await row(page, 'Eval 3').click();
  await bar(page, 'Seal').click();
  await expect(said(page)).toHaveText('Eval 3 is sealed already.');
  expect(machine.of('act')).toHaveLength(3);
  await noneDisabled(page);
  await machine.close();
});

test('M11.1 D11.1: a session run by another program reads the same; Ask on it says why', async ({ page, context }) => {
  const sample = atlas();
  // codex no Ask yet runs in a terminal: no pane holds it (D9).
  Object.assign(sample.tree[0].agents.rows[0], { agent: null });
  const machine = await opened(page, context, sample);
  await expect(row(page, 'codex · no Ask yet').locator('.agent-state')).toHaveText('working');
  await row(page, 'codex · no Ask yet').click();
  await bar(page, 'Ask').click();
  await expect(said(page)).toHaveText("codex runs in another program: Weft can't show it or type into it.");
  await machine.close();
});

test('D11.1: the bar names the selection, and Ask, Eval and Seal sit on their rows', async ({ page, context }, info) => {
  test.skip(info.project.name !== 'desktop', 'a desktop');
  const machine = await opened(page, context);
  await expect(page.locator('.tree-selected')).toHaveCount(0);
  await row(page, 'claude · fix login').click();
  await expect(page.locator('.tree-selected')).toHaveText('selected: claude · 11:29');
  // Ask on the selected agent only.
  await expect(page.locator('.tree-row--agent .row-act')).toHaveCount(1);
  await row(page, 'claude · fix login').getByRole('button', { name: 'Ask claude · fix login', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'What do you want done?' }).getByRole('button', { name: /^SEND TO/ })).toHaveAccessibleName('SEND TO claude');
  await page.getByRole('dialog', { name: 'What do you want done?' }).getByRole('button', { name: 'Cancel', exact: true }).click();
  await row(page, 'Open').getByRole('button', { name: 'Eval Open', exact: true }).click();
  await expect.poll(() => machine.of('act')).toEqual([expect.objectContaining({ act: 'eval', project: 'weft' })]);
  await expect(page.locator('.tree-selected')).toHaveText('selected: Open round');
  await page.getByRole('dialog', { name: 'Eval this work?' }).getByRole('button', { name: 'Cancel', exact: true }).click();
  await row(page, 'Eval 3').getByRole('button', { name: 'Seal Eval 3', exact: true }).click();
  await expect.poll(() => machine.of('act').at(-1)).toEqual(expect.objectContaining({ act: 'seal', project: 'weft', eval: 'evl_3' }));
  await expect(page.locator('.tree-selected')).toHaveText('selected: Eval 3');
  await page.getByRole('dialog', { name: 'Eval this work?' }).getByRole('button', { name: 'Cancel', exact: true }).click();
  await row(page, 'fix login').click();
  await expect(page.locator('.tree-selected')).toHaveText('selected: fix login · Open round');
  await row(page, 'claude · readme fix').click();
  await expect(page.locator('.tree-selected')).toHaveText('selected: claude · ended 09:12');
  await machine.close();
});

test('M11.1 D11.1: › on a session, an Ask and an Eval open their Details; n earlier sessions › the earlier ones', async ({ page, context }) => {
  const machine = await opened(page, context);
  const wide = wideOf(page);
  if (wide) await row(page, 'claude · readme fix').click();
  else await row(page, 'claude · readme fix').getByRole('button', { name: /^Details of/ }).click();
  await expect(page.getByRole('region', { name: /^claude · 3f9c2b71…a21e$/ })).toBeVisible();
  await expect.poll(() => machine.of('read').at(-1)).toEqual(expect.objectContaining({ what: 'session', project: 'weft', session: README_SESSION }));
  if (!wide) await page.goBack();
  await row(page, 'fix login').getByRole('button', { name: 'Details of fix login' }).click();
  await expect(page.getByRole('region', { name: 'fix login' })).toBeVisible();
  if (!wide) await page.goBack();
  if (wide) await row(page, 'Eval 3').click();
  else await row(page, 'Eval 3').getByRole('button', { name: 'Details of Eval 3' }).click();
  await expect(page.getByRole('region', { name: 'Eval 3' })).toBeVisible();
  expect(machine.of('read').at(-1)).toMatchObject({ what: 'eval', project: 'weft', eval: 'evl_3' });
  if (!wide) await page.goBack();
  await row(page, '12 earlier sessions').click();
  await expect(page.getByRole('region', { name: 'Earlier sessions' })).toBeVisible();
  await machine.close();
});

test('M11.1 D11.1: Sealed unfolds a page at a time from read sealed, the next as it scrolls', async ({ page, context }) => {
  const big = large();
  const sample = atlas();
  sample.tree = [{ ...project('weft', big.sessions.slice(0, 5)), work: { open: { since: null, asks: [], eval: null }, evals: [], sealed: { seals: 120, asks: 400 } } }];
  sample.tree[0].agents = { running: 2, ended: 298, rows: big.sessions.slice(0, 5), earlier: 295 };
  sample.agents = [];
  sample.reads.sealed = { weft: big.sealed };
  const machine = await opened(page, context, sample);
  await expect(row(page, 'Sealed')).toContainText('120 seals');
  expect(machine.of('read')).toHaveLength(0);
  await row(page, 'Sealed').click();
  await expect(row(page, 'Seal 120')).toBeVisible();
  await expect(page.locator('.tree-row--seal')).toHaveCount(50);
  expect(machine.of('read')).toEqual([expect.objectContaining({ what: 'sealed', project: 'weft' })]);
  expect(machine.of('read')[0]).not.toHaveProperty('after');
  await row(page, 'Seal 71').scrollIntoViewIfNeeded();
  await expect(page.locator('.tree-row--seal')).toHaveCount(100);
  expect(machine.of('read')[1]).toMatchObject({ what: 'sealed', after: 'rcp_000071' });
  await row(page, 'Seal 21').scrollIntoViewIfNeeded();
  await expect(page.locator('.tree-row--seal')).toHaveCount(120);
  await expect(row(page, 'Seal 1')).toBeAttached();
  await page.waitForTimeout(300);
  expect(machine.of('read')).toHaveLength(3);
  await machine.close();
});

test('M11.1 D11.1: the tree follows the machine', async ({ page, context }) => {
  const sample = atlas();
  const machine = await opened(page, context, sample);
  await expect(page.getByText('NEEDS YOU 1')).toBeVisible();
  const t = sample.tree;
  Object.assign(t[0], { needs: 0, open: 3 });
  Object.assign(t[0].agents.rows[1], { turn: 'working' });
  t[0].work.open.asks.push({ unit: 'ask_9', title: 'new work', harness: 'codex', word: 'asking' });
  machine.agents = sample.agents.map((a, i) => (i === 0 ? { ...a, turn: 'working' } : a));
  machine.send({ type: 'agents', agents: machine.agents });
  machine.send({ type: 'tree', tree: t });
  await expect(row(page, 'new work')).toContainText('codex · ASKING');
  await expect(row(page, 'claude · fix login').locator('.agent-state')).toHaveText('working');
  await expect(page.getByText('NEEDS YOU 1')).toHaveCount(0);
  await expect(page.locator('[data-needs-you]')).toHaveCount(0);
  await machine.close();
});

test('M11.1 D11.1: ▾ ▸ fold a project or a round, and this browser keeps it', async ({ page, context }) => {
  const machine = await opened(page, context);
  await row(page, 'docs').click();
  await expect(row(page, 'docs')).toHaveAttribute('aria-expanded', 'false');
  await row(page, 'Eval 3').getByRole('button', { name: 'Fold Eval 3' }).click();
  await expect(row(page, 'health endpoint')).toHaveCount(0);
  await expect(row(page, 'fix login')).toBeVisible();
  await page.reload();
  await expect(row(page, 'docs')).toHaveAttribute('aria-expanded', 'false');
  await expect(row(page, 'health endpoint')).toHaveCount(0);
  await row(page, 'Eval 3').getByRole('button', { name: 'Unfold Eval 3' }).click();
  await expect(row(page, 'health endpoint')).toBeVisible();
  await machine.close();
});

test('M2.1 D2.1: the empty tree says nothing is asked', async ({ page, context }) => {
  const machine = await opened(page, context, { agents: [], tree: empty({ key: 'why.start_an_agent' }) }, page.getByText('Nothing asked for yet.'));
  await expect(page.getByText('Nothing asked for yet.')).toBeVisible();
  await machine.close();
});

test('M2.3 D2.3: a harness not set up says where to fix it', async ({ page, context }) => {
  const machine = await opened(page, context, { agents: [], tree: empty({ key: 'why.not_set_up', harness: 'claude' }) }, page.getByText('claude is not set up for RingFrame.'));
  await expect(page.getByText('claude is not set up for RingFrame.')).toBeVisible();
  await expect(page.getByText('Your agent runs here either way. Nothing is written down until it is set up.')).toBeVisible();
  await expect(page.getByText('Set it up in Weft on studio: U.')).toBeVisible();
  await machine.close();
});

test('M2.4 D2.4: RingFrame not set up here, the checklist says what it needs until it is', async ({ page, context }) => {
  const unset = (setup: Project['setup']) => empty({ key: 'why.start_an_agent' }, setup);
  const machine = await opened(page, context, { agents: [], tree: unset({ ringframe: true, git: false, commit: false }) });
  await expect(row(page, 'weft')).toBeVisible();
  const checklist = page.getByRole('list', { name: 'RingFrame is not set up here yet.' });
  await expect(page.getByText('RingFrame is not set up here yet.')).toBeVisible();
  await expect(checklist.getByRole('listitem')).toHaveText([/^✓\s*ringframe is installed$/, /^✗\s*a Git repository\s*git init$/, /^✗\s*a first commit\s*commit once$/]);
  await expect(page.getByText('Weft sets it up as soon as these hold.')).toBeVisible();
  machine.send({ type: 'tree', tree: unset({ ringframe: true, git: true, commit: false }) });
  await expect(checklist.getByRole('listitem')).toHaveText([/^✓/, /^✓\s*a Git repository$/, /^✗\s*a first commit\s*commit once$/]);
  machine.send({ type: 'tree', tree: unset({ ringframe: false, git: null, commit: null }) });
  await expect(checklist.getByRole('listitem')).toHaveText([/^✗\s*ringframe is installed\s*run Weft's installer again$/, /^\?\s*a Git repository$/, /^\?\s*a first commit$/]);
  machine.send({ type: 'tree', tree: unset(null) });
  await expect(page.getByText('Nothing asked for yet.')).toBeVisible();
  await expect(checklist).toHaveCount(0);
  await machine.close();
});

/** weft with one session, claude ready, and nothing asked. */
function oneClaude(ask: Project['ask'] = null) {
  const sample = atlas();
  const claude: Session = { ...sample.tree[0].agents.rows[1], turn: 'ready', title: null };
  return { ...sample, agents: [{ ...sample.agents[0], turn: 'ready' as const }], tree: [{ ...project('weft', [claude]), ask }] };
}

test('M2.5: an agent with nothing asked of it says to ask', async ({ page, context }) => {
  const machine = await opened(page, context, oneClaude());
  await expect(row(page, 'weft')).toContainText('0 open');
  await expect(page.getByText('Ask for something and Weft writes it down.')).toBeVisible();
  await machine.close();
});

test('M2.8: a tree longer than the screen scrolls, with no markers', async ({ page, context }) => {
  const sample = atlas();
  sample.tree[0].work.open.asks = Array.from({ length: 24 }, (_, i) => ({ unit: `ask_${i + 10}`, title: `task ${i}`, harness: 'claude', word: 'asked' as const }));
  const machine = await opened(page, context, sample);
  const tree = page.getByRole('tree', { name: 'Work' });
  await expect(row(page, 'task 23')).toHaveCount(1);
  expect(await tree.evaluate((e) => e.scrollHeight > e.clientHeight)).toBe(true);
  await expect(page.getByText(/above|more$/)).toHaveCount(0);
  await machine.close();
});

test('M7.1 D7.1: a harness not set up is marked ⚠ on its sessions; Ask on one says where to set it up', async ({ page, context }) => {
  const sample = oneClaude({ key: 'why.not_set_up', harness: 'claude' });
  sample.tree[0].agents.rows[0].ask = { key: 'why.not_set_up', harness: 'claude' };
  const machine = await opened(page, context, sample);
  await expect(row(page, 'claude · no Ask yet').locator('.agent-harness')).toHaveText('claude ⚠');
  // The ⚠ says it: no line under it.
  await expect(page.getByText('Ask for something and Weft writes it down.')).toHaveCount(0);
  await row(page, 'claude · no Ask yet').click();
  await expect(row(page, 'claude · no Ask yet')).toHaveAttribute('aria-selected', 'true');
  await bar(page, 'Ask').click();
  await expect(said(page)).toHaveText('claude is not set up for RingFrame. Set it up in Weft on studio: U.');
  await machine.close();
});
