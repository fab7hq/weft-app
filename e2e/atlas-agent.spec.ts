// The agent (M3.1, M3.3, M3.5, D3.1, D3.3, D3.5): the pane's border is its state;
// a double tap, or a click, makes it active; then history and the live screen scroll as one.
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { FakeMachine, atlas } from './fake-machine';
import { person, signIn } from './seed';

async function opened(page: Page, context: BrowserContext) {
  const machine = await FakeMachine.start();
  Object.assign(machine, atlas());
  machine.onRead = (m) => ({ type: 'ok', req: m.req, text: Array.from({ length: 200 }, (_, i) => `line ${i + 1}`).join('\n') });
  await signIn(context, person('octo', [{ name: 'studio', address: machine.address }]));
  await page.goto('/');
  await page.getByRole('treeitem', { name: 'codex', exact: true }).click();
  await expect.poll(() => machine.of('watch').at(-1)?.agent).toBe('3f9a1c07b2de-1');
  return machine;
}

/** A finger pulling the element down by `by` pixels: scrolling up. */
async function pull(page: Page, by: number) {
  await page.getByLabel("The agent's screen").evaluate((el, by) => {
    const r = el.getBoundingClientRect();
    const at = (y: number) => [new Touch({ identifier: 1, target: el, clientX: r.x + 50, clientY: y })];
    el.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: at(r.y + 40), changedTouches: at(r.y + 40) }));
    el.dispatchEvent(new TouchEvent('touchmove', { bubbles: true, touches: at(r.y + 40 + by), changedTouches: at(r.y + 40 + by) }));
    el.dispatchEvent(new TouchEvent('touchend', { bubbles: true, touches: [], changedTouches: at(r.y + 40 + by) }));
  }, by);
}

const pane = (page: Page) => page.getByLabel('The agent', { exact: true });

test('M3.1 M3.3 M3.5: a single tap does not activate; a double tap does, and a pull reads the history in the pane', async ({ page, context }, info) => {
  test.skip(info.project.name !== 'iphone', 'a touch screen');
  const machine = await opened(page, context);
  await expect(pane(page)).toHaveAttribute('data-active', 'false');
  await pane(page).tap();
  await page.waitForTimeout(500);
  await expect(pane(page)).toHaveAttribute('data-active', 'false');
  await pull(page, 200);
  await page.waitForTimeout(300);
  expect(machine.of('read')).toHaveLength(0);

  await pane(page).tap();
  await pane(page).tap();
  await expect(pane(page)).toHaveAttribute('data-active', 'true');
  await pull(page, 200);
  const history = pane(page).getByLabel('History');
  await expect(history.getByText('line 200')).toBeInViewport();
  const [inside, box] = [(await history.boundingBox())!, (await pane(page).boundingBox())!];
  expect(inside.y).toBeGreaterThanOrEqual(box.y - 1);
  expect(inside.y + inside.height).toBeLessThanOrEqual(box.y + box.height + 1);
  await expect(page.getByText(/READING|LIVE|Watching at the machine/)).toHaveCount(0);

  // A tap outside: inactive again, at the newest line.
  await page.getByLabel('Message').tap();
  await expect(pane(page)).toHaveAttribute('data-active', 'false');
  await expect(history).toHaveCount(0);
  await machine.close();
});

test('D3.1 D3.3 D3.5: a click activates; the wheel reads the history and goes back to live', async ({ page, context }, info) => {
  test.skip(info.project.name !== 'desktop', 'a mouse');
  const machine = await opened(page, context);
  await pane(page).hover();
  await page.mouse.wheel(0, -300);
  await page.waitForTimeout(300);
  expect(machine.of('read')).toHaveLength(0);
  await expect(pane(page)).toHaveAttribute('data-active', 'false');

  await pane(page).click();
  await expect(pane(page)).toHaveAttribute('data-active', 'true');
  await page.mouse.wheel(0, -300);
  const history = pane(page).getByLabel('History');
  await expect(history.getByText('line 200')).toBeInViewport();
  await expect(page.getByText(/READING|LIVE|Watching at the machine/)).toHaveCount(0);
  await page.mouse.wheel(0, 2000);
  await page.mouse.wheel(0, 300);
  await expect(history).toHaveCount(0);

  // A click outside the pane: inactive.
  await page.getByRole('treeitem', { name: 'weft', exact: true }).click({ position: { x: 300, y: 10 } });
  await expect(pane(page)).toHaveAttribute('data-active', 'false');
  await machine.close();
});
