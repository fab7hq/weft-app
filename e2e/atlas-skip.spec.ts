// Files an Eval should skip (17.28, 9.13, 9.14, 11.16): the Eval dialog shows
// what the machine's check found under its Reads row, each with its line and
// one button; a press writes that line through the machine, and the dialog
// said again under its id turns the row teal and the count drops. A
// project's settings list the same findings, never a nested repository, and
// say so when there is nothing to skip. An Eval's Details say what was
// counted and not read. Nothing overflows a phone's width.
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { FakeMachine, atlas } from './fake-machine';
import { row, wideOf } from './open';
import { person, signIn } from './seed';

async function opened(page: Page, context: BrowserContext, skip: Record<string, unknown[]> = {}) {
  const machine = await FakeMachine.start();
  Object.assign(machine, atlas());
  machine.skip = skip;
  await signIn(context, person('octo', [{ name: 'studio', address: machine.address }]));
  await page.goto('/');
  await expect(row(page, 'health endpoint')).toBeVisible();
  return machine;
}

const OUTPUT = { kind: 'untracked_bulk', path: 'output/', files: 329, bytes: 4_000_000, commits: 0, kinds_of_files: [['png', 329]], fix: { file: '.gitignore', line: '/output/' } };
const EVIDENCE = {
  kind: 'data_bulk', path: 'research/papers/to-err-is-agentic/evidence/', files: 13708, bytes: 52_000_000, commits: 0, kinds_of_files: [['json', 13708]],
  fix: { file: '.gitattributes', line: 'research/papers/*/evidence/** linguist-generated=true' },
};
const HOMEPAGE = { kind: 'sub_repo', path: 'homepage/', files: 12, bytes: 0, commits: 0, kinds_of_files: [], fix: null };
/** A path no screen is as wide as, and its line. */
const DEEP = `${'very-long-folder-name/'.repeat(8)}generated-output-of-a-run/`;
const LONG = { kind: 'committed_media', path: DEEP, files: 1200, bytes: 9_000_000, commits: 0, kinds_of_files: [['png', 1200]], fix: { file: '.gitattributes', line: `${DEEP}** linguist-generated=true` } };

/** health endpoint's Eval dialog: everything committed since Nov 8, and what to check before it reads. */
const reads = (more: Record<string, unknown>) => ({
  since: 'ask', when: '2026-11-08T10:00:00Z', commits: 52, files: 14181, skipped: { generated: 0, vendored: 0, binary: 19, lock: 2 },
  folder: 'research/papers/to-err-is-agentic/evidence/', folder_files: 13708, large: true, ...more,
});
const pending = (r: Record<string, unknown>) => ({
  type: 'pending', id: 'pnd_e1', agent: '', what: 'Eval this work?', text: '', sends: null, go: { word: 'act.eval', warn: false }, reads: r,
  why: 'health endpoint · 2 Asks\ncodex reads the whole change against what you asked, and reads again only where it is unsure.\nNothing is typed into the agent’s pane.',
});

/** Nothing on the page is wider than the window. */
async function fits(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
}

