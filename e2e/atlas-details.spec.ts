// Details, one level each (M11.2–M11.6, D11.2–D11.6): a work's Ask only,
// under a breadcrumb whose parts are links; an Eval once, with Seal; a Seal
// once, its Asks a page at a time; a session, resumed by its id after a
// confirm; the earlier sessions, a page at a time, searched as you type.
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { FakeMachine, atlas, type Ask } from './fake-machine';
import { CLAUDE, README_SESSION, large } from './atlas-fixtures';
import { row, wideOf } from './open';
import { person, signIn } from './seed';

async function opened(page: Page, context: BrowserContext, sample = atlas()) {
  const machine = await FakeMachine.start();
  Object.assign(machine, sample);
  await signIn(context, person('octo', [{ name: 'studio', address: machine.address }]));
  await page.goto('/');
  await expect(page.getByRole('tree', { name: 'Work' })).toBeVisible();
  return machine;
}

/** A row's Details: › on a phone; on a desktop › on an Ask, a click on the rest (D11.1). */
async function details(page: Page, name: string) {
  const r = row(page, name);
  const more = r.getByRole('button', { name: /^Details of/ });
  if (wideOf(page) && !(await more.count())) await r.click();
  else await more.click();
}

const region = (page: Page, name: string | RegExp) => page.getByRole('region', { name, exact: typeof name === 'string' });
const crumbs = (page: Page) => page.locator('.crumbs').first();
const facts = (page: Page) => page.locator('.fact').evaluateAll((all) => all.map((f) => [f.querySelector('.fact-label')?.textContent, f.querySelector('.fact-value')?.textContent]));
const asks = (page: Page) => page.locator('.detail-ask').evaluateAll((all) => all.map((a) => [a.querySelector('.tree-name')?.textContent, a.querySelector('.tree-aside')?.textContent]));
/** A Details view's labelled lines: the phone's rows (M11.x), the desktop's grid (D11.4, D11.5). */
const grid = (page: Page) => page.locator('.grid-row').evaluateAll((all) => all.map((f) => [f.querySelector('.grid-label')?.textContent, f.querySelector('.grid-value')?.textContent]));
/** Its session: a row on a phone (M11.2), a link under the Ask on a desktop (D11.2). */
const itsSession = (page: Page) => page.locator('.fact--session, .detail-section .detail-link').first();
const act = (page: Page, name: string) => (wideOf(page) ? page.locator('.detail-acts') : page.locator('.detail-foot')).getByRole('button', { name, exact: true });

test('M11.2 D11.2: a work\'s Details hold its Ask only, under where it stands; Proceed sends act proceed', async ({ page, context }) => {
  const machine = await opened(page, context);
  await details(page, 'fix login');
  const view = region(page, 'fix login');
  await expect(view).toBeVisible();
  await expect.poll(() => machine.of('read').at(-1)).toEqual(expect.objectContaining({ what: 'detail', unit: 'ask_1' }));
  await expect(crumbs(page)).toHaveText('fix login›not evaluated yet');
  await expect(view.getByText('asked 2026-10-08 11:29 · not sent yet')).toBeVisible();
  const lines = ['You asked:', 'Refresh the token before it expires, not after', 'The prompt claude composed:',
    'In src/login.rs refresh the session token 60 s before expiry …', 'How it was sent:', 'not sent yet, waiting for proceeding'];
  if (wideOf(page)) {
    // D11.2: the Ask folds under ▾, with no state word; what waits for your yes is amber; its session a link.
    await expect(view.locator('.detail-section-head')).toHaveText('▾Ask');
    await expect(view.locator('.detail-line')).toHaveText([...lines, 'Its session:']);
    await expect(view.locator('.detail-line').nth(5)).toHaveClass(/detail-line--needs/);
    await expect(itsSession(page)).toHaveText('claude · 11:29 ›');
    await view.locator('.detail-section-head').click();
    await expect(view.locator('.detail-line')).toHaveCount(0);
    await view.locator('.detail-section-head').click();
  } else {
    // M11.2: ASKED at the right edge; its session a row.
    await expect(view.locator('.detail-section-head')).toHaveText('AskASKED');
    await expect(view.locator('.detail-line')).toHaveText(lines);
    await expect(itsSession(page)).toHaveText('Its session● claude · 11:29›');
  }
  // No chips, no Eval or Seal sections: those are their own Details.
  await expect(view.locator('.chip')).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Eval', exact: true })).toHaveCount(0);
  const acted = new Promise<Record<string, unknown>>((done) => (machine.onAct = (m) => (done(m), [{ type: 'ok', req: m.req }])));
  await act(page, 'Proceed').click();
  expect(await acted).toMatchObject({ act: 'proceed', unit: 'ask_1' });
  await act(page, 'Follow up').click();
  await expect(page.getByRole('dialog', { name: 'What do you want done?' }).getByText('FOLLOW UP · FIX LOGIN · ASK_1')).toBeVisible();
  await machine.close();
});

