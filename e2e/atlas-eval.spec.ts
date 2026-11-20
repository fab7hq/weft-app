// The Eval view (M6.1–M6.7, D6.1–D6.7): one line per item, what to look at
// first, then what is settled, read by its Eval from the Eval's Details
// (M11.3). Each item opens to its detail and the lines that show it; while the
// Eval runs, its ring of reads, and the list fills in as reads come back.
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { FakeMachine, atlas } from './fake-machine';
import { person, signIn } from './seed';
import { ITEMS, RUNNING, STILL, VIEW, item } from './atlas-fixtures';

async function opened(page: Page, context: BrowserContext, views: Record<string, unknown>[] = [VIEW]) {
  const machine = await FakeMachine.start();
  Object.assign(machine, atlas());
  let reads = 0;
  machine.onRead = (m) => (m.what === 'eval_view' ? { type: 'ok', req: m.req, eval_view: views[Math.min(reads++, views.length - 1)] } : machine.read(m));
  await signIn(context, person('octo', [{ name: 'studio', address: machine.address }]));
  await page.goto('/');
  // The Eval's Details (M11.3), from its unit's Ask, then its Eval view.
  const unit = page.getByRole('treeitem', { name: 'health endpoint', exact: true });
  if (page.viewportSize()!.width >= 768) await unit.click();
  else await unit.getByRole('button', { name: 'Details of health endpoint' }).click();
  await page.locator('.workflow').getByRole('button', { name: 'health endpoint', exact: true }).click();
  await page.locator('.crumbs').first().getByRole('button', { name: /^Eval 3/ }).click();
  await page.getByRole('button', { name: 'Eval view', exact: true }).click();
  const view = page.getByRole('region', { name: 'Eval view' });
  await expect(view.locator('.ev-row').first()).toBeVisible();
  return { machine, view };
}

const lines = (view: ReturnType<Page['getByRole']>) => view.locator('.ev-row .ev-text');

test('M6.1 D6.1: what to look at, then what is settled; each kind by its own mark, coloured on its mark and dots only', async ({ page, context }) => {
  const { view } = await opened(page, context);
  await expect(view.locator('.ev-sec')).toHaveText(['To look at', 'Settled']);
  await expect(lines(view)).toHaveText(['Asked before · remembers the last email', 'Sessions end after 1 hour, not 24', 'Staying signed in is not in the change',
    'The typed email goes into the server log', '“Show an error” — the reads differ', 'Sign-in button off while it sends', '11 other changes your Ask explains']);
  await expect(view.locator('.ev-row .ev-mark')).toHaveText(['↺', '■', '■', '■', '◆', '●', '●']);
  const colour = (n: number, what: string) => view.locator('.ev-row').nth(n).locator(what).first().evaluate((e) => getComputedStyle(e).color);
  const token = (name: string) => page.evaluate((n) => {
    const probe = document.createElement('i');
    probe.style.color = `var(--fab7-${n})`;
    document.body.append(probe);
    const c = getComputedStyle(probe).color;
    probe.remove();
    return c;
  }, name);
  expect(await colour(0, '.ev-mark')).toBe(await token('teal'));
  expect(await colour(1, '.ev-mark')).toBe(await token('amber'));
  expect(await colour(4, '.ev-mark')).toBe(await token('accent'));
  expect(await colour(5, '.ev-mark')).toBe(await token('muted'));
  // Colour never covers the line's words.
  expect(await colour(1, '.ev-text')).not.toBe(await token('amber'));
  // The dots: filled where a read agrees, none on the question from an earlier Seal.
  await expect(view.locator('.ev-row').nth(1).locator('.ev-dot.on')).toHaveCount(2);
  await expect(view.locator('.ev-row').nth(4).locator('.ev-dot')).toHaveCount(3);
  await expect(view.locator('.ev-row').nth(4).locator('.ev-dot.on')).toHaveCount(0);
  await expect(view.locator('.ev-row').nth(0).locator('.ev-dot')).toHaveCount(0);
  await expect(view).not.toContainText(/aligned|verdict|By file|%/);
});

