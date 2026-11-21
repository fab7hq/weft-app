// Every wait says so, and shows its progress (17.25, 17.26, 11.14, 11.15,
// 17.3, 17.27): a work whose Eval opens says so on its row, on every device,
// from the machine's jobs; the Eval dialog says what it reads, and a large
// change in amber; an Eval opening and a Seal show their steps, the count
// under way and a filled bar; a Seal's receipt check counts its files; a
// Details page that could not be read says why where it would be, and Try
// again reads it again.
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { FakeMachine, atlas } from './fake-machine';
import { row, wideOf } from './open';
import { person, signIn } from './seed';

async function opened(page: Page, context: BrowserContext) {
  const machine = await FakeMachine.start();
  Object.assign(machine, atlas());
  await signIn(context, person('octo', [{ name: 'studio', address: machine.address }]));
  await page.goto('/');
  // The machine has welcomed it: what is opening is said after that.
  await expect(row(page, 'health endpoint')).toBeVisible();
  return machine;
}

const work = (page: Page) => row(page, 'health endpoint');

/** An Eval opening on health endpoint, as the machine says it moves. */
const opening = (more: Record<string, unknown> = {}) => ({
  id: 'job_1', kind: 'eval_open', on: { work: 'ask_3' }, age_ms: 600,
  steps: [{ key: 'step.reading_change', state: 'now', ms: 600 }, { key: 'step.dividing', state: 'next' }],
  ...more,
});

test('17.25: a work whose Eval opens says so on its row; a refusal is said in amber until the person acts', async ({ page, context }) => {
  const machine = await opened(page, context);
  machine.send({ type: 'progress', project: 'weft', job: opening() });
  await expect(work(page).locator('.work-status')).toHaveText('opening Eval…');
  machine.send({ type: 'progress', project: 'weft', job: opening({ end: { ok: false, why: 'the change could not be read (git exited 128).' } }) });
  await expect(work(page).locator('.work-status')).not.toHaveText('opening Eval…');
  const said = page.locator('.tree-bar .tree-said');
  await expect(said).toHaveText('RingFrame could not open the Eval: the change could not be read (git exited 128).');
  // It stays: no time takes it away.
  await page.waitForTimeout(6500);
  await expect(said).toBeVisible();
  // The person acts: it has been read.
  await page.locator('.tree-acts').getByRole('button', { name: 'Eval', exact: true }).click();
  await expect(page.getByText('RingFrame could not open the Eval', { exact: false })).toHaveCount(0);
  await machine.close();
});

test('after a welcome, the jobs the machine says again restore what is running', async ({ page, context }) => {
  const machine = await opened(page, context);
  machine.send({ type: 'jobs', project: 'weft', jobs: [opening({ age_ms: 40_000 })] });
  await expect(work(page).locator('.work-status')).toHaveText('opening Eval…');
  machine.send({ type: 'jobs', project: 'weft', jobs: [] });
  await expect(work(page).locator('.work-status')).not.toHaveText('opening Eval…');
  await machine.close();
});

/** health endpoint's Eval dialog, with what it reads: 52 commits, most of them data in one folder. */
const LARGE = {
  since: 'ask', when: '2026-11-08T10:00:00Z', commits: 52, files: 13852, skipped: { generated: 2, vendored: 0, binary: 1, lock: 0 },
  folder: 'research/papers/to-err-is-agentic/evidence/', folder_files: 13708, large: true,
};
const evalDialog = (machine: FakeMachine, reads: Record<string, unknown>) => {
  machine.onAct = (m) => [
    { type: 'pending', id: 'pnd_e1', agent: '', what: 'Eval this work?', why: 'health endpoint · 2 Asks\ncodex reads the whole change against what you asked, and reads again only where it is unsure.\nNothing is typed into the agent’s pane.', text: '', sends: null, go: { word: 'act.eval', warn: false }, reads },
    { type: 'ok', req: m.req, pending: 'pnd_e1' },
  ];
};

