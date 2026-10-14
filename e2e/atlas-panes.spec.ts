// Panes and tabs like an editor, on a desktop: a tree of panes, each with
// its own tab bar ending in the layout button; a split moves the tab shown;
// a tab dragged lands on a bar, a pane's edge or its middle; four panes at
// most; a window too small shows the pane you are in alone; the layout is
// this browser's, and comes back.
import { expect, test, type Locator, type Page } from '@playwright/test';
import { CLAUDE, CODEX, CODEX_NEW, DOCS } from './atlas-fixtures';
import { FakeMachine, atlas } from './fake-machine';
import { openAgent, row } from './open';
import { person, signIn } from './seed';

const DOCS_CLAUDE = `${DOCS}-0`;
const DOCS_CODEX = `${DOCS}-1`;

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

const boxes = (page: Page) => page.locator('.pane-box');
const pane = (page: Page, name: string) => page.getByRole('region', { name, exact: true });
const tab = (where: Page | Locator, name: string) => where.getByRole('navigation', { name: 'Tabs' }).getByRole('button', { name, exact: true });
const screen = (agent: string, text: string) => ({ type: 'screen', agent, seq: 1, full: true, rows: 10, cols: 40, bytes: Buffer.from(text).toString('base64') });
/** The agents a watch names, the first and those beside it. */
const watched = (m: Record<string, unknown> | undefined) => {
  const also = m?.also;
  return [m?.agent, ...(Array.isArray(also) ? also : also ? [also] : []).map((a) => (a as { agent: string }).agent)].sort();
};

/** Pick an item of a pane's layout menu. */
async function layout(where: Page | Locator, item: string) {
  await where.getByRole('button', { name: 'Layout', exact: true }).first().click();
  await where.getByRole('menuitem', { name: item, exact: true }).click();
}