test('M11.2: still being composed, ASKING, and nothing to proceed with', async ({ page, context }) => {
  const machine = await opened(page, context);
  await details(page, 'telemetry');
  await expect(region(page, 'telemetry').locator('.detail-section-head')).toHaveText(wideOf(page) ? '▾Ask' : 'AskASKING');
  await expect(page.getByText('claude has not composed its prompt yet.')).toBeVisible();
  await expect(act(page, 'Proceed')).toHaveCount(0);
  await expect(act(page, 'Follow up')).toBeVisible();
  await machine.close();
});

test('M11.2 D11.2: an evaluated work\'s breadcrumb links its Eval; a sealed one\'s its Seal too', async ({ page, context }) => {
  const machine = await opened(page, context);
  await details(page, 'health endpoint');
  await expect(crumbs(page)).toHaveText('health endpoint›Eval 3 aligned›not sealed');
  await crumbs(page).getByRole('button', { name: 'Eval 3 aligned' }).click();
  await expect(region(page, 'Eval 3')).toBeVisible();
  // A sealed one, reached from its Seal.
  await region(page, 'Eval 3').getByRole('button', { name: 'health endpoint' }).waitFor();
  await page.goto('/');
  await row(page, 'Sealed').click();
  await details(page, 'Seal 4');
  await region(page, 'Seal 4').getByRole('button', { name: 'readme fix' }).click();
  await expect(crumbs(page)).toHaveText('readme fix›Eval 2 aligned›Seal 4');
  await crumbs(page).getByRole('button', { name: 'Seal 4' }).click();
  await expect(region(page, 'Seal 4')).toBeVisible();
  await machine.close();
});

test('M11.2 D11.2: Its session › goes to its agent while a pane holds it, else to the session', async ({ page, context }) => {
  const machine = await opened(page, context);
  await details(page, 'fix login');
  await itsSession(page).click();
  await expect(page.getByLabel("The agent's screen")).toBeVisible();
  await expect.poll(() => machine.of('watch').at(-1)?.agent).toBe(CLAUDE);
  await page.goto('/');
  await row(page, 'Sealed').click();
  await details(page, 'Seal 4');
  await region(page, 'Seal 4').getByRole('button', { name: 'readme fix' }).click();
  await itsSession(page).click();
  await expect(region(page, /^claude · 3f9c2b71/)).toBeVisible();
  await machine.close();
});

