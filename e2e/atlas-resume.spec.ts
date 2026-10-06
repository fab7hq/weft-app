// Send anyway, Resume, nothing to resume, answered on the machine (M4.11–M4.14, D4.11–D4.14).
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { FakeMachine, atlas } from './fake-machine';
import { person, signIn } from './seed';

const CODEX = '3f9a1c07b2de-1';
const pending = (req: unknown) => [
  { type: 'pending', id: 'pnd_1', agent: CODEX, what: 'Eval this work?', why: 'The agent will run the judges.', text: '/rf:eval debate evl_2' },
  { type: 'ok', req, pending: 'pnd_1' },
];

async function evalOn(page: Page, context: BrowserContext, machine: FakeMachine) {
  await signIn(context, person('octo', [{ name: 'studio', address: machine.address }]));
  await page.goto('/');
  await page.getByRole('treeitem', { name: 'health endpoint', exact: true }).click();
  await page.getByRole('button', { name: 'Eval', exact: true }).click();
}

async function machineOf(sample = atlas()) {
  const machine = await FakeMachine.start();
  Object.assign(machine, sample);
  return machine;
}

test('M4.11 D4.11: an agent not ready: the TUI\'s why, then Send anyway forces it', async ({ page, context }) => {
  const machine = await machineOf();
  machine.onAct = (m) => pending(m.req);
  machine.onResolve = (m) =>
    m.force ? [{ type: 'ok', req: m.req }] : [{ type: 'error', req: m.req, code: 'not_ready', message: 'Weft did not type it: the agent is working.' }];
  await evalOn(page, context, machine);
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  const bar = page.getByRole('dialog', { name: 'The agent has not said it is ready' });
  await expect(bar.getByText('Weft did not type it: the agent is working.')).toBeVisible();
  await expect(bar.getByText('Weft types on its own only into an agent that has said it is ready. If you can see it is, say so and Weft will type.')).toBeVisible();
  await bar.getByRole('button', { name: 'Send anyway', exact: true }).click();
  await expect.poll(() => machine.of('resolve').map((r) => [r.yes, r.force ?? false])).toEqual([[true, false], [true, true]]);
  await expect(bar).toHaveCount(0);
  await machine.close();
});

test('M4.12 D4.12: work whose agent is not running: Resume its session, then the act', async ({ page, context }) => {
  const machine = await machineOf();
  let once = true;
  machine.onAct = (m) => {
    if (!once) return pending(m.req);
    once = false;
    return [{ type: 'error', req: m.req, code: 'not_running', message: 'codex is not running', harness: 'codex',
      session: { at: (14 * 60 + 2) * 60_000, last: 'Implement /health: read BUILD_NUMBER from the environment at startup' } }];
  };
  await evalOn(page, context, machine);
  const bar = page.getByRole('dialog', { name: 'codex is not running' });
  await expect(bar.getByText('Resume the session this was asked in · 14:02 · "Implement /health: read BUI…"')).toBeVisible();
  await expect(bar.getByText('Your work is in the record either way.')).toBeVisible();
  await bar.getByRole('button', { name: 'Resume', exact: true }).click();
  await expect.poll(() => machine.of('start')).toEqual([expect.objectContaining({ project: 'weft', harness: 'codex', unit: 'ask_3' })]);
  await expect.poll(() => machine.of('act').length).toBe(2);
  expect(machine.of('act')[1]).toMatchObject({ act: 'eval', unit: 'ask_3' });
  await expect(page.getByRole('dialog', { name: 'Eval this work?' })).toBeVisible();
  await machine.close();
});

test('M4.13 D4.13: nothing to resume: Start an agent, with that harness picked', async ({ page, context }) => {
  const machine = await machineOf();
  machine.onAct = (m) => [{ type: 'error', req: m.req, code: 'not_running', message: 'codex is not running', harness: 'codex', session: null }];
  await evalOn(page, context, machine);
  const bar = page.getByRole('dialog', { name: 'codex is not running' });
  await expect(bar.getByText('Nothing to resume: the session this was asked in is not on record.')).toBeVisible();
  await bar.getByRole('button', { name: 'Start an agent', exact: true }).click();
  await expect(page.getByRole('radio', { name: /codex/ })).toHaveAttribute('aria-checked', 'true');
  expect(machine.of('start')).toHaveLength(0);
  await machine.close();
});

