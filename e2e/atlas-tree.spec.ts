// The tree (M11.1, D11.1; M2.1–M2.5, M2.8, M7.1, D2.x): AGENTS, every session
// weftd holds, and WORK, a row per unit of work; the bar's acts follow the
// selection; the earlier sealed units unfold a page at a time. On the phone
// and the desktop.
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { FakeMachine, agent, atlas, project, sessionOf, type Project, type Session } from './fake-machine';
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

test('M11.1 D11.1: AGENTS and WORK, as the cards draw them: one line a row, the status a shape, amber only for an agent that needs you', async ({ page, context }) => {
  const machine = await opened(page, context);
  // Open, a project says nothing more of itself; its rows say it.
  // ⋯ opens the project's own settings (M9.12, D9.12).
  await expect(row(page, 'weft')).toHaveText('▾weft⋯+');
  await expect(page.locator('.tree-section')).toHaveText(['AGENTS', 'WORK', 'AGENTS', 'WORK']);
  const agents = page.locator('.tree-row--agent');
  await expect(agents).toHaveCount(7);
  const read = (i: number) => agents.nth(i).evaluate((e) => ['.agent-dot', '.agent-harness', '.agent-title', '.agent-at'].map((c) => e.querySelector(c)?.textContent ?? null));
  const state = (i: number) => agents.nth(i).locator('.agent-dot').getAttribute('aria-label');
  expect(await read(0)).toEqual(['●', 'codex', null, '11:31']);
  expect(await state(0)).toBe('working');
  expect(await read(1)).toEqual(['■', 'claude', 'fix login', '11:29']);
  expect(await state(1)).toBe('needs you');
  expect(await read(2)).toEqual(['●', 'codex', 'health endpoint', '10:52']);
  expect(await state(2)).toBe('turn ended');
  expect(await read(3)).toEqual(['□', 'claude', 'readme fix', '09:12']);
  expect(await read(4)).toEqual(['□', 'codex', 'lint pass', '08:30']);
  expect(await read(5)).toEqual(['□', 'claude', null, '08:02']);
  expect(await state(5)).toBe('ended');
  // No state in words on a row.
  for (const word of ['working', 'needs you', 'turn ended', 'no Ask yet']) await expect(page.locator('.tree').getByText(word, { exact: true })).toHaveCount(0);
  await expect(row(page, '12 earlier sessions')).toBeVisible();
  // WORK: a row per unit, its title, its harness and one status; no rounds.
  const status = (name: string) => row(page, name).locator('.work-status');
  await expect(status('fix login')).toHaveText('asked');
  await expect(status('health endpoint')).toHaveText('aligned · 0.67');
  await expect(status('health endpoint')).toHaveClass(/good/);
  await expect(status('telemetry')).toHaveText('asking');
  await expect(status('readme fix')).toHaveText('sealed · accepted');
  await expect(row(page, 'health endpoint').locator('.work-harness')).toHaveText('codex');
  for (const round of ['Open', 'Eval 3', 'Sealed', 'build number']) await expect(row(page, round)).toHaveCount(0);
  await expect(row(page, '4 sealed earlier')).toBeVisible();
  await expect(page.getByText('■ NEEDS YOU 1')).toBeVisible();
  // Only an agent that waits for you is amber: its square.
  await expect(page.locator('[data-needs-you]')).toHaveText(['■']);
  await expect(agents.nth(1).locator('.agent-dot')).toHaveClass(/needs/);
  // Folded, a project says what waits in it.
  await row(page, 'weft').click();
  await expect(row(page, 'weft')).toHaveText('▸weft■ 1⋯+');
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
  await expect(said(page)).toHaveText('Select a work to Eval it.');
  await bar(page, 'Seal').click();
  await expect(said(page)).toHaveText('Select a work to Seal it.');
  await bar(page, 'Ask').click();
  const sheet = page.getByRole('dialog', { name: 'What do you want done?' });
  await expect(sheet.getByRole('button', { name: /^SEND TO/ })).toHaveAccessibleName('SEND TO weft · claude');
  await sheet.getByRole('button', { name: 'Cancel', exact: true }).click();
  if (!wide) await expect(page.getByRole('tree')).toBeVisible();

  // A unit of work: Eval names it; Seal says why until an Eval has judged it.
  await row(page, 'fix login').click();
  if (wide) await page.getByRole('region', { name: 'fix login' }).waitFor();
  await bar(page, 'Seal').click();
  await expect(said(page)).toHaveText('No Eval of this work yet: Eval starts one.');
  await bar(page, 'Eval').click();
  await expect.poll(() => machine.of('act')).toEqual([expect.objectContaining({ act: 'eval', project: 'weft', unit: 'ask_1' })]);
  await page.getByRole('dialog', { name: 'Eval this work?' }).getByRole('button', { name: 'Cancel', exact: true }).click();

  // A judged unit: Seal names it.
  await row(page, 'health endpoint').click();
  if (wide) await page.getByRole('region', { name: 'health endpoint' }).waitFor();
  await bar(page, 'Seal').click();
  await expect.poll(() => machine.of('act').length).toBe(2);
  expect(machine.of('act')[1]).toMatchObject({ act: 'seal', project: 'weft', unit: 'ask_3' });
  await page.getByRole('dialog', { name: 'Eval this work?' }).getByRole('button', { name: 'Cancel', exact: true }).click();

  // An ended session: Ask says to resume it.
  await row(page, 'claude · readme fix').click();
  if (wide) await page.getByRole('region', { name: /^claude · 3f9c2b71/ }).waitFor();
  await bar(page, 'Ask').click();
  await expect(said(page)).toHaveText('claude has ended: resume this session to Ask it.');
  await noneDisabled(page);

  // A unit the machine says cannot be sealed keeps its act, and says why.
  await row(page, 'readme fix').click();
  await bar(page, 'Seal').click();
  await expect(said(page)).toHaveText('readme fix is closed. Follow up asks again.');
  expect(machine.of('act')).toHaveLength(2);
  await noneDisabled(page);
  await machine.close();
});

