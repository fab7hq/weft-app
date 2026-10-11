// One search across every project (M11.8, D11.8): a box at the top of the tree,
// the tree narrowed to what matches as you type, earlier sessions too.
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { FakeMachine, atlas } from './fake-machine';
import { row, wideOf } from './open';
import { person, signIn } from './seed';

async function opened(page: Page, context: BrowserContext) {
  const machine = await FakeMachine.start();
  Object.assign(machine, atlas());
  await signIn(context, person('octo', [{ name: 'studio', address: machine.address }]));
  await page.goto('/');
  await expect(page.getByRole('tree', { name: 'Work' })).toBeVisible();
  return machine;
}

const box = (page: Page) => page.getByRole('searchbox', { name: 'Search agents and works' });
const clear = (page: Page) => page.getByRole('button', { name: 'Clear the search' });
const reads = (machine: FakeMachine) => machine.of('read').filter((r) => r.what === 'sessions');

test('M11.8 D11.8: the box is at the top of the tree; with text it has a ✕ that restores the tree', async ({ page, context }) => {
  const machine = await opened(page, context);
  await expect(box(page)).toHaveAttribute('placeholder', 'Search agents and works');
  await expect(clear(page)).toHaveCount(0);
  if (wideOf(page)) await expect(page.locator('.tree-side').getByRole('searchbox')).toBeVisible();
  // At the top: above the first project.
  const [at, first] = await Promise.all([box(page).boundingBox(), row(page, 'weft').boundingBox()]);
  expect(at!.y).toBeLessThan(first!.y);
  await box(page).fill('health');
  await expect(row(page, 'docs')).toHaveCount(0);
  await expect(clear(page)).toBeVisible();
  await clear(page).click();
  await expect(box(page)).toHaveValue('');
  await expect(clear(page)).toHaveCount(0);
  await expect(row(page, 'docs')).toBeVisible();
  await expect(row(page, 'weft')).toContainText('2 open');
  await expect(row(page, '12 earlier sessions')).toBeVisible();
  await expect(row(page, 'Sealed')).toBeVisible();
  // An emptied box restores it as well.
  await box(page).fill('health');
  await expect(row(page, 'docs')).toHaveCount(0);
  await box(page).fill('');
  await expect(row(page, 'docs')).toBeVisible();
  await machine.close();
});

test('M11.8 D11.8: the tree narrows as you type: a project with a match stays with its count, one with none goes', async ({ page, context }) => {
  const machine = await opened(page, context);
  // A harness, in both projects, ignoring case.
  await box(page).fill('CLAUDE');
  await expect(row(page, 'docs')).toContainText('1 match');
  await expect(row(page, 'weft')).toContainText('11 match');
  await expect(row(page, 'codex · health endpoint')).toHaveCount(0);
  // An Ask's title and its harness, under the group it sits in: the section labels stay, their counts go.
  await box(page).fill('health');
  await expect(row(page, 'docs')).toHaveCount(0);
  await expect(row(page, 'weft')).toContainText('2 match');
  await expect(page.locator('.tree-section')).toHaveText(['AGENTS', 'WORK']);
  await expect(page.locator('.tree-row--agent')).toHaveCount(1);
  await expect(row(page, 'codex · health endpoint')).toBeVisible();
  await expect(row(page, 'Eval 3')).toContainText('Eval 3');
  await expect(page.locator('.tree-row--work')).toHaveText([/health endpoint/]);
  for (const gone of ['Open', 'Sealed', 'telemetry', 'build number', 'claude · fix login']) await expect(row(page, gone)).toHaveCount(0);
  // An Ask's state word.
  await box(page).fill('Asked');
  await expect(row(page, 'weft')).toContainText('1 match');
  await expect(page.locator('.tree-section')).toHaveText(['WORK']);
  await expect(row(page, 'Open')).toBeVisible();
  await expect(page.locator('.tree-row--work')).toHaveText([/fix login/]);
  await expect(row(page, 'Eval 3')).toHaveCount(0);
  // A session's id; the project's name and nothing else matches.
  await box(page).fill('8b2e4f60');
  await expect(row(page, 'weft')).toContainText('1 match');
  await expect(row(page, 'claude · fix login')).toBeVisible();
  await box(page).fill('studio');
  await expect(page.getByText('Nothing matches studio.')).toBeVisible();
  await machine.close();
});

test('M11.8 D11.8: an earlier session that matches appears, and its group opens by itself', async ({ page, context }) => {
  const machine = await opened(page, context);
  await box(page).fill('flaky');
  await expect(row(page, 'weft')).toContainText('1 match');
  await expect(row(page, 'docs')).toHaveCount(0);
  await expect(row(page, '1 earlier session')).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('.tree-row--past')).toHaveText([/flaky test/]);
  await expect.poll(() => reads(machine)).toEqual([expect.objectContaining({ project: 'weft', q: 'flaky' })]);
  // Its id, too; the read is sent once the typing stops, not for each key.
  await box(page).fill('');
  await box(page).pressSequentially('01997a2d');
  await expect(row(page, 'codex · ci cache')).toBeVisible();
  await expect(page.locator('.tree-row--past')).toHaveCount(1);
  expect(reads(machine).at(-1)).toMatchObject({ q: '01997a2d' });
  expect(reads(machine).length).toBeLessThan(5);
  // A tap on it does what its row does, and the search stays.
  await row(page, 'codex · ci cache').click();
  await expect(page.getByRole('region', { name: /^codex · 01997a2d/ })).toBeVisible();
  if (!wideOf(page)) await page.goBack();
  await expect(box(page)).toHaveValue('01997a2d');
  await expect(row(page, 'codex · ci cache')).toBeVisible();
  await expect(row(page, 'docs')).toHaveCount(0);
  // Cleared, the group is as it was: folded.
  await clear(page).click();
  await expect(row(page, '12 earlier sessions')).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('.tree-row--past')).toHaveCount(0);
  await machine.close();
});

test('M11.8 D11.8: nothing matches says so, with what was typed', async ({ page, context }) => {
  const machine = await opened(page, context);
  await box(page).fill('zzz');
  await expect(page.getByText('Nothing matches zzz.')).toBeVisible();
  await expect(page.getByRole('treeitem')).toHaveCount(0);
  await expect.poll(() => reads(machine)).toEqual([expect.objectContaining({ project: 'weft', q: 'zzz' })]);
  await box(page).fill('health');
  await expect(page.getByText('Nothing matches')).toHaveCount(0);
  await expect(row(page, 'weft')).toContainText('2 match');
  await machine.close();
});
