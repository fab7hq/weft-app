// web-app.md §11 tests 1 and 2: the screen, watching and driving,
// the key bar, the message box, history.
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { FakeMachine, agent } from './fake-machine';
import { pull } from './touch';
import { openAgent } from './open';
import { person, signIn } from './seed';

const fixtures = path.join(import.meta.dirname, '../../weft/crates/weftd/tests/fixtures/screens');

async function opened(page: Page, machine: FakeMachine, which = 'claude-code · no Ask yet') {
  await page.goto('/');
  await openAgent(page, which);
  await expect.poll(() => machine.of('watch').length).toBeGreaterThan(0);
}

/** What xterm.js drew, row by row, trailing blanks dropped. */
async function drawn(page: Page): Promise<string> {
  const rows = await page.locator('.xterm-rows > div').allTextContents();
  return rows.map((r) => r.replace(/ /g, ' ').trimEnd()).join('\n').replace(/\n+$/, '');
}

test('test 1: frames from weftd draw what weftd\'s own parser shows', async ({ page, context }) => {
  const machine = await FakeMachine.start();
  machine.agents = [agent(0, 'weft', 'claude-code', 'waiting')];
  await signIn(context, person('octo', [{ name: 'studio', address: machine.address }]));
  await opened(page, machine);
  for (const name of readdirSync(fixtures).filter((f) => f.endsWith('.frames.json'))) {
    const fixture = JSON.parse(readFileSync(path.join(fixtures, name), 'utf8'));
    for (const [seq, f] of fixture.frames.entries()) {
      machine.send({ type: 'screen', agent: '3f9a1c07b2de-0', seq, full: f.full, rows: fixture.rows, cols: fixture.cols, bytes: f.bytes });
    }
    const want = (fixture.frames.at(-1).contents as string).split('\n').map((r) => r.trimEnd()).join('\n').replace(/\n+$/, '');
    await expect.poll(() => drawn(page), { message: name }).toBe(want);
  }
  await expect(page.getByText("Watching at the machine's size")).toHaveCount(0);
  await machine.close();
});

test('test 2: allow, open an agent, press 1, send a message, read history', async ({ page, context }) => {
  const machine = await FakeMachine.start();
  machine.agents = [agent(0, 'weft', 'claude-code', 'waiting'), agent(1, 'docs', 'codex', 'ready')];
  await signIn(context, person('octo', [{ name: 'studio', address: machine.address }]));
  await opened(page, machine);
  expect(machine.of('pair')).toHaveLength(1);
  expect(machine.of('watch').at(-1)).toMatchObject({ type: 'watch', agent: '3f9a1c07b2de-0', rows: expect.any(Number), cols: expect.any(Number) });
  expect(machine.of('size')).toHaveLength(0);

  await page.getByRole('button', { name: 'The bar', exact: true }).click();
  await page.getByRole('dialog', { name: 'Weft' }).getByRole('button', { name: 'Tab', exact: true }).click();
  await expect.poll(() => machine.of('keys').length).toBe(1);
  await page.keyboard.press('Escape');
  const [size] = machine.of('size');
  expect(size).toMatchObject({ type: 'size', agent: '3f9a1c07b2de-0' });
  expect(Number(size.rows)).toBeGreaterThan(10);
  expect(Number(size.cols)).toBeGreaterThan(20);
  expect(machine.heard.indexOf(size)).toBeLessThan(machine.heard.indexOf(machine.of('keys')[0]));
  expect(machine.of('keys')[0]).toMatchObject({ agent: '3f9a1c07b2de-0', bytes: 'CQ==' });
  machine.send({ type: 'control', agent: '3f9a1c07b2de-0', by: 'you' });

  await page.getByLabel('Message').fill('Also add it to the README');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect.poll(() => machine.of('text').length).toBe(1);
  expect(machine.of('text')[0]).toMatchObject({ agent: '3f9a1c07b2de-0', text: 'Also add it to the README' });
  await expect(page.getByLabel('Message')).toHaveValue('');

  machine.send({ type: 'control', agent: '3f9a1c07b2de-0', by: 'mac' });

  // History: asked for, shown as text, newest at the bottom.
  machine.onRead = (m) => (m.what === 'history' ? { type: 'ok', req: m.req, text: 'line 1\nline 2\nthe newest line' } : machine.read(m));
  // In the active pane, a finger pulling the screen down asks for what scrolled away (§6).
  await page.getByLabel('The agent', { exact: true }).click();
  await pull(page.getByLabel("The agent's screen"), 160);
  await expect(page.getByText('the newest line')).toBeVisible();
  expect(machine.of('read').at(-1)).toMatchObject({ what: 'history', agent: '3f9a1c07b2de-0' });
  await machine.close();
});

test('test 2: a notification\'s agent opens from what it left in IndexedDB', async ({ page, context }) => {
  const machine = await FakeMachine.start();
  machine.agents = [agent(0, 'weft', 'claude-code', 'waiting'), agent(1, 'docs', 'codex', 'ready')];
  await signIn(context, person('octo', [{ name: 'studio', address: machine.address }]));
  await page.goto('/');
  await expect(page.getByRole('treeitem', { name: 'docs', exact: true })).toBeVisible();
  await page.evaluate(
    () =>
      new Promise<void>((done) => {
        const r = indexedDB.open('weft', 1);
        r.onsuccess = () => {
          const t = r.result.transaction('open', 'readwrite');
          t.objectStore('open').put('3f9a1c07b2de-1', 'open');
          t.oncomplete = () => done();
        };
      }),
  );
  await page.reload();
  await expect.poll(() => machine.of('watch').at(-1)?.agent).toBe('3f9a1c07b2de-1');
  await expect(page.getByRole('navigation', { name: 'Tabs' }).getByRole('button', { name: '2 codex' })).toHaveAttribute('aria-current', 'page');
  const left = await page.evaluate(
    () =>
      new Promise((done) => {
        const r = indexedDB.open('weft', 1);
        r.onsuccess = () => {
          const g = r.result.transaction('open').objectStore('open').get('open');
          g.onsuccess = () => done(g.result ?? null);
        };
      }),
  );
  expect(left).toBeNull();
  await machine.close();
});