test('M11.3 D11.3: an Eval\'s Details, once: verdict, agreement, judges, findings, checks, its Asks; Seal and Eval view', async ({ page, context }) => {
  const machine = await opened(page, context);
  machine.onAct = (m) => [{ type: 'pending', id: 'pnd_1', agent: CLAUDE, what: 'Seal this work?', why: 'The agent will ask what you decided.', text: '/rf:seal' }, { type: 'ok', req: m.req, pending: 'pnd_1' }];
  await details(page, 'Eval 3');
  const view = region(page, 'Eval 3');
  await expect(view).toBeVisible();
  await expect.poll(() => machine.of('read').at(-1)).toEqual(expect.objectContaining({ what: 'eval', project: 'weft', eval: 'evl_3' }));
  await expect(page.getByText('evl_3', { exact: true })).toBeVisible();
  if (wideOf(page)) {
    // D11.3: the verdict in the breadcrumb, then one summary in two lines; the check by its colour.
    await expect(crumbs(page)).toHaveText('Eval 3›aligned›not sealed');
    await expect(view.locator('.summary-head')).toHaveText('aligned · Agreement 0.67');
    await expect(view.locator('.detail-summary .detail-prov')).toHaveText('Judged by codex · 2026-10-08 10:58 · covers 2 Asks');
    expect(await facts(page)).toEqual([['Findings', '2'], ['Checks RingFrame ran', 'cargo test passed']]);
    await expect(view.locator('.detail-head-row')).toHaveText('The Asks it covers');
    await expect(view.locator('.detail-note-head')).toHaveClass(/needs/);
  } else {
    await expect(crumbs(page)).toHaveText('Eval 3›not sealed');
    await expect(view.getByText('judged 2026-10-08 10:58 · covers 2 Asks')).toBeVisible();
    expect(await facts(page)).toEqual([['Verdict', 'aligned'], ['Agreement', '0.67'], ['Judged by', 'codex'], ['Findings', '2'], ['Checks RingFrame ran', '✓ cargo test passed']]);
    await expect(view.locator('.detail-head-row')).toHaveText('The Asks it covers2');
  }
  expect(await asks(page)).toEqual([['health endpoint', 'codex'], ['build number', 'codex']]);
  // "Not sealed", the round's word capitalised as a heading.
  await expect(view.locator('.detail-note-head')).toHaveText('not sealed');
  await act(page, 'Seal').click();
  await expect.poll(() => machine.of('act')).toEqual([expect.objectContaining({ act: 'seal', project: 'weft', eval: 'evl_3' })]);
  await page.getByRole('dialog', { name: 'Seal this work?' }).getByRole('button', { name: 'Cancel', exact: true }).click();
  await view.getByRole('button', { name: /^Findings/ }).click();
  await expect(page.getByText('what RingFrame noticed beside the steps')).toBeVisible();
  expect(machine.of('read').at(-1)).toMatchObject({ what: 'eval_view', project: 'weft', eval: 'evl_3' });
  await page.goBack();
  await act(page, 'Eval view').click();
  await expect(region(page, 'Eval view')).toBeVisible();
  await page.goBack();
  await region(page, 'Eval 3').getByRole('button', { name: 'build number' }).click();
  await expect(crumbs(page)).toHaveText('build number›Eval 3 aligned›not sealed');
  await machine.close();
});

test('M11.3 D11.3: a sealed Eval says its Seal; Seal stays drawn and says it is sealed already (D12.6)', async ({ page, context }) => {
  const machine = await opened(page, context);
  await row(page, 'Sealed').click();
  await details(page, 'Seal 4');
  await region(page, 'Seal 4').getByRole('button', { name: wideOf(page) ? 'Eval 2 ›' : /^The Eval it seals/ }).click();
  const view = region(page, 'Eval 2');
  await expect(view).toBeVisible();
  await expect(crumbs(page)).toHaveText(wideOf(page) ? 'Eval 2›aligned›Seal 4' : 'Eval 2›Seal 4');
  await expect(view.getByRole('button', { name: 'Sealed in Seal 4' })).toBeVisible();
  await act(page, 'Seal').click();
  await expect(page.getByRole('status')).toHaveText('Eval 2 is sealed already.');
  expect(machine.of('act')).toHaveLength(0);
  await expect(page.locator('button:disabled')).toHaveCount(0);
  await view.getByRole('button', { name: 'Sealed in Seal 4' }).click();
  await expect(region(page, 'Seal 4')).toBeVisible();
  await machine.close();
});