test('M11.1 D11.1: a session run by another program reads the same; Ask on it says why', async ({ page, context }) => {
  const sample = atlas();
  // codex no Ask yet runs in a terminal: no pane holds it.
  Object.assign(sample.tree[0].agents.rows[0], { agent: null });
  const machine = await opened(page, context, sample);
  await expect(row(page, 'codex · no Ask yet').locator('.agent-dot')).toHaveAttribute('aria-label', 'working');
  await row(page, 'codex · no Ask yet').click();
  await bar(page, 'Ask').click();
  await expect(said(page)).toHaveText("codex runs in another program: Weft can't show it or type into it.");
  await machine.close();
});

test('D11.1: the bar names the selection; Ask, Eval and Seal are in the bar only, never on a row', async ({ page, context }, info) => {
  test.skip(info.project.name !== 'desktop', 'a desktop');
  const machine = await opened(page, context);
  await expect(page.locator('.tree-selected')).toHaveCount(0);
  await expect(page.locator('.tree-row button.row-act, .tree-row .row-act')).toHaveCount(0);
  await row(page, 'claude · fix login').click();
  await expect(page.locator('.tree-selected')).toHaveText('selected: claude · 11:29');
  await bar(page, 'Ask').click();
  await expect(page.getByRole('dialog', { name: 'What do you want done?' }).getByRole('button', { name: /^SEND TO/ })).toHaveAccessibleName('SEND TO weft · claude');
  await page.getByRole('dialog', { name: 'What do you want done?' }).getByRole('button', { name: 'Cancel', exact: true }).click();
  await row(page, 'fix login').click();
  await expect(page.locator('.tree-selected')).toHaveText('selected: fix login');
  await bar(page, 'Eval').click();
  await expect.poll(() => machine.of('act')).toEqual([expect.objectContaining({ act: 'eval', project: 'weft', unit: 'ask_1' })]);
  await page.getByRole('dialog', { name: 'Eval this work?' }).getByRole('button', { name: 'Cancel', exact: true }).click();
  await row(page, 'claude · readme fix').click();
  await expect(page.locator('.tree-selected')).toHaveText('selected: claude · ended 09:12');
  await machine.close();
});

test('M11.1 D11.1: › on a session and a unit of work open their Details', async ({ page, context }) => {
  const machine = await opened(page, context);
  const wide = wideOf(page);
  if (wide) await row(page, 'claude · readme fix').click();
  else await row(page, 'claude · readme fix').getByRole('button', { name: /^Details of/ }).click();
  await expect(page.getByRole('region', { name: /^claude · 3f9c2b71…a21e$/ })).toBeVisible();
  await expect.poll(() => machine.of('read').at(-1)).toEqual(expect.objectContaining({ what: 'session', project: 'weft', session: README_SESSION }));
  if (!wide) await page.goBack();
  if (wide) await row(page, 'health endpoint').click();
  else await row(page, 'health endpoint').getByRole('button', { name: 'Details of health endpoint' }).click();
  await expect(page.getByRole('region', { name: 'health endpoint' })).toBeVisible();
  expect(machine.of('read').at(-1)).toMatchObject({ what: 'work', project: 'weft', unit: 'ask_3' });
  await machine.close();
});