test('D6.1 D6.4: on a desktop the first item is chosen, and choosing another shows its detail beside the list', async ({ page, context }, info) => {
  test.skip(info.project.name !== 'desktop', 'a desktop');
  const { view } = await opened(page, context);
  const on = view.locator('.ev-row--on');
  await expect(on).toHaveCount(1);
  await expect(on).toHaveAttribute('aria-current', 'true');
  await expect(on.locator('.ev-text')).toHaveText('Asked before · remembers the last email');
  // Chosen is obvious: the blue bar, the tint, bold words.
  const token = (name: string, prop: 'color' | 'backgroundColor') => page.evaluate(([n, p]) => {
    const probe = document.createElement('i');
    probe.style[p as 'color'] = `var(--fab7-${n})`;
    document.body.append(probe);
    const c = getComputedStyle(probe)[p as 'color'];
    probe.remove();
    return c;
  }, [name, prop]);
  const style = await on.evaluate((e) => {
    const s = getComputedStyle(e);
    return [s.borderLeftWidth, s.borderLeftStyle, s.borderLeftColor, s.backgroundColor, getComputedStyle(e.querySelector('.ev-text')!).fontWeight];
  });
  expect(style).toEqual(['3px', 'solid', await token('accent', 'color'), await token('selected', 'backgroundColor'), '600']);
  await expect(view.locator('.ev-head')).toHaveText('↺ Asked before · not sure at your Seal of 10 Nov');
  await expect(view.locator('.ev-big')).toHaveText('The sign-in page remembers the last email address typed on this device.');

  await view.getByRole('button', { name: 'The typed email goes into the server log' }).click();
  await expect(view.locator('.ev-row--on .ev-text')).toHaveText('The typed email goes into the server log');
  await expect(view.locator('.ev-head')).toHaveText('■ To look at · against your decision of 3 Nov');
  await expect(view.locator('.ev-sure')).toHaveText('read twice, both agree');
  await expect(view.locator('.ev-said')).toHaveText('The agent said: “Failed sign-ins are now logged with the email so we can spot attacks.”');
  await expect(view.getByRole('button', { name: 'The lines that show it ›' })).toBeVisible();
  await expect(view.getByRole('button', { name: 'What each read said ›' })).toBeVisible();
  await expect(page.locator('.detail-acts').getByRole('button', { name: 'Seal…' })).toBeVisible();
  await view.getByRole('button', { name: 'Close' }).click();
  await expect(view).toHaveCount(0);
});

test('M6.3 M6.4 M6.6: on a phone an item opens on its own page, k of n, and what each read said opens in place', async ({ page, context }, info) => {
  test.skip(info.project.name === 'desktop', 'a phone');
  const { view } = await opened(page, context);
  await expect(view.locator('.ev-row--on')).toHaveCount(0);
  await view.getByRole('button', { name: '“Show an error” — the reads differ' }).click();
  await expect(page.getByRole('button', { name: '‹ Items' })).toBeVisible();
  await expect(page.getByText('5 of 5')).toBeVisible();
  await expect(view.locator('.ev-head')).toHaveText('◆ Could not settle');
  await expect(view.locator('.ev-sure')).toHaveText('read three times, the reads differ');
  await view.getByRole('button', { name: 'What each read said ›' }).click();
  await expect(view.locator('.ev-read')).toHaveText([/^First read · Can’t tell/, /^Second read · /, /^Third read · /]);
  await page.getByRole('button', { name: '‹ Items' }).click();
  // The item last opened stays chosen in the list.
  await expect(view.locator('.ev-row--on .ev-text')).toHaveText('“Show an error” — the reads differ');
  await view.getByRole('button', { name: 'Sign-in button off while it sends' }).click();
  await expect(page.getByText('6 of 7')).toBeVisible();
});

test('M6.5 D6.5: an item\'s lines, numbered, the quoted ones brighter, and back to the item', async ({ page, context }) => {
  const { view } = await opened(page, context);
  await view.getByRole('button', { name: 'Sessions end after 1 hour, not 24' }).click();
  await view.getByRole('button', { name: 'The lines that show it ›' }).click();
  await expect(view.locator('.ev-head')).toHaveText('■ To look at · the lines that show it');
  await expect(view.getByText('src/auth/session.ts')).toBeVisible();
  await expect(view.locator('.ev-line')).toHaveCount(8);
  await expect(view.locator('.ev-line b')).toHaveText(['  maxAgeHours: 1,', '  rolling: false,']);
  await expect(view.getByText('The lines the reads quoted are brighter.')).toBeVisible();
  await page.getByRole('button', { name: '‹ Sessions end after 1 hour, not 24' }).click();
  await expect(view.locator('.ev-big')).toHaveText('Signed-in sessions end after 1 hour instead of 24.');
});

