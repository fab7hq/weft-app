// Resume names a session (ADR-0029 D4; the `gl` case): of two ended
// sessions of one harness, the older resumed from its Details starts exactly
// its id, never "the latest"; once the machine holds it again, its AGENTS row
// is running.
import { expect, test } from '@playwright/test';
import { FakeMachine, atlas } from './fake-machine';
import { SESSIONS } from './atlas-fixtures';
import { row, wideOf } from './open';
import { person, signIn } from './seed';

test('M11.5 D11.5: of two ended claude sessions, Resume this session on the older starts exactly its id, and its row reads ●', async ({ page, context }) => {
  const sample = atlas();
  const newer = SESSIONS[3];
  const older = SESSIONS[5];
  expect([newer.harness, older.harness, newer.state, older.state]).toEqual(['claude', 'claude', 'ended', 'ended']);
  expect(older.at).toBeLessThan(newer.at);
  const machine = await FakeMachine.start();
  Object.assign(machine, sample);
  // As weft remote does: the resumed session runs in a new pane, then start answers with its agent.
  machine.onStart = (m) => {
    const agent = '3f9a1c07b2de-9';
    machine.agents = [...machine.agents, { agent, project: 'weft', harness: 'claude', title: 'Claude Code', turn: 'ready', running: true, since: Date.now() }];
    const t = structuredClone(sample.tree);
    const rows = t[0].agents.rows;
    const at = rows.findIndex((r) => r.session === m.resume);
    const [back] = rows.splice(at, 1);
    rows.unshift({ ...back, state: 'running', turn: 'ready', agent, ask: null });
    Object.assign(t[0].agents, { running: 4, ended: 14 });
    machine.tree = t;
    return [{ type: 'agents', agents: machine.agents }, { type: 'tree', tree: t }, { type: 'ok', req: m.req, agent }];
  };
  await signIn(context, person('octo', [{ name: 'studio', address: machine.address }]));
  await page.goto('/');
  const name = 'claude · no Ask yet';
  await expect(row(page, name).locator('.agent-dot')).toHaveText('○');
  if (wideOf(page)) await row(page, name).click();
  else await row(page, name).getByRole('button', { name: `Details of ${name}` }).click();
  await page.getByRole('button', { name: 'Resume this session', exact: true }).click();
  await page.getByRole('dialog', { name: 'Resume claude c7d8e9f0…9e0f?' }).getByRole('button', { name: 'Resume', exact: true }).click();
  await expect.poll(() => machine.of('start')).toEqual([{ type: 'start', project: 'weft', harness: 'claude', resume: older.session, req: expect.anything() }]);
  expect(machine.of('start')[0].resume).not.toBe(newer.session);
  // Its agent opens; back on the tree, its row is running.
  await expect.poll(() => machine.of('watch').at(-1)?.agent).toBe('3f9a1c07b2de-9');
  if (!wideOf(page)) await page.goto('/');
  await expect(row(page, name).locator('.agent-dot')).toHaveText('●');
  await expect(row(page, 'claude · readme fix').locator('.agent-dot')).toHaveText('○');
  await expect(page.getByText('4 running · 14 ended')).toBeVisible();
  await machine.close();
});
