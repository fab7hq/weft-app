// Remote that survives (cards 13.1–13.6): the page
// comes back by itself, says what it waits for, and says what to do when a
// refusal needs the person. Each on a phone and a desktop.
import { expect, test } from '@playwright/test';
import { FakeMachine, agent, project, sessionOf } from './fake-machine';
import { person, signIn } from './seed';

/** HH:MM in this machine's time, as the page shows one from today. */
const hhmm = (at: number) => {
  const d = new Date(at);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

async function opened(page: import('@playwright/test').Page, context: import('@playwright/test').BrowserContext, machine: FakeMachine, seenAt?: number) {
  await signIn(context, person('octo', [{ name: 'studio', address: machine.address, seenAt }]));
  await page.goto('/');
}

test('M13.1 D13.1: a machine that does not answer is waited for, with when it was last heard; back online, it reconnects with no tap', async ({ page, context }) => {
  const machine = await FakeMachine.start();
  machine.agents = [agent(0, 'weft', 'claude-code', 'working')];
  const seen = Date.now() - 60 * 60_000;
  await opened(page, context, machine, seen);
  await expect(page.getByRole('treeitem', { name: 'weft', exact: true }).first()).toBeVisible();

  // The machine goes; tries back off past the next few seconds.
  machine.down = true;
  machine.drop();
  await expect(page.getByText('Reconnecting')).toBeVisible();
  const strip = page.getByRole('status', { name: 'Waiting for the machine' });
  await expect(strip).toContainText('Waiting for studio to answer.', { timeout: 15_000 });
  await expect(strip).toContainText(`Last heard from it at ${hhmm(seen)}.`);
  // The last tree stays in view while it waits.
  await expect(page.getByRole('treeitem', { name: 'weft', exact: true }).first()).toBeVisible();

  // This device loses its network and gets it back: it reconnects at once,
  // not at the next try.
  await context.setOffline(true);
  machine.down = false;
  const before = machine.upgrades;
  await context.setOffline(false);
  await expect.poll(() => machine.upgrades, { timeout: 3_000 }).toBeGreaterThan(before);
  await expect(page.getByText('Reconnecting')).toHaveCount(0, { timeout: 5_000 });
  await expect(strip).toHaveCount(0);
  await machine.close();
});

test('a socket that does not open in 10 s is closed and tried again', async ({ page, context }) => {
  const machine = await FakeMachine.start();
  machine.agents = [agent(0, 'weft', 'claude-code', 'working')];
  machine.hang = true;
  await opened(page, context, machine);
  await expect.poll(() => machine.upgrades).toBe(1);
  // It hangs: after 10 s the page lets it go and tries again. (WebKit holds a
  // second socket to the same host until the first fails, as a dead link's
  // does in the end: `release`.)
  await page.waitForTimeout(9_000);
  expect(machine.upgrades).toBe(1);
  await page.waitForTimeout(3_000);
  machine.release();
  await expect.poll(() => machine.upgrades, { timeout: 6_000 }).toBeGreaterThan(1);
  await expect(page.getByRole('treeitem', { name: 'weft', exact: true }).first()).toBeVisible({ timeout: 10_000 });
  await machine.close();
});

test('M13.2 D13.2: an older Weft on the machine says to update it, and Try again connects once it is', async ({ page, context }) => {
  const machine = await FakeMachine.start();
  machine.agents = [agent(0, 'weft', 'claude-code', 'working')];
  machine.version = FakeMachine.VERSION - 1;
  await opened(page, context, machine);
  await expect(page.getByRole('heading', { name: 'Update Weft on studio' })).toBeVisible();
  await expect(page.getByText('studio runs an older Weft than this page. On studio, run weft update, then try again.')).toBeVisible();
  // It needs the person: no try by itself.
  const asked = machine.of('pair').length + machine.of('hello').length;
  await page.waitForTimeout(3_000);
  expect(machine.of('pair').length + machine.of('hello').length).toBe(asked);
  machine.version = FakeMachine.VERSION;
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.getByRole('treeitem', { name: 'weft', exact: true }).first()).toBeVisible();
  await machine.close();
});