test('M6.7 D6.7 M17.6 D17.6: while it runs, a ring of reads, its steps, and the list as it fills in', async ({ page, context }) => {
  const { machine, view } = await opened(page, context, [RUNNING, STILL]);
  // Before the first read: the question from an earlier Seal, and the rest to come.
  await expect(view.locator('.ev-arc')).toHaveCount(3);
  await expect(view.locator('.ev-arc.ev-breathe')).toHaveCount(1);
  await expect(view.getByText('1st read')).toBeVisible();
  await expect(view.getByText('The rest appear here when the first read is in.')).toBeVisible();
  const steps = view.locator('.wait-step');
  await expect(steps.locator('.wait-step-words')).toHaveText(['What you asked', 'Reading the change, all of it at once', 'Reading again where unsure, if needed', 'Questions for your Seal, if needed']);
  expect(await steps.evaluateAll((all) => all.map((s) => s.getAttribute('data-state')))).toEqual(['done', 'now', 'next', 'next']);
  // Its readers' job: each step's time, and the reads counted on the one under way.
  machine.send({
    type: 'progress', project: 'weft',
    job: { id: 'job_r', kind: 'readers', on: { work: 'ask_3', eval: 'evl_3' }, age_ms: 277_000, steps: [
      { key: 'step.a', state: 'done', ms: 6_000 }, { key: 'step.b', state: 'now', ms: 271_000, done: 3, total: 7, unit: 'reads' },
      { key: 'step.c', state: 'next' }, { key: 'step.d', state: 'next' },
    ] },
  });
  await expect(steps.nth(1).locator('.wait-step-count')).toHaveText('3 of 7 read');
  await expect(steps.nth(0).locator('.wait-step-time')).toHaveText('0:06');
  await expect(steps.nth(1).locator('.wait-step-time')).toHaveText(/^4:3\d$/);
  await expect(steps.nth(2).locator('.wait-step-time')).toHaveCount(0);
  // Its reader, and how long it has read.
  machine.send({ type: 'agents', agents: [...machine.agents, { agent: 'p9', project: 'weft', harness: 'claude', title: '', turn: 'working', running: true, since: Date.now() - 252_000, judge: 'evl_3' }] });
  await expect(view.locator('.ev-watch')).toHaveText(/^claude is reading · 4:1\d · Watch ›$/);
  await expect(page.getByRole('button', { name: 'Stop Eval' })).toBeVisible();
  // The first read in: the list fills in, two are read again.
  await expect(view.getByText('2nd read')).toBeVisible({ timeout: 5000 });
  expect(await view.locator('.ev-arc').evaluateAll((a) => a.map((x) => [x.getAttribute('data-light'), x.getAttribute('stroke')]))).toEqual([
    ['done', 'var(--fab7-accent)'], ['now', 'var(--fab7-accent)'], ['next', 'var(--fab7-line)'],
  ]);
  await expect(view.locator('.ev-again')).toHaveCount(2);
  await expect(view.locator('.ev-row', { hasText: 'Sessions end after 1 hour' }).locator('.ev-again')).toHaveText('reading again');
  await expect(view.getByText('npm test is running')).toBeVisible();
  await expect(view.getByText('The rest appear here when the first read is in.')).toHaveCount(0);
});

test('a change with more than the screen holds scrolls to its end: its detail, its lines, and the list', async ({ page, context }) => {
  const why = Array.from({ length: 60 }, (_, n) => `Reason ${n} it is here.`);
  const items = [...ITEMS.map((it) => (it.key === 'w|w_sess' ? { ...it, why } : it)),
    ...Array.from({ length: 40 }, (_, n) => item(`r|more/${n}`, 'settled', `Settled change ${n}`))];
  const lines = Array.from({ length: 200 }, (_, n) => ({ n: n + 1, text: `line ${n + 1}`, lit: false }));
  const view = { ...VIEW, items, lines: { ...VIEW.lines, w_sess: { path: 'src/auth/session.ts', lines } } };
  const { view: shown } = await opened(page, context, [view]);
  // What overflows is in a box the person can scroll, the page or one that scrolls, never one that cuts it off.
  const reaches = async (last: ReturnType<Page['locator']>) => {
    const box = await last.evaluate((e) => {
      for (let at = e.parentElement; at; at = at.parentElement) {
        if (at.scrollHeight <= at.clientHeight + 1) continue;
        if (at === document.scrollingElement || at === document.body) return 'the page';
        const y = getComputedStyle(at).overflowY;
        return y === 'auto' || y === 'scroll' ? 'a scroll' : `cut off by .${at.className}`;
      }
      return 'the page';
    });
    expect(box).not.toMatch(/^cut off/);
    await last.scrollIntoViewIfNeeded();
    await expect(last).toBeInViewport();
  };
  await reaches(shown.locator('.ev-row').last());
  await shown.getByRole('button', { name: 'Sessions end after 1 hour, not 24' }).click();
  await reaches(shown.getByText('Reason 59 it is here.'));
  await shown.getByRole('button', { name: 'The lines that show it ›' }).click();
  await reaches(shown.locator('.ev-line').last());
});