test('17.3 17.27 17.25: the Eval dialog says what it reads, and a large change in amber; its yes shows the opening\'s steps, its count and a filled bar', async ({ page, context }) => {
  const machine = await opened(page, context);
  evalDialog(machine, LARGE);
  // The yes is answered when the test says.
  let req: unknown = null;
  machine.onResolve = (m) => ((req = m.yes ? m.req : req), []);
  await work(page).click();
  await page.locator('.tree-acts').getByRole('button', { name: 'Eval', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Eval this work?' });
  await expect(dialog.locator('.pending-reads')).toHaveText(/^Reads52 commits · 13,852 files since its first Ask, Nov 83 counted, not read: 2 generated, 1 binary$/);
  const note = dialog.getByRole('note');
  await expect(note.locator('.pending-large-title')).toHaveText('This is a large change for one work.');
  await expect(note).toContainText('It holds everything committed here since Nov 8. Most of it is in research/papers/to-err-is-agentic/evidence/ (13,708 files).');
  await expect(note).toContainText('mark data in .gitattributes as generated');
  await dialog.getByRole('button', { name: 'Eval anyway', exact: true }).click();
  const bar = page.getByRole('dialog', { name: 'Opening the Eval…' });
  await expect(bar).toContainText('health endpoint · 2 Asks · read by Codex');
  await expect.poll(() => req).not.toBeNull();
  machine.send({
    type: 'progress', project: 'weft', req,
    job: {
      id: 'job_5', kind: 'eval_open', on: { work: 'ask_3' }, age_ms: 18_000, share: 0.37,
      steps: [
        { key: 'step.reading_change', state: 'now', ms: 18_000, done: 38, total: 103, unit: 'files', args: { new: '9' } },
        { key: 'step.dividing', state: 'next' },
        { key: 'step.preparing_readers', state: 'next' },
        { key: 'step.starting_readers', state: 'next', args: { harness: 'Codex' } },
        { key: 'step.waiting_ready', state: 'next', args: { agent: 'Codex' } },
      ],
    },
  });
  await expect(bar.locator('.wait-step-words')).toHaveText(['Reading the change', 'Dividing it among the readers', 'Preparing what each reader is asked', 'Starting Codex to read it', 'Waiting for Codex to be ready']);
  await expect(bar.locator('.wait-step-count')).toHaveText('38 of 103 files · 9 of them new');
  await expect(bar.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '37');
  // The readers' step is done: the next is under way, the bar fills on.
  machine.send({
    type: 'progress', project: 'weft',
    job: {
      id: 'job_5', kind: 'eval_open', on: { work: 'ask_3' }, age_ms: 21_000, share: 0.8,
      steps: [
        { key: 'step.reading_change', state: 'done', ms: 19_000 },
        { key: 'step.dividing', state: 'done', ms: 1_000 },
        { key: 'step.preparing_readers', state: 'now', ms: 1_000 },
        { key: 'step.starting_readers', state: 'next', args: { harness: 'Codex' } },
        { key: 'step.waiting_ready', state: 'next', args: { agent: 'Codex' } },
      ],
    },
  });
  await expect(bar.locator('.wait-step').first().locator('.wait-step-time')).toHaveText('0:19');
  await expect(bar.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '80');
  machine.send({ type: 'ok', req });
  await expect(bar).toHaveCount(0);
  await machine.close();
});

test('17.3: an Eval of a small change says what it reads, and Eval runs it', async ({ page, context }) => {
  const machine = await opened(page, context);
  evalDialog(machine, { since: 'seal', when: '2025-12-12T10:00:00Z', commits: 1, files: 1, skipped: {}, large: false });
  await work(page).click();
  await page.locator('.tree-acts').getByRole('button', { name: 'Eval', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Eval this work?' });
  await expect(dialog.locator('.pending-reads')).toHaveText('Reads1 commit · 1 file since its last Seal, Dec 12 2025');
  await expect(dialog.getByRole('note')).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: 'Eval', exact: true })).toBeVisible();
  await machine.close();
});

test('17.26: a Seal says Sealing… in the bar\'s place, and on its row, until the machine answers', async ({ page, context }) => {
  const machine = await opened(page, context);
  // The machine takes its time: the act is answered when the test says.
  let req: unknown = null;
  machine.onAct = (m) => ((req = m.req), []);
  await work(page).click();
  await page.locator('.tree-acts').getByRole('button', { name: 'Seal', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Seal this work?' });
  await dialog.getByRole('button', { name: 'Seal', exact: true }).click();
  const bar = page.getByRole('dialog', { name: 'Sealing…' });
  await expect(bar).toContainText('health endpoint · accepted');
  if (!wideOf(page)) await expect(work(page).locator('.work-status')).toHaveText('sealing…');
  await expect.poll(() => req).not.toBeNull();
  // Its job: the steps, the files read as they are now, and the bar filled by how much is done.
  machine.send({
    type: 'progress', project: 'weft', req,
    job: {
      id: 'job_7', kind: 'seal', on: { work: 'ask_3' }, age_ms: 9_000, share: 0.4,
      steps: [
        { key: 'step.checking_work', state: 'done', ms: 2_000 },
        { key: 'step.reading_files_now', state: 'now', ms: 7_000, done: 8412, total: 15902, unit: 'files' },
        { key: 'step.writing_decision', state: 'next' },
        { key: 'step.noting_git', state: 'next' },
      ],
    },
  });
  await expect(bar.locator('.wait-step-words')).toHaveText(['Checking the work and its Eval', 'Reading every file as it is now', 'Writing your decision', 'Noting it in Git']);
  await expect(bar.locator('.wait-step-count')).toHaveText('8,412 of 15,902 files');
  await expect(bar.locator('.wait-step').first().locator('.wait-step-time')).toHaveText('0:02');
  await expect(bar.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '40');
  await expect(bar.locator('.wait-time')).toHaveText(/^0:(09|1\d)$/);
  machine.send({ type: 'ok', req });
  await expect(bar).toHaveCount(0);
  await machine.close();
});

test('11.14: a Seal\'s facts come at once; its receipt, while it is checked, counts the files read and fills its bar', async ({ page, context }) => {
  const machine = await opened(page, context);
  // RingFrame's check of the receipt is answered when the test says: never, here.
  machine.onRead = (m) => (m.what === 'receipt' ? { type: 'noop' } : null);
  const unit = row(page, 'readme fix');
  if (wideOf(page)) await unit.click();
  else await unit.getByRole('button', { name: 'Details of readme fix' }).click();
  await page.locator('.workflow').getByRole('button', { name: 'Seal 4', exact: true }).click();
  const view = page.getByRole('region', { name: 'Seal 4' });
  await expect(view).toBeVisible();
  await expect(view.getByText('The Asks it covered', { exact: false })).toBeVisible();
  await expect(view.getByRole('button', { name: 'readme fix', exact: true })).toBeVisible();
  expect(machine.of('read').filter((r) => r.what === 'receipt').at(-1)).toMatchObject({ project: 'weft', seal: 'rcp_7f3a2c' });
  const fact = view.locator('.wait-fact');
  await expect(fact).toContainText('Checking it against the record…');
  await expect(fact.locator('.wait-fact-count')).toHaveCount(0);
  machine.send({
    type: 'progress', project: 'weft',
    job: { id: 'job_8', kind: 'seal_check', on: { seal: 'rcp_7f3a2c' }, age_ms: 3_000, share: 0.53, steps: [{ key: 'step.reading_files_now', state: 'now', ms: 3_000, done: 8412, total: 15902, unit: 'files' }] },
  });
  await expect(fact.locator('.wait-fact-count')).toHaveText('8,412 of 15,902 files');
  await expect(fact.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '53');
  await machine.close();
});

test('11.15: a receipt that could not be checked says RingFrame\'s reason in its place, under the facts; Try again checks it again', async ({ page, context }) => {
  const machine = await opened(page, context);
  const why = "RingFrame could not read the Seal's record (seals/seal_01M7….json is missing)";
  machine.onRead = (m) => (m.what === 'receipt' ? { type: 'error', req: m.req, code: 'refused', message: why } : null);
  const unit = row(page, 'readme fix');
  if (wideOf(page)) await unit.click();
  else await unit.getByRole('button', { name: 'Details of readme fix' }).click();
  await page.locator('.workflow').getByRole('button', { name: 'Seal 4', exact: true }).click();
  const view = page.getByRole('region', { name: 'Seal 4' });
  const failed = view.getByRole('alert').filter({ hasText: `The receipt could not be checked: ${why}` });
  await expect(failed).toBeVisible();
  await expect(view.getByRole('button', { name: 'readme fix', exact: true })).toBeVisible();
  await expect(view.getByText('The receipt still matches what RingFrame wrote.')).toHaveCount(0);
  const seals = machine.of('read').filter((r) => r.what === 'seal').length;
  machine.onRead = null;
  await failed.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(failed).toHaveCount(0);
  await expect(view.getByText('The receipt still matches what RingFrame wrote.')).toBeVisible();
  expect(machine.of('read').filter((r) => r.what === 'seal')).toHaveLength(seals);
  await machine.close();
});

test('11.15: a Details page that could not be read says why where it would be, and Try again reads it again', async ({ page, context }) => {
  const machine = await opened(page, context);
  machine.onRead = (m) => (m.what === 'work' ? { type: 'error', req: m.req, code: 'refused', message: 'RingFrame could not read the record' } : null);
  if (wideOf(page)) await work(page).click();
  else await work(page).getByRole('button', { name: 'Details of health endpoint' }).click();
  const failed = page.getByRole('alert').filter({ hasText: 'This could not be read: RingFrame could not read the record' });
  await expect(failed).toBeVisible();
  machine.onRead = null;
  await failed.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(failed).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'health endpoint' })).toBeVisible();
  await machine.close();
});