test('M11.1 D11.1: the earlier sealed units unfold a page at a time from read sealed, the next as it scrolls', async ({ page, context }) => {
  const big = large();
  const sample = atlas();
  sample.tree = [{ ...project('weft', big.sessions.slice(0, 5)), work: { units: [], earlier: 120 } }];
  sample.tree[0].agents = { running: 2, ended: 298, rows: big.sessions.slice(0, 5), earlier: 295 };
  sample.agents = [];
  sample.reads.sealed = { weft: big.sealed };
  const machine = await opened(page, context, sample);
  // Folded, they are a count.
  await expect(row(page, '120 sealed earlier')).toHaveText('120 sealed earlier ›');
  expect(machine.of('read')).toHaveLength(0);
  await row(page, '120 sealed earlier').click();
  await expect(row(page, 'sealed 120')).toBeVisible();
  await expect(page.locator('.tree-row--work')).toHaveCount(50);
  expect(machine.of('read')).toEqual([expect.objectContaining({ what: 'sealed', project: 'weft' })]);
  expect(machine.of('read')[0]).not.toHaveProperty('after');
  await row(page, 'sealed 71').scrollIntoViewIfNeeded();
  await expect(page.locator('.tree-row--work')).toHaveCount(100);
  expect(machine.of('read')[1]).toMatchObject({ what: 'sealed', after: 'ask_000071' });
  await row(page, 'sealed 21').scrollIntoViewIfNeeded();
  await expect(page.locator('.tree-row--work')).toHaveCount(120);
  await expect(row(page, 'sealed 1')).toBeAttached();
  await page.waitForTimeout(300);
  expect(machine.of('read')).toHaveLength(3);
  await machine.close();
});

test('M11.1 D11.1: the tree follows the machine', async ({ page, context }) => {
  const sample = atlas();
  const machine = await opened(page, context, sample);
  await expect(page.getByText('■ NEEDS YOU 1')).toBeVisible();
  const t = sample.tree;
  Object.assign(t[0], { needs: 0, open: 4 });
  Object.assign(t[0].agents.rows[1], { turn: 'working' });
  t[0].work.units.unshift({ unit: 'ask_9', title: 'new work', harness: 'codex', status: { state: 'asking' }, asks: 1, eval: null, seal: null });
  machine.agents = sample.agents.map((a, i) => (i === 0 ? { ...a, turn: 'working' } : a));
  machine.send({ type: 'agents', agents: machine.agents });
  machine.send({ type: 'tree', tree: t });
  await expect(row(page, 'new work')).toContainText('new work·codexasking');
  await expect(row(page, 'claude · fix login').locator('.agent-dot')).toHaveText('●');
  await expect(page.getByText('■ NEEDS YOU 1')).toHaveCount(0);
  await expect(page.locator('[data-needs-you]')).toHaveCount(0);
  await machine.close();
});

test('M11.1 D11.1: ▾ ▸ fold a project or the earlier sealed units, and this browser keeps it', async ({ page, context }) => {
  const machine = await opened(page, context);
  await row(page, 'docs').click();
  await expect(row(page, 'docs')).toHaveAttribute('aria-expanded', 'false');
  await row(page, '4 sealed earlier').click();
  await expect(row(page, 'lint pass')).toBeVisible();
  await page.reload();
  await expect(row(page, 'docs')).toHaveAttribute('aria-expanded', 'false');
  await expect(row(page, 'lint pass')).toBeVisible();
  await row(page, '4 sealed earlier').click();
  await expect(row(page, 'lint pass')).toHaveCount(0);
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
  await expect(page.getByText('Set it up on studio from ☰ › Updates…')).toBeVisible();
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
  await expect(page.getByText('Ask for something and Weft writes it down.')).toBeVisible();
  await machine.close();
});

test('M2.8: a tree longer than the screen scrolls, with no markers', async ({ page, context }) => {
  const sample = atlas();
  sample.tree[0].work.units = Array.from({ length: 24 }, (_, i) => ({ unit: `ask_${i + 10}`, title: `task ${i}`, harness: 'claude', status: { state: 'asked' as const }, asks: 1, eval: null, seal: null }));
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
  await expect(said(page)).toHaveText('claude is not set up for RingFrame. Set it up on studio from ☰ › Updates…');
  await machine.close();
});

test('an agent whose harness has named no session yet is under AGENTS, and Ask goes to it', async ({ page, context }) => {
  const fresh = (n: number, harness: string) => ({ ...agent(n, 'weft', harness, 'working'), turn: null as never });
  const agents = [fresh(0, 'antigravity'), fresh(1, 'codex')];
  const rows: Session[] = agents.map((a) => ({ ...sessionOf(a), session: '', turn: null }));
  const machine = await opened(page, context, { agents, tree: [project('weft', rows)] });
  const wide = wideOf(page);
  await expect(page.locator('.tree-section').first()).toHaveText('AGENTS');
  const codex = row(page, 'codex · no Ask yet');
  await expect(codex.locator('.agent-dot')).toHaveText('●');
  await codex.click();
  await expect(codex).toHaveAttribute('aria-selected', 'true');
  await expect(row(page, 'antigravity · no Ask yet')).toHaveAttribute('aria-selected', 'false');
  if (wide) await expect(page.getByLabel("The agent's screen")).toBeVisible();
  await bar(page, 'Ask').click();
  const sheet = page.getByRole('dialog', { name: 'What do you want done?' });
  await expect(sheet.getByRole('button', { name: /^SEND TO/ })).toHaveAccessibleName('SEND TO weft · codex');
  await machine.close();
});