test('M11.4 D11.4: a Seal\'s Details, once: its decision, when, by whom, its Eval, its receipt, its Asks; no act', async ({ page, context }) => {
  const machine = await opened(page, context);
  await row(page, 'Sealed').click();
  await expect(page.locator('.tree-row--seal')).toHaveText(['Seal 4accepted · Eval 22›', 'Seal 3accepted · Eval 19›', 'Seal 2accepted11›', 'Seal 1accepted9›']);
  await details(page, 'Seal 4');
  const view = region(page, 'Seal 4');
  await expect(view).toBeVisible();
  await expect.poll(() => machine.of('read').at(-1)).toEqual(expect.objectContaining({ what: 'seal', project: 'weft', seal: 'rcp_7f3a2c' }));
  if (wideOf(page)) {
    // D11.4: the decision in the breadcrumb and large, its facts as labelled lines.
    await expect(crumbs(page)).toHaveText('Seal 4›accepted');
    await expect(view.locator('.summary-head')).toHaveText('accepted');
    expect(await grid(page)).toEqual([['When', '2026-10-08 09:40'], ['The Eval it seals', 'Eval 2 › · aligned · 1.0'], ['Receipt', 'rcp_7f3a2c']]);
    await expect(view.locator('.detail-head-row')).toHaveText('The Asks it covered· 2');
  } else {
    await expect(crumbs(page)).toHaveText('Seal 4ACCEPTED');
    await expect(view.getByText('sealed 2026-10-08 09:40 · covers 2 Asks')).toBeVisible();
    expect(await facts(page)).toEqual([['Decision', 'accepted'], ['When', '2026-10-08 09:40'], ['The Eval it seals', 'Eval 2 · aligned · 1.0'], ['Receipt', 'rcp_7f3a2c']]);
  }
  expect(await asks(page)).toEqual([['readme fix', 'claude'], ['docs links', 'claude']]);
  await expect(view.getByText('The receipt still matches what RingFrame wrote.')).toBeVisible();
  await expect(view.getByText('A Seal records what was decided. It does not make the work right.')).toBeVisible();
  // A Seal is final: no act. A desktop has its Eval view and Close.
  if (wideOf(page)) await expect(page.locator('.detail-acts .tree-act')).toHaveText(['Eval view', 'Close']);
  else await expect(page.locator('.detail-foot')).toHaveCount(0);
  await machine.close();
});

test('M11.4: a receipt that no longer holds says so, and why', async ({ page, context }) => {
  const sample = atlas();
  Object.assign(sample.reads.seals.rcp_7f3a2c, { holds: false, broken: ['the work has moved on since it was sealed'] });
  const machine = await opened(page, context, sample);
  await row(page, 'Sealed').click();
  await details(page, 'Seal 4');
  await expect(page.getByText('THE RECEIPT NO LONGER HOLDS')).toBeVisible();
  await expect(page.getByText('the work has moved on since it was sealed')).toBeVisible();
  await expect(page.getByText('The receipt still matches what RingFrame wrote.')).toHaveCount(0);
  await machine.close();
});

test('M11.4 D11.4: a Seal\'s Asks come a page at a time, the next as they scroll', async ({ page, context }) => {
  const sample = atlas();
  const many: Ask[] = Array.from({ length: 120 }, (_, i) => ({ unit: `ask_${1000 + i}`, title: `work ${i}`, harness: 'claude' }));
  sample.reads.seals.rcp_7f3a2c.asks = many;
  sample.reads.sealed.weft[0].asks = 120;
  const machine = await opened(page, context, sample);
  await row(page, 'Sealed').click();
  await details(page, 'Seal 4');
  await expect(page.locator('.detail-ask')).toHaveCount(50);
  await expect(page.locator('.detail-head-row')).toContainText('120');
  await page.getByRole('button', { name: 'work 49', exact: true }).scrollIntoViewIfNeeded();
  await expect(page.locator('.detail-ask')).toHaveCount(100);
  expect(machine.of('read').filter((r) => r.what === 'seal').at(-1)).toMatchObject({ seal: 'rcp_7f3a2c', after: 'ask_1049' });
  await page.getByRole('button', { name: 'work 99', exact: true }).scrollIntoViewIfNeeded();
  await expect(page.locator('.detail-ask')).toHaveCount(120);
  await machine.close();
});

