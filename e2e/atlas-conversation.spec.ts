// Terminal and Conversation (M12.1–M12.4, D12.1–D12.3; ADR-0031): the switch,
// remembered per device; the chat read from the machine and followed while
// shown; the steps folded and opened; the waiting line; the one line for a
// harness that cannot be read; and nothing of it kept in the browser.
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { FakeMachine, atlas, type Item } from './fake-machine';
import { openAgent, row, wideOf } from './open';
import { person, signIn } from './seed';
import { CLAUDE, CODEX, at } from './atlas-fixtures';

async function opened(page: Page, context: BrowserContext, name = 'claude · fix login') {
  const machine = await FakeMachine.start();
  Object.assign(machine, atlas());
  await signIn(context, person('octo', [{ name: 'studio', address: machine.address }]));
  await page.goto('/');
  await openAgent(page, name);
  return machine;
}

/** Open the agent again after a reload, in whichever view this device last chose. */
async function reopen(page: Page, name: string) {
  const r = row(page, name);
  if (wideOf(page)) await r.click();
  else {
    await r.getByRole('button', { name: /^Details of/ }).click();
    await page.getByRole('button', { name: 'Go to its agent', exact: true }).click();
  }
}

const tab = (page: Page, name: 'Terminal' | 'Conversation') => page.getByRole('tab', { name }).first();

test.afterEach(async ({ page }) => {
  await page.close();
});

test('M12.1 D12.1 M12.3 D12.3: the switch shows either view, and the last one chosen opens next time', async ({ page, context }) => {
  const machine = await opened(page, context);
  await expect(tab(page, 'Terminal')).toHaveAttribute('aria-selected', 'true');
  await tab(page, 'Conversation').click();
  await expect(page.getByText('Refresh the token before it expires, not after')).toBeVisible();
  // In Conversation the screen is not watched, and the agent is followed from the page's end.
  await expect.poll(() => machine.of('watch').at(-1)?.agent ?? null).toBe(null);
  await expect.poll(() => machine.of('follow').at(-1)).toEqual({ type: 'follow', agent: CLAUDE, after: 'c-11' });
  await expect(page.getByLabel("The agent's screen")).toHaveCount(0);
  await page.reload();
  await reopen(page, 'claude · fix login');
  await expect(page.getByText('Refresh the token before it expires, not after')).toBeVisible();
  await tab(page, 'Terminal').click();
  await expect(page.getByLabel("The agent's screen")).toBeVisible();
  await expect.poll(() => machine.of('follow').at(-1)).toEqual({ type: 'follow', agent: null });
  await machine.close();
});

test('M12.2 D12.2: the steps between two messages fold into one line and open in place, each done, failed or running', async ({ page, context }) => {
  const machine = await opened(page, context, 'codex · health endpoint');
  await tab(page, 'Conversation').click();
  const folded = page.getByRole('button', { name: /^▸ 3 tool steps · Ran cargo test health, Edited src\/health.rs, Ran cargo test/ });
  await expect(folded).toBeVisible();
  await folded.click();
  const steps = page.locator('.convo-step');
  await expect(steps).toHaveCount(3);
  await expect(steps.nth(0)).toHaveAttribute('data-state', 'failed');
  await expect(steps.nth(0)).toContainText('✗');
  await expect(steps.nth(1)).toHaveAttribute('data-state', 'done');
  await expect(steps.nth(2)).toContainText('running');
  // The running step settles when its outcome comes.
  machine.grow(CODEX, [{ id: '3.0.o', kind: 'outcome', at: at(10, 53), call: '3.0', failed: false }]);
  await expect(steps.nth(2)).toHaveAttribute('data-state', 'done');
  await page.getByRole('button', { name: '▾ 3 tool steps' }).click();
  await expect(steps).toHaveCount(0);
  await machine.close();
});

test('M12.4: while the agent waits, one amber line, and answer in Terminal switches the view; no answer strip in Conversation', async ({ page, context }) => {
  const machine = await opened(page, context);
  await tab(page, 'Conversation').click();
  await expect(page.getByText('claude is waiting for you —')).toBeVisible();
  await expect(page.getByRole('toolbar', { name: 'Answer' })).toHaveCount(0);
  await page.getByRole('button', { name: 'answer in Terminal ›' }).click();
  await expect(tab(page, 'Terminal')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByLabel("The agent's screen")).toBeVisible();
  if (!wideOf(page)) await expect(page.getByRole('toolbar', { name: 'Answer' })).toBeVisible();
  await machine.close();
});

test('what the file adds comes while it is shown, a long message whole, and a replaced file is read again', async ({ page, context }) => {
  const machine = await opened(page, context);
  await tab(page, 'Conversation').click();
  await expect.poll(() => machine.of('follow').at(-1)?.agent).toBe(CLAUDE);
  machine.grow(CLAUDE, [{ id: '7.0', kind: 'person', at: at(11, 26), text: 'Retry once, then sign out' }]);
  await expect(page.getByText('Retry once, then sign out')).toBeVisible();
  const long = `${'word '.repeat(15_000)}end`;
  machine.grow(CLAUDE, [{ id: '8.0', kind: 'agent', at: at(11, 27), text: long }]);
  await expect(page.locator('.convo-text').last()).toHaveText(long);
  machine.resetConversation(CLAUDE, [{ id: '0.0', kind: 'person', at: at(12, 0), text: 'A new session' }]);
  await expect(page.getByText('A new session')).toBeVisible();
  await expect(page.getByText('Retry once, then sign out')).toHaveCount(0);
  await machine.close();
});