test('M4.14 D4.14: answered on the machine first, the bar says so and goes', async ({ page, context }) => {
  const machine = await machineOf();
  machine.onAct = (m) => pending(m.req);
  await evalOn(page, context, machine);
  const bar = page.getByRole('dialog', { name: 'Eval this work?' });
  await expect(bar).toBeVisible();
  machine.send({ type: 'resolved', id: 'pnd_1', yes: true });
  await expect(bar.getByText('Answered on the machine')).toBeVisible();
  await expect(bar.getByRole('button', { name: 'Send', exact: true })).toHaveCount(0);
  await expect(bar).toHaveCount(0, { timeout: 5000 });
  expect(machine.of('resolve')).toHaveLength(0);
  await machine.close();
});

/** The Atlas's sample with codex running no agent, and what a tap on it would resume. */
function codexStopped(session: { at: number; last: string } | null) {
  const sample = atlas();
  const codex = sample.tree[0].harnesses[1];
  Object.assign(codex, { agent: null, turn: null, running: false, session });
  sample.agents = sample.agents.filter((a) => a.agent !== CODEX);
  return sample;
}

test('M2.9 D2.9 → M4.12: a tap on a harness that is not running offers its latest session; Resume opens its agent', async ({ page, context }) => {
  const machine = await machineOf(codexStopped({ at: (9 * 60 + 30) * 60_000, last: 'Add the health endpoint' }));
  // As weft remote does: the resumed agent is announced, then started answers.
  machine.onStart = (m) => {
    machine.agents = [...machine.agents, { agent: CODEX, project: 'weft', harness: 'codex', title: 'Codex', turn: 'ready', running: true, since: Date.now() }];
    return [{ type: 'agents', agents: machine.agents }, { type: 'ok', req: m.req, agent: CODEX }];
  };
  await signIn(context, person('octo', [{ name: 'studio', address: machine.address }]));
  await page.goto('/');
  // A harness whose agent runs opens it, with no question.
  await page.getByRole('treeitem', { name: 'claude', exact: true }).first().click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect.poll(() => machine.of('watch').at(-1)?.agent).toBe('3f9a1c07b2de-0');
  await page.goto('/');
  await page.getByRole('treeitem', { name: 'codex', exact: true }).click();
  const bar = page.getByRole('dialog', { name: 'codex is not running' });
  await expect(bar.getByText('Resume the session this was asked in · 09:30 · "Add the health endpoint"')).toBeVisible();
  await bar.getByRole('button', { name: 'Resume', exact: true }).click();
  await expect.poll(() => machine.of('start')).toEqual([{ type: 'start', project: 'weft', harness: 'codex', resume: true, req: expect.anything() }]);
  // The resumed agent opens; no act follows.
  await expect.poll(() => machine.of('watch').at(-1)?.agent).toBe(CODEX);
  expect(machine.of('act')).toHaveLength(0);
  await machine.close();
});

test('M2.9 D2.9 → M4.13: nothing to resume, the bar offers a fresh agent of that harness', async ({ page, context }) => {
  const machine = await machineOf(codexStopped(null));
  await signIn(context, person('octo', [{ name: 'studio', address: machine.address }]));
  await page.goto('/');
  await page.getByRole('treeitem', { name: 'codex', exact: true }).click();
  const bar = page.getByRole('dialog', { name: 'codex is not running' });
  await expect(bar.getByText('Nothing to resume: the session this was asked in is not on record.')).toBeVisible();
  await bar.getByRole('button', { name: 'Start an agent', exact: true }).click();
  await expect(page.getByRole('radiogroup', { name: 'Start an agent' })).toBeVisible();
  expect(machine.of('start')).toHaveLength(0);
  await machine.close();
});