test('17.28: the Eval dialog checks before it reads; a line taken turns its row teal and the count drops', async ({ page, context }) => {
  const machine = await opened(page, context);
  machine.onAct = (m) => [pending(reads({ findings: [OUTPUT, EVIDENCE, LONG, HOMEPAGE] })), { type: 'ok', req: m.req, pending: 'pnd_e1' }];
  // The line is written on the machine; the dialog is said again under its id.
  machine.onSkip = (m) => [
    pending(reads({ files: 13852, files_before: 14181, findings: [{ ...OUTPUT, added: true }, EVIDENCE, LONG, HOMEPAGE] })),
    { type: 'ok', req: m.req, findings: [EVIDENCE, LONG] },
  ];
  await row(page, 'health endpoint').click();
  await page.locator('.tree-acts').getByRole('button', { name: 'Eval', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Eval this work?' });
  const check = dialog.getByRole('group', { name: 'Check before it reads' });
  await expect(check.locator('.skip-check-head')).toHaveText('Check before it reads3 of 3 left');
  const rows = check.locator('.skip-row');
  await expect(rows).toHaveCount(4);
  await expect(rows.nth(0).locator('.skip-what')).toHaveText('output/ — 329 files Git does not track');
  await expect(rows.nth(0).locator('.skip-line')).toHaveText('.gitignore/output/');
  await expect(rows.nth(1).locator('.skip-what')).toHaveText('research/papers/to-err-is-agentic/evidence/ — 13,708 data files (json)');
  await expect(rows.nth(1).locator('.skip-code')).toHaveText('research/papers/*/evidence/** linguist-generated=true');
  await expect(rows.nth(1).getByRole('button')).toHaveText('Mark as generated');
  await expect(rows.nth(2).locator('.skip-what')).toHaveText(`${DEEP} — 1,200 images and videos`);
  // A nested repository is muted, and has nothing to take.
  await expect(rows.nth(3)).toHaveText('○homepage/ is its own repository: 12 changed files there are not part of this Eval');
  await expect(rows.nth(3).getByRole('button')).toHaveCount(0);
  // While a line is left, the findings say what to do: no large note, and the yes is Eval.
  await expect(dialog.getByRole('note')).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: 'Eval', exact: true })).toBeVisible();
  await fits(page);

  await rows.nth(0).getByRole('button', { name: 'Add to .gitignore' }).click();
  await expect.poll(() => machine.of('skip_add')).toEqual([expect.objectContaining({ project: 'weft', file: '.gitignore', line: '/output/' })]);
  // Said again under its id: the same dialog, its row now teal, and fewer files read.
  await expect(page.getByRole('dialog', { name: 'Eval this work?' })).toHaveCount(1);
  const added = check.locator('.skip-row--added');
  await expect(added).toHaveCount(1);
  await expect(added.locator('.skip-added')).toHaveText('Added to .gitignore');
  await expect(added.locator('.skip-gone')).toHaveText('329 files are no longer read');
  await expect(added.getByRole('button')).toHaveCount(0);
  await expect(added.locator('.skip-mark')).toHaveCSS('color', 'rgb(57, 197, 187)');
  await expect(check.locator('.skip-check-head')).toHaveText('Check before it reads2 of 3 left');
  await expect(dialog.locator('.pending-reads-before')).toHaveText('14,181');
  await expect(dialog.locator('.pending-reads')).toHaveText(/^Reads52 commits · 14,181 13,852 files since its first Ask, Nov 8/);
  await fits(page);
  await machine.close();
});