test('M13.3 D13.3: a newer Weft on the machine says to reload this page', async ({ page, context }) => {
  const machine = await FakeMachine.start();
  machine.version = FakeMachine.VERSION + 1;
  await opened(page, context, machine);
  await expect(page.getByRole('heading', { name: 'Reload this page' })).toBeVisible();
  await expect(page.getByText('Weft on studio is newer than this page.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reload', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Your machines', exact: true })).toBeVisible();
  await machine.close();
});

test('M13.4 D13.4: a machine signed out of Weft says to sign it in again there', async ({ page, context }) => {
  const machine = await FakeMachine.start();
  machine.agents = [agent(0, 'weft', 'claude-code', 'working')];
  machine.signedOut = true;
  await opened(page, context, machine);
  await expect(page.getByRole('heading', { name: 'Sign in again on studio' })).toBeVisible();
  await expect(page.getByText('studio is not signed in to Weft. On studio, press W, then R, and enter the code it shows at github.com/login/device.')).toBeVisible();
  machine.signedOut = false;
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.getByRole('treeitem', { name: 'weft', exact: true }).first()).toBeVisible();
  await machine.close();
});

test('M13.5 D13.5: a project reopened after a restart says so, its agents ended; Dismiss closes it', async ({ page, context }, info) => {
  const machine = await FakeMachine.start();
  const ended = { ...agent(0, 'weft', 'claude-code', 'ended'), running: false };
  const reopened = Date.UTC(2026, 9, 11, 7, 58);
  machine.tree = [project('weft', [sessionOf(ended, 'fix login')], {}, { reopened }), project('docs', [sessionOf(agent(1, 'docs', 'codex', 'working'))])];
  await opened(page, context, machine);
  const row = page.getByRole('treeitem', { name: 'weft', exact: true }).first();
  await expect(row).toContainText('reopened');
  const notice = page.getByRole('note');
  await expect(notice).toContainText('Weft started again on studio at 07:58, and these agents ended. Resume one, or dismiss this project.');
  await expect(page.getByRole('treeitem', { name: 'claude-code · fix login', exact: true })).toContainText('ended');
  if (info.project.name.startsWith('desktop')) {
    // D13.5: the ended session says it ended when Weft stopped, and offers Resume.
    const last = Date.UTC(2026, 9, 11, 7, 41);
    machine.reads.sessions[`s-${ended.agent}`] = { session: `s-${ended.agent}`, harness: 'claude-code', state: 'ended', turn: null, started: last - 3_600_000, last, resume: true, asks: [], agent: null };
    await page.getByRole('treeitem', { name: 'claude-code · fix login', exact: true }).click();
    await expect(page.getByText('This session ended at 07:41, when Weft stopped on studio.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Resume', exact: true })).toBeVisible();
  }
  await notice.getByRole('button', { name: 'Dismiss', exact: true }).click();
  await expect.poll(() => machine.of('act').filter((m) => m.act === 'dismiss')).toEqual([expect.objectContaining({ act: 'dismiss', project: 'weft' })]);
  await expect(page.getByRole('treeitem', { name: 'weft', exact: true })).toHaveCount(0);
  await expect(page.getByRole('treeitem', { name: 'docs', exact: true }).first()).toBeVisible();
  await machine.close();
});

test('M13.6 D13.6: an update waiting on the machine is said, with how many agents still run', async ({ page, context }) => {
  const machine = await FakeMachine.start();
  machine.agents = [agent(0, 'weft', 'claude-code', 'working'), agent(1, 'weft', 'codex', 'ready')];
  machine.update = '0.2.1';
  await opened(page, context, machine);
  const strip = page.getByRole('status', { name: 'An update waiting' });
  await expect(strip).toContainText('Weft 0.2.1 is waiting on studio.');
  await expect(strip).toContainText('It starts when no agent is running there: 2 are running.');
  machine.setUpdate(null);
  await expect(strip).toHaveCount(0);
  await machine.close();
});
