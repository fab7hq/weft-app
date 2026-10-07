// A work's Details (M5.1–M5.10, D5.2–D5.7): the machine's sections, folded as
// the cards fold them; Proceed sends act proceed, Follow up opens M4.4, Eval
// view opens the view.
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { FakeMachine, atlas } from './fake-machine';
import { person, signIn } from './seed';
import { DETAILS, JUDGED, NOT_RUN, SEALED, SENT, detail, type Section } from './atlas-fixtures';

async function opened(page: Page, context: BrowserContext, unit: string, d = DETAILS[unit]) {
  const machine = await FakeMachine.start();
  Object.assign(machine, atlas());
  machine.onRead = (m) => ({ type: 'ok', req: m.req, detail: m.what === 'detail' && m.unit === unit ? d : null });
  await signIn(context, person('octo', [{ name: 'studio', address: machine.address }]));
  await page.goto('/');
  await page.getByRole('button', { name: `Details of ${d.title}` }).click();
  await expect(page.getByRole('region', { name: d.title })).toBeVisible();
  return { machine, view: page.getByRole('region', { name: d.title }) };
}

const heading = (page: Page, act: string) => page.getByRole('region', { name: act, exact: true }).getByRole('button').first();

test('M5.1: still being composed, the Ask alone, open; Follow up opens M4.4 for it', async ({ page, context }) => {
  const { view } = await opened(page, context, 'ask_2');
  await expect(view.locator('.chip')).toHaveText(['ASK ASKING', "EVAL HAVEN'T RUN", "SEAL HAVEN'T RUN"]);
  await expect(view.getByText('asked 2026-10-05 09:12 · asked, still being composed')).toBeVisible();
  await expect(heading(page, 'Ask')).toHaveAttribute('aria-expanded', 'true');
  await expect(heading(page, 'Ask')).toContainText('asking');
  await expect(view.locator('.detail-line').filter({ hasText: 'Count how often' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Eval', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Proceed' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Follow up' }).click();
  const sheet = page.getByRole('dialog', { name: 'What do you want done?' });
  await expect(sheet.getByText('FOLLOW UP · TELEMETRY · ASK_2')).toBeVisible();
});

test('M5.2 D5.2: waiting for your yes, Proceed sends act proceed on the work', async ({ page, context }) => {
  const { machine } = await opened(page, context, 'ask_1');
  await expect(page.getByText('The prompt claude composed:')).toBeVisible();
  const acted = new Promise<Record<string, unknown>>((done) => (machine.onAct = (m) => (done(m), [{ type: 'ok', req: m.req }])));
  await page.getByRole('button', { name: 'Proceed' }).click();
  expect(await acted).toMatchObject({ act: 'proceed', unit: 'ask_1' });
});

test('M5.4 D5.4: sent, every section folds, and a heading unfolds it', async ({ page, context }) => {
  await opened(page, context, 'ask_3');
  for (const [act, aside] of [['Ask', 'the prompt as typed'], ['Eval', "haven't run"], ['Seal', "haven't run"]]) {
    await expect(heading(page, act)).toHaveAttribute('aria-expanded', 'false');
    await expect(heading(page, act)).toContainText(aside);
  }
  await expect(page.getByText('The prompt codex sent:')).toHaveCount(0);
  await heading(page, 'Ask').click();
  await expect(page.getByText('The prompt codex sent:')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Eval view' })).toHaveCount(0);
});

test('M5.5: gathered, the Eval open says where its debate runs; Eval view opens the view', async ({ page, context }) => {
  const gathered: Section = { act: 'eval', state: 'GATHERED', aside: '', lines: ['gathered by Weft', '[E]VAL  debate in codex'], open: true };
  const d = detail('health endpoint', 'codex', 'asked 2026-10-04 14:02 · sent · word for word', [SENT, gathered, NOT_RUN('seal')], { eval_view: true, debate_in: 'codex' });
  await opened(page, context, 'ask_3', d);
  await expect(page.locator('.chip')).toHaveText(['ASK DONE', 'EVAL GATHERED', "SEAL HAVEN'T RUN"]);
  await expect(heading(page, 'Eval')).toContainText('gathered');
  await expect(page.getByText('Eval on the tree runs the debate in codex.')).toBeVisible();
  await expect(page.getByText('[E]VAL')).toHaveCount(0);
  await page.getByRole('button', { name: 'Eval view' }).click();
  await expect(page.getByRole('region', { name: 'Eval view' })).toBeVisible();
});

test('M5.6 D5.6: judged, the verdict first, the judges behind their count, the unexplained in one line', async ({ page, context }) => {
  const d = detail('health endpoint', 'codex', 'asked 2026-10-04 14:02 · sent · word for word · judged by codex', [SENT, JUDGED, NOT_RUN('seal')],
    { eval_view: true, recorded: 'drifted, 0.67', follows: 'evl_2' });
  await opened(page, context, 'ask_3', d);
  const wide = page.viewportSize()!.width >= 768;
  await expect(heading(page, 'Eval')).toContainText('0.67 agreed');
  const eval_ = page.getByRole('region', { name: 'Eval', exact: true });
  await expect(eval_.locator('.detail-line').first()).toHaveText("doesn't match what you asked");
  await expect(eval_.getByText('map · codex · gpt-5.6-terra')).toHaveCount(0);
  await eval_.getByRole('button', { name: /3 judges checked the work/ }).click();
  await expect(eval_.getByText('map · codex · gpt-5.6-terra')).toBeVisible();
  await expect(eval_.getByText('CHANGED WITH NO JUDGE ABLE TO TIE IT TO WHAT YOU ASKED: src/telemetry.rs')).toBeVisible();
  if (wide) {
    await expect(eval_.getByText('judged by codex · recorded as drifted, 0.67 · 3 judges checked the work · none of them did it')).toBeVisible();
    await expect(eval_.getByText('returns the real build number — no · all 3 judges agreed — it still reads a literal "dev" at src/health.rs:41')).toBeVisible();
  } else {
    await expect(eval_.getByText('no · all 3 judges agreed', { exact: true })).toBeVisible();
  }
  // Folded, the Eval says what it was recorded as.
  await heading(page, 'Eval').click();
  await expect(heading(page, 'Eval')).toContainText('drifted, 0.67');
  await page.getByRole('button', { name: 'Follow up' }).click();
  await expect(page.getByText('FOLLOW UP · HEALTH ENDPOINT · EVL_2')).toBeVisible();
});

test('M5.7 D5.7: sealed, the Seal open on its receipt', async ({ page, context }) => {
  const d = detail('readme fix', 'codex', 'asked 2026-10-03 11:20 · sent · word for word · judged by codex · sealed 2026-10-03 12:05',
    [SENT, { ...JUDGED, open: false, lines: [] }, SEALED], { eval_view: true, recorded: 'aligned, 1.0', holds: true });
  await opened(page, context, 'ask_4', d);
  await expect(page.locator('.chip')).toHaveText(['ASK DONE', 'EVAL DONE', 'SEAL DONE']);
  await expect(heading(page, 'Eval')).toContainText('aligned, 1.0');
  await expect(heading(page, 'Seal')).toContainText('accepted');
  await expect(page.getByText('The receipt still matches what RingFrame wrote.')).toBeVisible();
});

test('M5.8: the receipt no longer holds, and why', async ({ page, context }) => {
  const broken: Section = { ...SEALED, lines: ['RECEIPT       rcp_7f3a2c', 'THE RECEIPT NO LONGER HOLDS', 'the work has moved on since it was sealed'] };
  const d = detail('readme fix', 'codex', '… · sealed 2026-10-03 12:05', [SENT, { ...JUDGED, open: false }, broken], { eval_view: true, holds: false });
  await opened(page, context, 'ask_4', d);
  await expect(page.getByText('THE RECEIPT NO LONGER HOLDS')).toBeVisible();
  await expect(page.getByText('the work has moved on since it was sealed')).toBeVisible();
});

test('M5.9: cancelled, what was asked and nothing to proceed with', async ({ page, context }) => {
  const d = detail('fix login', 'claude', 'asked 2026-10-02 16:30 · cancelled',
    [{ act: 'ask', state: 'DONE', aside: '', lines: ['You asked:', 'Try a second login provider'], open: true }]);
  await opened(page, context, 'ask_1', d);
  await expect(page.getByText('asked 2026-10-02 16:30 · cancelled')).toBeVisible();
  await expect(page.getByText('Try a second login provider')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Proceed' })).toHaveCount(0);
});

test('M5.10: a record not on disk is said where it would be, open', async ({ page, context }) => {
  const d = detail('health endpoint', 'codex', 'asked 2026-10-04 14:02 · sent · word for word · judged by codex', [
    { act: 'ask', state: 'DONE', aside: '', lines: ['what you asked is not on disk', 'the prompt is not on disk'], open: true },
    { ...JUDGED, lines: ["that check's record is not on disk"] }, NOT_RUN('seal')]);
  await opened(page, context, 'ask_3', d);
  await expect(page.getByText('what you asked is not on disk')).toBeVisible();
  await expect(page.getByText("that check's record is not on disk")).toBeVisible();
});

test('D5.2: on a desktop a double click opens the Details in the agent\'s place, and Close goes back', async ({ page, context }, info) => {
  test.skip(info.project.name !== 'desktop', 'a mouse');
  const machine = await FakeMachine.start();
  Object.assign(machine, atlas());
  machine.onRead = (m) => ({ type: 'ok', req: m.req, detail: DETAILS.ask_1 });
  await signIn(context, person('octo', [{ name: 'studio', address: machine.address }]));
  await page.goto('/');
  await page.getByRole('treeitem', { name: 'fix login', exact: true }).dblclick();
  const view = page.getByRole('region', { name: 'fix login' });
  await expect(view).toBeVisible();
  // The tree stays beside it.
  await expect(page.getByRole('tree', { name: 'Work' })).toBeVisible();
  await view.getByRole('button', { name: 'Close' }).click();
  await expect(view).toHaveCount(0);
});