test.describe('desktop', () => {
  test.skip(({ isMobile }) => isMobile, 'a desktop');

  test('Split right moves the tab shown to a new pane, which has the keys; each pane its own tabs, frames and keys; one message row for the agent in front', async ({ page, context }) => {
    const machine = await opened(page, context);
    await tab(page, 'docs · claude').click();
    await layout(page, 'Split right');
    await expect(boxes(page)).toHaveCount(2);
    const right = pane(page, 'docs · claude');
    await expect(right).toHaveClass(/pane-box--current/);
    // The pane it left shows its neighbour, and keeps the other tabs.
    const left = boxes(page).first();
    await expect(left.getByRole('navigation', { name: 'Tabs' }).getByRole('button')).toHaveText(['weft · claude ●', 'weft · codex', 'weft · codex']);
    await expect(right.getByRole('navigation', { name: 'Tabs' }).getByRole('button')).toHaveText(['docs · claude']);
    expect((await left.boundingBox())!.x).toBeLessThan((await right.boundingBox())!.x);
    // One watch for both, each with this device's size for it.
    await expect.poll(() => watched(machine.of('watch').at(-1))).toEqual([CODEX_NEW, DOCS_CLAUDE].sort());

    machine.send(screen(CODEX_NEW, 'left pane'));
    machine.send(screen(DOCS_CLAUDE, 'right pane'));
    await expect(left.locator('.xterm-rows')).toContainText('left pane');
    await expect(right.locator('.xterm-rows')).toContainText('right pane');
    await expect(left.locator('.xterm-rows')).not.toContainText('right pane');

    // One message row, under the panes, for the agent in front (D15.1).
    await expect(page.locator('.message-input')).toHaveCount(1);
    await expect(page.locator('.message-input')).toHaveAttribute('placeholder', 'Message docs · claude…');
    await page.locator('.message-input').fill('to docs');
    await page.getByRole('button', { name: 'Send' }).click();
    await expect.poll(() => machine.of('text').at(-1)).toMatchObject({ agent: DOCS_CLAUDE, text: 'to docs' });

    // A click in the left pane's screen gives it the keys and selects its
    // agent: its tree row, the bar's text, and the message row (D15.1).
    await left.getByLabel("The agent's screen").click();
    await expect(left).toHaveClass(/pane-box--current/);
    await expect(right).not.toHaveClass(/pane-box--current/);
    await expect(page.locator('.tree-selected')).toHaveText(/^selected: codex · /);
    await expect(row(page, 'codex · no Ask yet')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.message-input')).toHaveAttribute('placeholder', 'Message weft · codex…');
    await page.keyboard.type('x');
    await expect.poll(() => machine.of('keys').at(-1)?.agent).toBe(CODEX_NEW);

    // A tree row shows its agent in the pane that holds it.
    await row(page, 'claude · fix login').click();
    await expect(pane(page, 'weft · claude')).toHaveClass(/pane-box--current/);
    await expect(boxes(page)).toHaveCount(2);
    await expect.poll(() => watched(machine.of('watch').at(-1))).toEqual([CLAUDE, DOCS_CLAUDE].sort());

    // Join all panes: one again, every tab in it in their numbered order.
    await layout(page, 'Join all panes');
    await expect(boxes(page)).toHaveCount(1);
    await expect(tab(page, 'docs · claude')).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Tabs' }).getByRole('button')).toHaveText(['weft · claude ●', 'weft · codex', 'weft · codex', 'docs · claude']);
    await machine.close();
  });

  test('four panes at most: a fifth split says so above the bar and nothing moves; three side by side have no room; a pane of one agent does not split', async ({ page, context }) => {
    const machine = await opened(page, context, (m) => m.agents.push({ agent: DOCS_CODEX, project: 'docs', harness: 'codex', title: 'Codex', turn: 'ready', running: true, since: Date.now() }));
    // weft · codex right; weft's claude below the left; docs' two to the right, then the codex below it.
    await layout(page, 'Split right');
    const right = boxes(page).nth(1);
    await expect(right.getByRole('button', { name: 'Layout' })).toBeVisible();
    await right.getByRole('navigation', { name: 'Tabs' }).getByRole('button').click();
    await layout(right, 'Split down');
    await expect(page.getByText('A split needs two agents in the pane.')).toBeVisible();
    await expect(boxes(page)).toHaveCount(2);

    const left = boxes(page).first();
    await tab(left, 'weft · claude ●').click();
    await layout(left, 'Split down');
    await expect(boxes(page)).toHaveCount(3);
    for (const name of ['docs · claude', 'docs · codex']) {
      await tab(page, name).click();
      await layout(pane(page, name), 'Move tab to the next pane');
    }
    await tab(page, 'docs · codex').click();
    await layout(pane(page, 'docs · codex'), 'Split down');
    await expect(boxes(page)).toHaveCount(4);
    const before = await page.getByRole('navigation', { name: 'Tabs' }).getByRole('button').allTextContents();
    const two = boxes(page).filter({ has: page.locator('.tab:nth-child(2)') }).first();
    await layout(two, 'Split right');
    await expect(page.getByText('Four panes at most. Move a tab into another pane, or Join all panes.')).toBeVisible();
    await expect(boxes(page)).toHaveCount(4);
    expect(await page.getByRole('navigation', { name: 'Tabs' }).getByRole('button').allTextContents()).toEqual(before);
    // Four watched, each its own size.
    await expect.poll(() => watched(machine.of('watch').at(-1)).length).toBe(4);
    const four = machine.of('watch').at(-1)!;
    expect((four.also as unknown[]).length).toBe(3);

    await layout(page, 'Join all panes');
    await layout(page, 'Split right');
    await layout(boxes(page).first(), 'Split right');
    await expect(page.getByText('No room for another pane here.')).toBeVisible();
    await expect(boxes(page)).toHaveCount(2);
    await machine.close();
  });

  test('a window too small for the layout shows the pane you are in alone, the layout kept; the layout comes back after a reload', async ({ page, context }) => {
    const machine = await opened(page, context);
    await tab(page, 'docs · claude').click();
    await layout(page, 'Split right');
    await expect(boxes(page)).toHaveCount(2);
    await page.setViewportSize({ width: 900, height: 720 });
    await expect(boxes(page)).toHaveCount(1);
    await expect(pane(page, 'docs · claude')).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Tabs' }).getByRole('button')).toHaveText(['docs · claude']);
    await page.setViewportSize({ width: 1280, height: 720 });
    await expect(boxes(page)).toHaveCount(2);

    await page.reload();
    await openAgent(page, 'codex · health endpoint');
    await expect(boxes(page)).toHaveCount(2);
    await expect(pane(page, 'docs · claude')).toBeVisible();
    await machine.close();
  });

  test('a tab dragged: along its bar, onto a pane\'s edge, into a pane\'s middle, onto another bar; the last out of a pane closes it', async ({ page, context }) => {
    const machine = await opened(page, context);
    const bar = () => page.getByRole('navigation', { name: 'Tabs' }).first();
    // Along its bar: before the first.
    await tab(page, 'docs · claude').dragTo(tab(page, 'weft · claude ●'), { targetPosition: { x: 4, y: 10 } });
    await expect(bar().getByRole('button')).toHaveText(['docs · claude', 'weft · claude ●', 'weft · codex', 'weft · codex']);
    // The pane's right fifth: a pane on the right.
    const one = boxes(page).first();
    const box = (await one.boundingBox())!;
    await tab(page, 'docs · claude').dragTo(one, { targetPosition: { x: box.width - 20, y: box.height / 2 } });
    await expect(boxes(page)).toHaveCount(2);
    await expect(pane(page, 'docs · claude')).toHaveClass(/pane-box--current/);
    // Into the right pane's middle.
    const right = pane(page, 'docs · claude');
    const r = (await right.boundingBox())!;
    await tab(page, 'weft · claude ●').dragTo(right, { targetPosition: { x: r.width / 2, y: r.height / 2 } });
    await expect(boxes(page).nth(1).getByRole('navigation', { name: 'Tabs' }).getByRole('button')).toHaveText(['docs · claude', 'weft · claude ●']);
    // Onto the left bar, after its tabs; the right pane keeps one.
    const b = (await bar().boundingBox())!;
    await tab(page, 'docs · claude').dragTo(bar(), { targetPosition: { x: b.width - 8, y: b.height / 2 } });
    await expect(bar().getByRole('button')).toHaveText(['weft · codex', 'weft · codex', 'docs · claude']);
    // The last tab out of a pane: it closes.
    const left = boxes(page).first();
    const l = (await left.boundingBox())!;
    await tab(page, 'weft · claude ●').dragTo(left, { targetPosition: { x: l.width / 2, y: l.height / 2 } });
    await expect(boxes(page)).toHaveCount(1);
    await machine.close();
  });

  test('a machine that shows one agent at a time offers no layout button; one that shows two has room for two', async ({ page, context }) => {
    let machine = await opened(page, context, (m) => { m.split = false; m.panes = undefined; });
    await expect(page.getByRole('navigation', { name: 'Tabs' }).getByRole('button')).toHaveCount(4);
    await expect(page.getByRole('button', { name: 'Layout', exact: true })).toHaveCount(0);
    await machine.close();

    machine = await opened(page, context, (m) => (m.panes = undefined));
    await layout(page, 'Split right');
    await expect(boxes(page)).toHaveCount(2);
    await expect.poll(() => (machine.of('watch').at(-1)?.also as { agent?: string } | undefined)?.agent).toBeTruthy();
    await layout(boxes(page).first(), 'Split down');
    await expect(page.getByText('No room for another pane here.')).toBeVisible();
    await expect(boxes(page)).toHaveCount(2);
    await machine.close();
  });
});

test.describe('the list', () => {
  test.skip(({ isMobile }) => isMobile, 'a desktop');

  test('D15.1 D15.7: the list\'s toggle hides the list and shows it again; the browser keeps it', async ({ page, context }) => {
    const machine = await opened(page, context);
    const list = page.getByRole('navigation', { name: 'Work' });
    await expect(list).toBeVisible();
    await page.getByRole('button', { name: 'Hide the list' }).click();
    await expect(list).toHaveCount(0);
    // The panes take the width.
    const pane = await page.locator('.pane-box').first().boundingBox();
    expect(pane!.x).toBeLessThan(40);
    // Kept: the next visit, once an agent is open, hides it again.
    await page.reload();
    await expect(list).toBeVisible();
    await openAgent(page, 'codex · health endpoint');
    await expect(list).toHaveCount(0);
    await page.getByRole('button', { name: 'Show the list' }).click();
    await expect(list).toBeVisible();
    await machine.close();
  });

  test('D15.7: with no agent open the list is shown, though it was hidden, and has no toggle', async ({ page, context }) => {
    const machine = await FakeMachine.start();
    Object.assign(machine, atlas());
    await signIn(context, person('octo', [{ name: 'studio', address: machine.address }]));
    await page.addInitScript(() => localStorage.setItem('weft.list', 'hidden'));
    await page.goto('/');
    const list = page.getByRole('navigation', { name: 'Work' });
    await expect(list).toBeVisible();
    await expect(page.getByRole('button', { name: /^(Hide|Show) the list$/ })).toHaveCount(0);
    // An agent opened: the list is hidden as this browser keeps it.
    await openAgent(page, 'codex · health endpoint');
    await expect(list).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Show the list' })).toBeVisible();
    await machine.close();
  });
});
