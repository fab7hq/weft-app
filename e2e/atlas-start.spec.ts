// Start an agent (M2.1, D2.1, M9.7, D9.7): only from a project's +, a harness
// that project can start; the new agent opens. Neither the menu nor Settings start one.
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { FakeMachine, atlas, project, type Project } from './fake-machine';
import { person, signIn } from './seed';

const empty: Project[] = [{ ...project('weft', []), ask: { key: 'why.start_an_agent' } }];

async function opened(page: Page, context: BrowserContext, harnesses = atlas().harnesses) {
  const machine = await FakeMachine.start();
  Object.assign(machine, { agents: [], tree: empty, harnesses });
  machine.onStart = (m) => {
    machine.agents = [{ agent: '3f9a1c07b2de-5', project: 'weft', harness: String(m.harness), title: 'Codex', turn: 'ready', running: true, since: Date.now() }];
    return [{ type: 'agents', agents: machine.agents }, { type: 'ok', req: m.req, agent: '3f9a1c07b2de-5' }];
  };
  await signIn(context, person('octo', [{ name: 'studio', address: machine.address }]));
  await page.goto('/');
  return machine;
}

test('M2.1 D2.1 → M9.7 D9.7: nothing asked yet, the project keeps its +; it starts an agent there, which opens', async ({ page, context }) => {
  const machine = await opened(page, context);
  await expect(page.getByText('Nothing asked for yet.')).toBeVisible();
  await page.getByRole('button', { name: 'Start an agent in weft' }).click();
  await expect(page.getByText('It runs on studio, with your own settings.')).toBeVisible();
  const list = page.getByRole('radiogroup', { name: 'Start an agent' });
  await expect(list.getByRole('radio')).toHaveText(['claude · start fresh', 'codex · start fresh']);
  await list.getByRole('radio', { name: /codex/ }).click();
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect.poll(() => machine.of('start')).toEqual([expect.objectContaining({ project: 'weft', harness: 'codex' })]);
  await expect.poll(() => machine.of('watch').at(-1)?.agent).toBe('3f9a1c07b2de-5');
  await expect(page.getByLabel("The agent's screen")).toBeVisible();
  await machine.close();
});

test('M9.1 D9.1: neither Settings nor the menu starts an agent; Cancel on the start goes back', async ({ page, context }, info) => {
  const machine = await opened(page, context);
  const desktop = info.project.name === 'desktop';
  await page.getByRole('button', { name: 'Menu' }).click();
  await expect((desktop ? page.getByRole('menu') : page).getByRole('button', { name: 'Start an agent', exact: true })).toHaveCount(0);
  if (desktop) await page.mouse.click(200, 300);
  else await page.getByRole('button', { name: '‹ Back' }).click();
  await page.getByRole('button', { name: 'Start an agent in weft' }).click();
  await expect(page.getByRole('radiogroup', { name: 'Start an agent' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('radiogroup')).toHaveCount(0);
  expect(machine.of('start')).toHaveLength(0);
  await machine.close();
});

test('M9.7 D9.7: with no harness to start, the sentence says why', async ({ page, context }) => {
  const machine = await opened(page, context, []);
  await page.getByRole('button', { name: 'Start an agent in weft' }).click();
  await expect(page.getByRole('status')).toHaveText('No harness is set up for RingFrame yet. Updates… in ☰ on studio sets one up.');
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  expect(machine.of('start')).toHaveLength(0);
  await machine.close();
});

// M9.8 D9.8: with more than one project open, each project's + starts in it.
const starts = [
  { project: 'weft', harness: 'claude', title: 'Claude Code' },
  { project: 'web', harness: 'claude', title: 'Claude Code' },
  { project: 'web', harness: 'codex', title: 'Codex' },
];

async function openedTwo(page: Page, context: BrowserContext) {
  const machine = await FakeMachine.start();
  // Two projects with work and agents (the Atlas's), and one with nothing in it.
  const sample = atlas();
  Object.assign(machine, { agents: sample.agents, tree: [...sample.tree, project('web', [])], harnesses: starts });
  await signIn(context, person('octo', [{ name: 'studio', address: machine.address }]));
  await page.goto('/');
  return machine;
}

test('M9.8 D9.8: the + on a project row starts there, a project with nothing in it too; no project to choose', async ({ page, context }, info) => {
  const machine = await openedTwo(page, context);
  await page.getByRole('button', { name: 'Start an agent in web' }).click();
  if (info.project.name === 'desktop') await expect(page.getByRole('heading', { name: 'Start an agent in web' })).toBeVisible();
  await expect(page.getByRole('radiogroup')).toHaveCount(1);
  const harnesses = page.getByRole('radiogroup', { name: 'Start an agent' });
  await expect(harnesses.getByRole('radio')).toHaveText(['claude · start fresh', 'codex · start fresh']);
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect.poll(() => machine.of('start')).toEqual([expect.objectContaining({ project: 'web', harness: 'claude' })]);
  await machine.close();
});