test('M11.5 D11.5: an ended session\'s Details; Resume starts exactly its id at once, with no confirm', async ({ page, context }) => {
  const machine = await opened(page, context);
  machine.onStart = (m) => {
    machine.agents = [...machine.agents, { agent: '3f9a1c07b2de-7', project: 'weft', harness: 'claude', title: 'Claude Code', turn: 'ready', running: true, since: Date.now() }];
    return [{ type: 'agents', agents: machine.agents }, { type: 'ok', req: m.req, agent: '3f9a1c07b2de-7' }];
  };
  await details(page, 'claude · readme fix');
  const view = region(page, 'claude · 3f9c2b71…a21e');
  await expect(view).toBeVisible();
  await expect.poll(() => machine.of('read').at(-1)).toEqual(expect.objectContaining({ what: 'session', project: 'weft', session: README_SESSION }));
  if (wideOf(page)) {
    // D11.5: harness › state, the state large, its facts as labelled lines; an Ask with its Seal.
    await expect(crumbs(page)).toHaveText('claude›ended 09:12');
    await expect(view.locator('.summary-head')).toHaveText('○ ended 09:12');
    expect(await grid(page)).toEqual([['Harness', 'claude'], ['Started', '2026-10-08 08:47'], ['ended', '2026-10-08 09:12'], ['Session', '3f9c2b71'], ['Project', 'weft']]);
    expect(await asks(page)).toEqual([['readme fix', 'SEALED · Seal 4']]);
    await expect(view.getByText('Resume starts claude again on session 3f9c2b71 in a new agent.')).toBeVisible();
  } else {
    await expect(crumbs(page)).toHaveText('○claudeENDED');
    await expect(view.getByText('ended 2026-10-08 09:12 · 1 Ask made in it')).toBeVisible();
    expect(await facts(page)).toEqual([['State', 'ended 09:12'], ['Started', '2026-10-08 08:47'], ['Session', '3f9c2b71…a21e'], ['Project', 'weft']]);
    expect(await asks(page)).toEqual([['readme fix', 'SEALED']]);
  }
  await act(page, 'Resume').click();
  await expect.poll(() => machine.of('start')).toEqual([{ type: 'start', project: 'weft', harness: 'claude', resume: README_SESSION, req: expect.anything() }]);
  await expect.poll(() => machine.of('watch').at(-1)?.agent).toBe('3f9a1c07b2de-7');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await machine.close();
});

test('M11.5 D11.5: a running session goes to its agent; one another program runs says why it cannot', async ({ page, context }) => {
  const sample = atlas();
  sample.tree[0].agents.rows[0].agent = null;
  const machine = await opened(page, context, sample);
  if (wideOf(page)) await row(page, 'claude · fix login').dblclick();
  else await details(page, 'claude · fix login');
  await expect(region(page, /^claude · 8b2e4f60/)).toBeVisible();
  expect(await asks(page)).toEqual([['fix login', 'ASKED'], ['telemetry', 'ASKING']]);
  await act(page, 'Go to its agent').click();
  await expect.poll(() => machine.of('watch').at(-1)?.agent).toBe(CLAUDE);
  await page.goto('/');
  if (wideOf(page)) await row(page, 'codex · no Ask yet').click();
  else await details(page, 'codex · no Ask yet');
  await expect(region(page, /^codex · 0199c2f0/)).toBeVisible();
  await act(page, 'Go to its agent').click();
  await expect(page.getByRole('status')).toHaveText("codex runs in another program: Weft can't show it or type into it.");
  await machine.close();
});

