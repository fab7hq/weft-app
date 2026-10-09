// Start an agent (M2.1, D2.1, M9.7, D9.7): from the empty tree and from the menu,
// a harness the project can start; the new agent opens.
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

test('M2.1 D2.1 → M9.7 D9.7: start an agent from the empty tree; it opens', async ({ page, context }) => {
  const machine = await opened(page, context);
  await expect(page.getByText('Nothing asked for yet.')).toBeVisible();
  await page.getByRole('button', { name: 'Start an agent' }).click();
  await expect(page.getByText('It runs on studio, with your own settings.')).toBeVisible();
  const list = page.getByRole('radiogroup', { name: 'Start an agent' });
  await expect(list.getByRole('radio')).toHaveText(['◉claude · start fresh', '○codex · start fresh']);
  await list.getByRole('radio', { name: /codex/ }).click();
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect.poll(() => machine.of('start')).toEqual([expect.objectContaining({ project: 'weft', harness: 'codex' })]);
  await expect.poll(() => machine.of('watch').at(-1)?.agent).toBe('3f9a1c07b2de-5');
  await expect(page.getByLabel("The agent's screen")).toBeVisible();
  await machine.close();
});

test('M9.1 D9.1 → M9.7: start an agent from Settings or the menu; Cancel goes back', async ({ page, context }, info) => {
  const machine = await opened(page, context);
  const desktop = info.project.name === 'desktop';
  await page.getByRole('button', { name: 'Menu' }).click();
  // On a desktop ☰ opens the menu (D9.1), which starts one too.
  await (desktop ? page.getByRole('menu') : page).getByRole('button', { name: 'Start an agent' }).click();
  await expect(page.getByRole('radiogroup', { name: 'Start an agent' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('radiogroup')).toHaveCount(0);
  expect(machine.of('start')).toHaveLength(0);
  await machine.close();
});

test('M9.7 D9.7: with no harness to start, the sentence says why', async ({ page, context }) => {
  const machine = await opened(page, context, []);
  await page.getByRole('button', { name: 'Start an agent' }).click();
  await expect(page.getByRole('status')).toHaveText('No harness is set up for RingFrame yet. [U]PDATE on studio sets one up.');
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  expect(machine.of('start')).toHaveLength(0);
  await machine.close();
});
