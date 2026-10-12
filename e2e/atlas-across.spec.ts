// Agents across projects: every open project's running agents as tabs, and
// on a desktop two of them side by side, each side its own agent's screen,
// message box and keys.
import { expect, test, type Page } from '@playwright/test';
import { CLAUDE, CODEX, DOCS } from './atlas-fixtures';
import { FakeMachine, agent, atlas } from './fake-machine';
import { openAgent, row } from './open';
import { person, signIn } from './seed';

const DOCS_CLAUDE = `${DOCS}-0`;

async function opened(page: Page, context: Parameters<typeof signIn>[0], more: (m: FakeMachine) => void = () => {}) {
  const machine = await FakeMachine.start();
  Object.assign(machine, atlas());
  more(machine);
  await signIn(context, person('octo', [{ name: 'studio', address: machine.address }]));
  await page.goto('/');
  await openAgent(page, 'codex · health endpoint');
  await expect.poll(() => machine.of('watch').at(-1)?.agent).toBe(CODEX);
  return machine;
}

const tabs = (page: Page) => page.getByRole('navigation', { name: 'Tabs' });
const side = (page: Page, name: string) => page.getByRole('region', { name, exact: true });
const screen = (agent: string, text: string) => ({ type: 'screen', agent, seq: 1, full: true, rows: 10, cols: 40, bytes: Buffer.from(text).toString('base64') });

