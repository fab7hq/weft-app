// Agents across projects: every open project's running agents as tabs; on a
// phone, the header's name, the dots and the list.
import { expect, test, type Page } from '@playwright/test';
import { CODEX, CODEX_NEW, DOCS, WEFT } from './atlas-fixtures';
import { FakeMachine, atlas } from './fake-machine';
import { openAgent } from './open';
import { person, signIn } from './seed';
import { pull, swipeLeft, swipeRight } from './touch';

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
    await expect(page.getByRole('button', { name: 'Layout', exact: true })).toBeVisible();
    await machine.close();
  });
});

test.describe('phone', () => {
  test.skip(({ isMobile }) => !isMobile, 'a phone');

  const top = (page: Page) => page.locator('.agent-head');
  const name = (page: Page) => page.getByRole('button', { name: /·/, exact: false }).and(page.locator('.agent-name'));
  const dots = (page: Page) => page.locator('.agent-dot');

  test('the header names the agent by project; the dots say where it is; no tabs, no split', async ({ page, context }) => {
    const machine = await opened(page, context);
    await expect(name(page)).toHaveText('weft · codex▾');
    await expect(name(page)).toHaveAccessibleName('weft · codex');
    await expect(tabs(page)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Layout', exact: true })).toHaveCount(0);
    await expect(dots(page)).toHaveCount(4);
    await expect(dots(page).nth(1)).toHaveClass(/agent-dot--shown/);
    await expect(dots(page).nth(0)).toHaveClass(/agent-dot--needs-you/);
    await machine.close();
  });

  test('a swipe on the header or the dots opens the next or previous agent, and never scrolls the pane', async ({ page, context }) => {
    const machine = await opened(page, context);
    const reads = () => machine.of('read').length;
    const before = reads();
    await swipeLeft(top(page));
    await expect.poll(() => machine.of('watch').at(-1)?.agent).toBe(CODEX_NEW);
    await expect(name(page)).toHaveAccessibleName('weft · codex');
    await expect(dots(page).nth(2)).toHaveClass(/agent-dot--shown/);
    await swipeLeft(page.locator('.agent-dots'));
    await expect.poll(() => machine.of('watch').at(-1)?.agent).toBe(DOCS_CLAUDE);
    await expect(name(page)).toHaveAccessibleName('docs · claude');
    // Back goes to Weft's tree, whatever the agent's project.
    await expect(page.getByRole('button', { name: '‹ weft', exact: true })).toBeVisible();
    // The last one: nothing further.
    await swipeLeft(top(page));
    await page.waitForTimeout(200);
    expect(machine.of('watch').at(-1)?.agent).toBe(DOCS_CLAUDE);
    await swipeRight(top(page));
    await expect.poll(() => machine.of('watch').at(-1)?.agent).toBe(CODEX_NEW);
    // A finger pulling down on the header is no scroll of the pane's history.
    await pull(top(page), 200);
    await page.waitForTimeout(200);
    expect(reads()).toBe(before);
    expect(machine.of('keys')).toHaveLength(0);
    await machine.close();
  });

  test('the dots and the swipes follow this device\'s tab order: an agent started later comes last, after docs', async ({ page, context }) => {
    const machine = await opened(page, context);
    const later = `${WEFT}-3`;
    machine.agents = [...machine.agents, { agent: later, project: 'weft', harness: 'codex', title: 'Codex', turn: 'ready', running: true, since: Date.now() }];
    machine.send({ type: 'agents', agents: machine.agents });
    await expect(dots(page)).toHaveCount(5);
    await swipeLeft(top(page));
    await expect.poll(() => machine.of('watch').at(-1)?.agent).toBe(CODEX_NEW);
    await swipeLeft(top(page));
    await expect.poll(() => machine.of('watch').at(-1)?.agent).toBe(DOCS_CLAUDE);
    await swipeLeft(top(page));
    await expect.poll(() => machine.of('watch').at(-1)?.agent).toBe(later);
    await expect(dots(page).nth(4)).toHaveClass(/agent-dot--shown/);
    await expect(page.getByRole('button', { name: 'Layout', exact: true })).toHaveCount(0);
    await machine.close();
  });

  test('the name opens the list: NEEDS YOU first, then each project, ✓ on the one shown; a row opens it; a swipe down closes it', async ({ page, context }) => {
    const machine = await opened(page, context);
    await name(page).click();
    const list = page.getByRole('dialog', { name: 'Agents' });
    await expect(list.getByRole('heading')).toHaveText(['Agents', 'NEEDS YOU', 'WEFT', 'DOCS']);
    await expect(list.getByRole('region', { name: 'NEEDS YOU' }).getByRole('button')).toHaveText(['●weft · claudeneeds you']);
    await expect(list.getByRole('region', { name: 'weft' }).getByRole('button')).toHaveText(['●claudeneeds you', '●codexturn ended✓', '●codexworking']);
    await expect(list.getByRole('region', { name: 'weft' }).getByRole('button').nth(1)).toHaveAttribute('aria-current', 'true');
    await list.getByRole('region', { name: 'docs' }).getByRole('button').click();
    await expect(list).toHaveCount(0);
    await expect.poll(() => machine.of('watch').at(-1)?.agent).toBe(DOCS_CLAUDE);

    await name(page).click();
    await pull(list, 120);
    await expect(list).toHaveCount(0);
    await name(page).click();
    await page.locator('.sheet-backdrop').click({ position: { x: 20, y: 20 } });
    await expect(list).toHaveCount(0);
    expect(machine.of('watch').at(-1)?.agent).toBe(DOCS_CLAUDE);
    await machine.close();
  });
});
