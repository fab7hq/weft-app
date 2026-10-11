// The agent (M3.1, M3.3, M3.5, D3.1, D3.3, D3.5): the pane's border is its state;
// a double tap, or a click, makes it active; then history and the live screen scroll as one.
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { FakeMachine, atlas } from './fake-machine';
import { pull as finger } from './touch';
import { openAgent } from './open';
import { person, signIn } from './seed';

async function opened(page: Page, context: BrowserContext) {
  const machine = await FakeMachine.start();
  Object.assign(machine, atlas());
  machine.onRead = (m) => (m.what === 'history' ? { type: 'ok', req: m.req, text: Array.from({ length: 200 }, (_, i) => `line ${i + 1}`).join('\n') } : machine.read(m));
  await signIn(context, person('octo', [{ name: 'studio', address: machine.address }]));
  await page.goto('/');
  await openAgent(page, 'codex · health endpoint');
  await expect.poll(() => machine.of('watch').at(-1)?.agent).toBe('3f9a1c07b2de-1');
  return machine;
}

/** A finger pulling the element down by `by` pixels: scrolling up. */
async function pull(page: Page, by: number) {
  await finger(page.getByLabel("The agent's screen"), by);
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
  expect(machine.of('read').filter((r) => r.what === 'history')).toHaveLength(0);

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
  expect(machine.of('read').filter((r) => r.what === 'history')).toHaveLength(0);
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

test('M3.6: at the top of what Weft holds, under the pane, whose history it is', async ({ page, context }, info) => {
  const machine = await opened(page, context);
  // A harness that keeps its own history names the key the machine gives.
  machine.onRead = (m) => (m.what === 'history' ? { type: 'ok', req: m.req, text: 'line 1\nline 2', transcript: 'Ctrl+T' } : machine.read(m));
  if (info.project.name === 'desktop') {
    await pane(page).click();
    await pane(page).hover();
    await page.mouse.wheel(0, -300);
  } else {
    await pane(page).tap();
    await pane(page).tap();
    await pull(page, 200);
  }
  await expect(page.getByRole('status')).toHaveText('codex keeps its own history: press Ctrl+T in the agent to read it.');
  // Back to live: the sentence goes with the history.
  await page.getByLabel('Message').click();
  await expect(page.getByText('keeps its own history')).toHaveCount(0);
  // One that names no key: nothing of it has scrolled away yet.
  machine.onRead = (m) => (m.what === 'history' ? { type: 'ok', req: m.req, text: 'line 1' } : machine.read(m));
  if (info.project.name === 'desktop') {
    await pane(page).click();
    await pane(page).hover();
    await page.mouse.wheel(0, -300);
  } else {
    await pane(page).tap();
    await pane(page).tap();
    await pull(page, 200);
  }
  await expect(page.getByRole('status')).toHaveText("Nothing of codex's has scrolled away yet.");
  await machine.close();
});

test('M3.8: a harness not set up for RingFrame: ⚠ on its tab, and why under the pane', async ({ page, context }) => {
  const machine = await FakeMachine.start();
  const s = atlas();
  s.tree[0].ask = { key: 'why.not_set_up', harness: 'codex' };
  Object.assign(machine, s);
  await signIn(context, person('octo', [{ name: 'studio', address: machine.address }]));
  await page.goto('/');
  await openAgent(page, 'codex · health endpoint');
  const tabs = page.getByRole('navigation', { name: 'Tabs' });
  await expect(tabs.getByRole('button', { name: '2 codex ⚠', exact: true })).toBeVisible();
  await expect(tabs.getByRole('button', { name: '1 claude ●', exact: true })).toBeVisible();
  await expect(page.getByText('codex is not set up for RingFrame. Set it up in Weft on studio: U.')).toBeVisible();
  await machine.close();
});

const hex = (b64: unknown) => [...Buffer.from(String(b64), 'base64')].map((b) => b.toString(16).padStart(2, '0')).join(' ');

test('M3.4 D3.4 M3.10: while the agent waits, the strip is ↑ ↓ ⏎ Esc and sends their bytes; no digit key anywhere', async ({ page, context }, info) => {
  const machine = await FakeMachine.start();
  Object.assign(machine, atlas());
  await signIn(context, person('octo', [{ name: 'studio', address: machine.address }]));
  await page.goto('/');
  await openAgent(page, 'claude · fix login');
  const strip = page.getByRole('toolbar', { name: 'Answer' });
  await expect(strip.getByText('NEEDS YOU')).toBeVisible();
  expect(await strip.getByRole('button').allTextContents()).toEqual(['↑', '↓', '⏎', 'Esc']);
  for (const name of ['Up', 'Down', 'Enter', 'Esc']) await strip.getByRole('button', { name, exact: true }).click();
  await expect.poll(() => machine.of('keys').map((k) => hex(k.bytes))).toEqual(['1b 5b 41', '1b 5b 42', '0d', '1b']);
  for (const digit of ['1', '2', '3']) await expect(page.getByRole('button', { name: digit, exact: true })).toHaveCount(0);

  // The key bar too has none.
  if (info.project.name.startsWith('iphone')) {
    const bar = page.getByRole('toolbar', { name: 'Keys' });
    await expect(bar.getByRole('button', { name: 'Tab', exact: true })).toBeVisible();
    for (const digit of ['1', '2', '3']) await expect(bar.getByRole('button', { name: digit, exact: true })).toHaveCount(0);
  }
  // Answered: no strip.
  machine.agents = machine.agents.map((a) => ({ ...a, turn: 'working' as const }));
  machine.send({ type: 'agents', agents: machine.agents });
  await expect(strip).toHaveCount(0);
  await machine.close();
});

test('M3.11: Ask at the top and the key bar under the message row; Eval, Seal and Eval view are not on the agent', async ({ page, context }, info) => {
  test.skip(info.project.name !== 'iphone', 'the phone');
  const machine = await opened(page, context);
  await expect(page.locator('.appbar').getByRole('button', { name: 'Ask', exact: true })).toBeVisible();
  const keys = page.getByRole('toolbar', { name: 'Keys' });
  for (const key of ['Ctrl', 'Alt', '⇧', 'Esc', 'Tab', 'Backspace', 'Left', 'Up', 'Down', 'Right', 'Enter', 'Control-C', 'PgUp', 'PgDn']) {
    await expect(keys.getByRole('button', { name: key, exact: true })).toBeVisible();
  }
  await expect(page.getByRole('dialog')).toHaveCount(0);
  for (const gone of ['Eval', 'Seal', 'Eval view', '[V] EVAL VIEW']) await expect(page.getByRole('button', { name: gone, exact: true })).toHaveCount(0);
  await machine.close();
});

test('D3.4 M3.1: no Eval on cue once a turn has ended', async ({ page, context }) => {
  const machine = await opened(page, context);
  await expect(page.getByRole('group', { name: 'On cue' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Eval', exact: true })).toHaveCount(page.viewportSize()!.width >= 768 ? 1 : 0);
  await machine.close();
});

test('D3.3 D3.11: while the pane is active the bar is Ask · Keys, and Keys sends the agent its keys', async ({ page, context }, info) => {
  test.skip(info.project.name !== 'desktop', 'the desktop');
  const machine = await opened(page, context);
  const bar = page.locator('.tree-acts');
  await expect(bar.getByRole('button')).toHaveText(['Ask', 'Eval', 'Seal']);
  await pane(page).click();
  await expect(bar.getByRole('button')).toHaveText(['Ask', 'Keys']);
  await bar.getByRole('button', { name: 'Keys' }).click();
  await expect(pane(page)).toHaveAttribute('data-active', 'true');
  await page.getByRole('toolbar', { name: 'Keys' }).getByRole('button', { name: 'Esc', exact: true }).click();
  await expect.poll(() => machine.of('keys').map((k) => hex(k.bytes))).toEqual(['1b']);
  await machine.close();
});

test('M3.7 D3.7: an ended agent says the TUI\'s sentence, from words.json', async ({ page, context }, info) => {
  const machine = await opened(page, context);
  const words = await (await page.request.get('/words.json')).json();
  machine.agents = machine.agents.map((a) => (a.agent === '3f9a1c07b2de-1' ? { ...a, running: false } : a));
  machine.send({ type: 'agents', agents: machine.agents });
  const said = words['agent.ended'].replace('{harness}', 'codex');
  await expect(page.getByText(said)).toBeVisible();
  expect(said).toBe('codex has ended. Its work is still on the list.');
  await expect(page.getByLabel("The agent's screen")).toHaveCount(0);
  // Its tab goes; the other codex's stays.
  await expect(page.getByRole('navigation', { name: 'Tabs' }).getByRole('button', { name: /codex/ })).toHaveCount(1);
  // A phone goes back to the tree; a desktop has it beside the sentence (D3.7).
  if (info.project.name === 'desktop') await expect(page.getByRole('button', { name: 'Back to the tree' })).toHaveCount(0);
  else await page.getByRole('button', { name: 'Back to the tree' }).click();
  await expect(page.getByRole('treeitem', { name: 'codex · health endpoint', exact: true })).toBeVisible();
  await machine.close();
});

/** A whole screen from an agent that asked for SGR mouse reports, as Codex does in its full screen. */
const fullScreen = { type: 'screen', agent: '3f9a1c07b2de-1', seq: 1, full: true, rows: 20, cols: 60,
  bytes: Buffer.from('\x1b[?1049h\x1b[?1000h\x1b[?1006h\x1b[Htranscript').toString('base64') };
const wheels = (machine: FakeMachine) => machine.of('keys').map((k) => Buffer.from(String(k.bytes), 'base64').toString());

test('an agent that asked for mouse reports gets the wheel, as in a terminal; no history is read', async ({ page, context }, info) => {
  test.skip(info.project.name !== 'desktop', 'a mouse');
  const machine = await opened(page, context);
  machine.send(fullScreen);
  await pane(page).click();
  await expect(pane(page)).toHaveAttribute('data-active', 'true');
  await page.mouse.wheel(0, -300);
  await expect.poll(() => wheels(machine).some((b) => /^\x1b\[<64;\d+;\d+M$/.test(b))).toBe(true);
  await page.mouse.wheel(0, 300);
  await expect.poll(() => wheels(machine).some((b) => /^\x1b\[<65;\d+;\d+M$/.test(b))).toBe(true);
  expect(machine.of('read').filter((r) => r.what === 'history')).toHaveLength(0);
  await expect(pane(page).getByLabel('History')).toHaveCount(0);
  await machine.close();
});

test('on a phone, a pull in an agent that asked for mouse reports scrolls it with the wheel', async ({ page, context }, info) => {
  test.skip(info.project.name === 'desktop', 'a finger');
  const machine = await opened(page, context);
  machine.send(fullScreen);
  await pane(page).tap();
  await pane(page).tap();
  await expect(pane(page)).toHaveAttribute('data-active', 'true');
  await pull(page, 120);
  await expect.poll(() => wheels(machine).filter((b) => b.startsWith('\x1b[<64;')).length).toBeGreaterThan(0);
  expect(machine.of('read').filter((r) => r.what === 'history')).toHaveLength(0);
  await machine.close();
});