test.describe('desktop', () => {
  test.skip(({ isMobile }) => isMobile, 'a desktop');

  test('every open project\'s agents are tabs, in the tree\'s order; another project\'s opens without swapping them', async ({ page, context }) => {
    const machine = await opened(page, context);
    const names = ['weft · claude ●', 'weft · codex', 'weft · codex', 'docs · claude'];
    await expect(tabs(page).getByRole('button')).toHaveText(names);
    await expect(tabs(page).getByRole('button').nth(1)).toHaveAttribute('aria-current', 'page');
    await tabs(page).getByRole('button', { name: 'docs · claude' }).click();
    await expect.poll(() => machine.of('watch').at(-1)?.agent).toBe(DOCS_CLAUDE);
    await expect(tabs(page).getByRole('button')).toHaveText(names);
    await expect(tabs(page).getByRole('button', { name: 'docs · claude' })).toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('button', { name: 'Split', exact: true })).toBeVisible();
    await machine.close();
  });

  test('Split: the agent looked at last on the left, this one on the right with the keys; a click moves them; a row fills that side; One pane keeps it', async ({ page, context }) => {
    const machine = await opened(page, context);
    await tabs(page).getByRole('button', { name: 'docs · claude' }).click();
    await page.getByRole('button', { name: 'Split', exact: true }).click();

    const left = side(page, 'weft · codex');
    const right = side(page, 'docs · claude');
    await expect(page.locator('.split-side')).toHaveCount(2);
    expect((await left.boundingBox())!.x).toBeLessThan((await right.boundingBox())!.x);
    await expect(right).toHaveClass(/split-side--current/);
    await expect(tabs(page)).toHaveCount(0);
    // One watch for both, each with this device's size for it.
    await expect.poll(() => machine.of('watch').at(-1)).toMatchObject({ agent: CODEX, also: { agent: DOCS_CLAUDE } });
    const both = machine.of('watch').at(-1)!;
    expect(both.rows).toBeGreaterThan(0);
    expect((both.also as { cols: number }).cols).toBeGreaterThan(0);

    // Each side draws its own agent's frames.
    machine.send(screen(CODEX, 'left side'));
    machine.send(screen(DOCS_CLAUDE, 'right side'));
    await expect(left.locator('.xterm-rows')).toContainText('left side');
    await expect(right.locator('.xterm-rows')).toContainText('right side');
    await expect(left.locator('.xterm-rows')).not.toContainText('right side');

    // A click in the left side makes it the side with the keys.
    await left.getByLabel("The agent's screen").click();
    await expect(left).toHaveClass(/split-side--current/);
    await expect(left.getByLabel('The agent', { exact: true })).toHaveAttribute('data-active', 'true');
    await expect(right.getByLabel('The agent', { exact: true })).toHaveAttribute('data-active', 'false');
    await page.keyboard.type('x');
    await expect.poll(() => machine.of('keys').at(-1)?.agent).toBe(CODEX);

    // Each side has its own message box.
    await right.locator('.message-input').fill('to docs');
    await right.getByRole('button', { name: 'Send' }).click();
    await expect.poll(() => machine.of('text').at(-1)).toMatchObject({ agent: DOCS_CLAUDE, text: 'to docs' });
    await expect(right).toHaveClass(/split-side--current/);

    // A tree row puts its agent in the side with the keys.
    await left.getByLabel("The agent's screen").click();
    await row(page, 'claude · fix login').click();
    await expect(side(page, 'weft · claude')).toHaveClass(/split-side--current/);
    await expect(side(page, 'docs · claude')).not.toHaveClass(/split-side--current/);
    expect((await side(page, 'weft · codex').count())).toBe(0);
    await expect.poll(() => machine.of('watch').at(-1)).toMatchObject({ also: { agent: expect.any(String) } });
    const watched = machine.of('watch').at(-1)!;
    expect([watched.agent, (watched.also as { agent: string }).agent].sort()).toEqual([CLAUDE, DOCS_CLAUDE].sort());

    // One pane: the side with the keys stays.
    await page.getByRole('button', { name: 'One pane', exact: true }).click();
    await expect(page.locator('.split-side')).toHaveCount(0);
    await expect(tabs(page).getByRole('button', { name: 'weft · claude ●' })).toHaveAttribute('aria-current', 'page');
    await expect.poll(() => { const w = machine.of('watch').at(-1)!; return [w.agent, 'also' in w]; }).toEqual([CLAUDE, false]);
    await machine.close();
  });

  test('a tree row of the other side\'s agent makes that side the one with the keys', async ({ page, context }) => {
    const machine = await opened(page, context);
    await row(page, 'claude · fix login').click();
    await page.getByRole('button', { name: 'Split', exact: true }).click();
    await expect(side(page, 'weft · claude')).toHaveClass(/split-side--current/);
    await row(page, 'codex · health endpoint').click();
    await expect(side(page, 'weft · codex')).toHaveClass(/split-side--current/);
    await expect(side(page, 'weft · claude')).not.toHaveClass(/split-side--current/);
    await expect(page.locator('.split-side')).toHaveCount(2);
    await machine.close();
  });

  test('a narrow window shows one pane; an older machine offers no Split; one agent says why', async ({ page, context }) => {
    let machine = await opened(page, context);
    await page.getByRole('button', { name: 'Split', exact: true }).click();
    await expect(page.locator('.split-side')).toHaveCount(2);
    await page.setViewportSize({ width: 1000, height: 720 });
    await expect(page.locator('.split-side')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Split', exact: true })).toHaveCount(0);
    await page.setViewportSize({ width: 1280, height: 720 });
    await expect(page.locator('.split-side')).toHaveCount(2);
    await machine.close();

    machine = await opened(page, context, (m) => (m.split = false));
    await expect(tabs(page).getByRole('button')).toHaveCount(4);
    await expect(page.getByRole('button', { name: 'Split', exact: true })).toHaveCount(0);
    await machine.close();

    machine = await FakeMachine.start();
    machine.agents = [agent(0, 'weft', 'claude-code', 'ready')];
    await signIn(context, person('octo', [{ name: 'studio', address: machine.address }]));
    await page.goto('/');
    await openAgent(page, 'claude-code · no Ask yet');
    await page.getByRole('button', { name: 'Split', exact: true }).click();
    await expect(page.getByText('A split needs two agents running.')).toBeVisible();
    await expect(page.locator('.split-side')).toHaveCount(0);
    await machine.close();
  });
});