test('older pages come as the person scrolls up', async ({ page, context }) => {
  const machine = await FakeMachine.start();
  const s = atlas();
  const many: Item[] = Array.from({ length: 120 }, (_, n) => ({ id: `${n}.0`, kind: n % 2 ? 'agent' : 'person', at: at(9, n % 60), text: `message ${n}` }));
  Object.assign(machine, s, { conversations: { ...s.conversations, [CLAUDE]: many } });
  await signIn(context, person('octo', [{ name: 'studio', address: machine.address }]));
  await page.goto('/');
  await openAgent(page, 'claude · fix login');
  await tab(page, 'Conversation').click();
  await expect(page.getByText('message 119')).toBeVisible();
  await expect(page.getByText('message 69', { exact: true })).toHaveCount(0);
  for (let i = 0; i < 6 && (await page.getByText('message 0', { exact: true }).count()) === 0; i++) {
    await page.locator('.convo-scroll').evaluate((el) => (el.scrollTop = 0));
    await page.waitForTimeout(300);
  }
  await expect(page.getByText('message 0', { exact: true })).toBeAttached();
  expect(machine.of('read').filter((r) => r.what === 'conversation' && typeof r.before === 'string').length).toBeGreaterThan(0);
  await machine.close();
});

test("a harness that cannot be read shows one line, and nothing of a conversation is kept in the browser", async ({ page, context }) => {
  const machine = await opened(page, context);
  await tab(page, 'Conversation').click();
  await expect(page.getByText('Refresh the token before it expires, not after')).toBeVisible();
  const kept = await page.evaluate(async () => {
    const local = JSON.stringify({ ...localStorage });
    const dbs = await indexedDB.databases();
    const all: string[] = [];
    for (const d of dbs) {
      const db = await new Promise<IDBDatabase>((done) => {
        const r = indexedDB.open(d.name!);
        r.onsuccess = () => done(r.result);
      });
      for (const store of db.objectStoreNames) {
        const rows = await new Promise<unknown[]>((done) => {
          const r = db.transaction(store).objectStore(store).getAll();
          r.onsuccess = () => done(r.result);
        });
        all.push(JSON.stringify(rows));
      }
    }
    return local + all.join('');
  });
  expect(kept).not.toContain('Refresh the token');
  expect(kept).not.toContain('src/login.rs');
  // docs' claude has no conversation the machine can read.
  delete machine.conversations[CLAUDE];
  await page.reload();
  await reopen(page, 'claude · fix login');
  await expect(page.getByText("claude's conversation cannot be shown here — Terminal shows everything.")).toBeVisible();
  await machine.close();
});

test('D12.1 in two panes: each pane in Conversation is followed, and one leaving it leaves the other followed', async ({ page, context, isMobile }) => {
  test.skip(isMobile, 'a desktop');
  const machine = await opened(page, context, 'codex · health endpoint');
  const bar = (where: Page | ReturnType<Page['locator']>) => where.getByRole('navigation', { name: 'Tabs' });
  await bar(page).getByRole('button', { name: 'weft · claude ●', exact: true }).click();
  await page.getByRole('button', { name: 'Layout', exact: true }).first().click();
  await page.getByRole('menuitem', { name: 'Split right', exact: true }).click();
  const [left, right] = [page.locator('.pane-box').first(), page.getByRole('region', { name: 'weft · claude', exact: true })];
  await tab(page, 'Conversation').click();
  await expect(right.getByText('Refresh the token before it expires, not after')).toBeVisible();
  // The left pane shows codex in weft, whose turn ended on health endpoint.
  const codexTabs = bar(left).getByRole('button', { name: 'weft · codex', exact: true });
  for (let i = 0; i < 2 && (await left.getByText('Add a health endpoint').count()) === 0; i++) await codexTabs.nth(i).click();
  await expect(left.getByText('Add a health endpoint')).toBeVisible();
  const followed = () => {
    const f = machine.of('follow').at(-1) ?? {};
    const also = Array.isArray(f.also) ? (f.also as { agent: string }[]).map((a) => a.agent) : [];
    return [f.agent, ...also].sort();
  };
  await expect.poll(followed).toEqual([CLAUDE, CODEX].sort());
  machine.grow(CLAUDE, [{ id: '7.0', kind: 'agent', at: at(11, 26), text: 'right grew' }]);
  machine.grow(CODEX, [{ id: '5.0', kind: 'agent', at: at(10, 53), text: 'left grew' }]);
  await expect(right.getByText('right grew')).toBeVisible();
  await expect(left.getByText('left grew')).toBeVisible();
  // The left pane shows another agent: claude on the right is still followed.
  await codexTabs.nth((await codexTabs.nth(0).getAttribute('data-shown')) === 'true' ? 1 : 0).click();
  await expect.poll(followed).not.toContain(CODEX);
  machine.grow(CLAUDE, [{ id: '8.0', kind: 'agent', at: at(11, 27), text: 'still followed' }]);
  await expect(right.getByText('still followed')).toBeVisible();
  await machine.close();
});