test('17.28: a line the machine would not take is said in the dialog, and the row stays', async ({ page, context }) => {
  const machine = await opened(page, context);
  machine.onAct = (m) => [pending(reads({ findings: [OUTPUT] })), { type: 'ok', req: m.req, pending: 'pnd_e1' }];
  machine.onSkip = (m) => [{ type: 'error', req: m.req, code: 'not_proposed', message: 'Weft’s latest check did not propose /output/ in .gitignore' }];
  await row(page, 'health endpoint').click();
  await page.locator('.tree-acts').getByRole('button', { name: 'Eval', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Eval this work?' });
  await dialog.getByRole('button', { name: 'Add to .gitignore' }).click();
  await expect(dialog.getByRole('alert')).toHaveText('Weft’s latest check did not propose /output/ in .gitignore');
  await expect(dialog.getByRole('button', { name: 'Add to .gitignore' })).toBeVisible();
  await machine.close();
});

test('9.13 9.14: a project\'s settings list the files an Eval should skip; a line taken goes, Check again asks the machine, and nothing left says so', async ({ page, context }) => {
  const machine = await opened(page, context, { weft: [OUTPUT, EVIDENCE, LONG] });
  machine.onSkip = (m) => [{ type: 'ok', req: m.req, findings: m.type === 'skip_add' ? [EVIDENCE, LONG] : [] }];
  await page.getByRole('button', { name: "weft's settings" }).first().click();
  const section = page.getByRole('region', { name: 'FILES AN EVAL SHOULD SKIP' });
  await expect(section.locator('.skip-head')).toHaveText('FILES AN EVAL SHOULD SKIPCheck again');
  await expect(section.locator('.skip-what')).toHaveText([
    'output/ — 329 files Git does not track',
    'research/papers/to-err-is-agentic/evidence/ — 13,708 data files (json)',
    `${DEEP} — 1,200 images and videos`,
  ]);
  await expect(section.getByRole('button', { name: /^(Add to \.gitignore|Mark as generated)$/ })).toHaveText(['Add to .gitignore', 'Mark as generated', 'Mark as generated']);
  await fits(page);

  await section.getByRole('button', { name: 'Add to .gitignore' }).click();
  await expect.poll(() => machine.of('skip_add')).toEqual([expect.objectContaining({ project: 'weft', file: '.gitignore', line: '/output/' })]);
  await expect(section.locator('.skip-row')).toHaveCount(2);

  // The machine finds otherwise: every device is told.
  machine.send({ type: 'skip', project: 'weft', findings: [EVIDENCE] });
  await expect(section.locator('.skip-row')).toHaveCount(1);

  await section.getByRole('button', { name: 'Check again' }).click();
  await expect.poll(() => machine.of('skip_check')).toEqual([expect.objectContaining({ project: 'weft' })]);
  await expect(section.getByRole('status')).toHaveText('✓Every file to skip is already ignored');
  await expect(section.locator('.skip-row')).toHaveCount(0);
  await fits(page);
  await machine.close();
});

test('9.13: a project\'s settings never show a nested repository', async ({ page, context }) => {
  const machine = await opened(page, context, { weft: [HOMEPAGE] });
  await page.getByRole('button', { name: "weft's settings" }).first().click();
  const section = page.getByRole('region', { name: 'FILES AN EVAL SHOULD SKIP' });
  await expect(section.getByRole('status')).toHaveText('✓Every file to skip is already ignored');
  await expect(section.getByText('homepage/')).toHaveCount(0);
  await machine.close();
});

test('11.16: an Eval\'s Details say what its readers counted and did not read, by kind and folder', async ({ page, context }) => {
  const machine = await opened(page, context);
  machine.reads.evals.evl_3 = { ...machine.reads.evals.evl_3, not_read: [
    { kind: 'generated', folder: 'research/papers/to-err-is-agentic/evidence/', files: 13708 },
    { kind: 'binary', folder: 'marketing/weft/assets/final/', files: 12 },
    { kind: 'binary', folder: 'weft-app/web/public/', files: 4 },
    { kind: 'binary', folder: 'site/', files: 2 },
    { kind: 'binary', folder: DEEP, files: 1 },
    { kind: 'lock', folder: 'weft/Cargo.lock', files: 1 },
    { kind: 'lock', folder: 'weft-app/package-lock.json', files: 1 },
  ] } as typeof machine.reads.evals.evl_3;
  const r = row(page, 'health endpoint');
  if (wideOf(page)) await r.click();
  else await r.getByRole('button', { name: /^Details of/ }).click();
  await page.locator('.workflow').getByRole('button', { name: 'Eval 3', exact: true }).click();
  const section = page.getByRole('region', { name: 'Eval 3' }).getByRole('region', { name: 'Not read' });
  await expect(section.locator('.nr-head')).toHaveText('Not read· 13,729 files counted');
  await expect(section.locator('.nr-count')).toHaveText(['13,708 generated', '19 binary', '2 lock']);
  await expect(section.locator('.nr-where')).toHaveText([
    'research/papers/to-err-is-agentic/evidence/',
    'marketing/weft/assets/final/ and 3 other folders',
    'weft/Cargo.lock · weft-app/package-lock.json',
  ]);
  await fits(page);
  await machine.close();
});