test('M11.5: a quiet session: its last active time on the row and in its Details; Resume starts it at once', async ({ page, context }) => {
  const sample = atlas();
  Object.assign(sample.tree[0].agents.rows[4], { state: 'quiet', ask: { key: 'why.quiet', harness: 'codex' } });
  const machine = await opened(page, context, sample);
  await expect(row(page, 'codex · lint pass').locator('.agent-state')).toHaveText('last active 08:30');
  await details(page, 'codex · lint pass');
  await expect(region(page, /^codex · 0199c0a8/).getByText('last active 08:30').first()).toBeVisible();
  await act(page, 'Resume').click();
  await expect.poll(() => machine.of('start')).toEqual([expect.objectContaining({ type: 'start', project: 'weft', harness: 'codex' })]);
  await machine.close();
});

test('M11.6 D11.6: the earlier sessions, grouped, newest first; a row opens its session', async ({ page, context }) => {
  const machine = await opened(page, context);
  await row(page, '12 earlier sessions').click();
  const view = region(page, 'Earlier sessions');
  await expect(view).toBeVisible();
  await expect.poll(() => machine.of('read').at(-1)).toEqual(expect.objectContaining({ what: 'sessions', project: 'weft' }));
  expect(machine.of('read').at(-1)).not.toHaveProperty('q');
  await expect(view.locator('.detail-head-row')).toHaveText(['TODAY2', 'YESTERDAY4', 'THIS WEEK6']);
  if (wideOf(page)) {
    // D11.6: the project and its count beside the title; how the list runs, beside Close.
    await expect(crumbs(page)).toHaveText('Earlier sessions›weft · 12 earlier');
    await expect(view.locator('.detail-acts .detail-hint')).toHaveText('newest first · scroll for more');
    // Beside Close, as the card draws it: after the spacer, not at the left.
    const [hint, close] = await Promise.all([view.locator('.detail-hint').boundingBox(), view.locator('.detail-acts').getByRole('button', { name: 'Close' }).boundingBox()]);
    expect(close!.x - (hint!.x + hint!.width)).toBeLessThan(40);
  }
  const list = view.getByRole('list', { name: 'Earlier sessions' });
  await expect(list.getByRole('listitem')).toHaveCount(12);
  await expect(list.getByRole('listitem').first()).toContainText('codex');
  await expect(list.getByRole('listitem').first()).toContainText('flaky test');
  await expect(list.getByRole('listitem').first()).toContainText('07:40');
  await expect(list.getByRole('listitem', { name: 'claude · turn-state map' })).toContainText('Tue 18:22');
  await list.getByRole('listitem', { name: 'codex · ci cache' }).click();
  await expect(region(page, /^codex · 01997a2d/)).toBeVisible();
  await machine.close();
});

test('M11.6 D11.6: the search sends what is typed and keeps the groups; the list reads a page at a time as it scrolls', async ({ page, context }) => {
  const big = large();
  const sample = atlas();
  sample.reads.earlier.weft = big.earlier;
  sample.tree[0].agents.earlier = big.earlier.length;
  const machine = await opened(page, context, sample);
  await row(page, '295 earlier sessions').click();
  const view = region(page, 'Earlier sessions');
  const rows = view.getByRole('listitem');
  await expect(rows).toHaveCount(50);
  await rows.nth(49).scrollIntoViewIfNeeded();
  await expect(rows).toHaveCount(100);
  const pages = () => machine.of('read').filter((r) => r.what === 'sessions');
  expect(pages()[1]).toMatchObject({ project: 'weft', after: big.earlier[49].session });
  await view.getByRole('searchbox').fill('task 29');
  await expect.poll(() => pages().at(-1)).toEqual(expect.objectContaining({ q: 'task 29' }));
  // task 29 and task 290–295 that the page holds: still grouped.
  await expect(rows).toHaveCount(7);
  await expect(view.locator('.detail-head-row')).toHaveText(['EARLIER7']);
  await view.getByRole('searchbox').fill('');
  await expect(rows).toHaveCount(50);
  await machine.close();
});
