// The Eval view (M6.1–M6.7, D6.1–D6.7): the machine's view of an Eval, read
// by its Eval from the Eval's Details (M11.3), as pages you drill into, by
// step or by file; a step, a change's lines; live while it judges.
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { FakeMachine, atlas } from './fake-machine';
import { person, signIn } from './seed';
import { S7, VIEW, row } from './atlas-fixtures';

async function opened(page: Page, context: BrowserContext, views: Record<string, unknown>[] = [VIEW]) {
  const machine = await FakeMachine.start();
  Object.assign(machine, atlas());
  let reads = 0;
  machine.onRead = (m) => (m.what === 'eval_view' ? { type: 'ok', req: m.req, eval_view: views[Math.min(reads++, views.length - 1)] } : machine.read(m));
  await signIn(context, person('octo', [{ name: 'studio', address: machine.address }]));
  await page.goto('/');
  // The Eval's Details (M11.3), then its Eval view.
  const round = page.getByRole('treeitem', { name: 'Eval 3', exact: true });
  if (page.viewportSize()!.width >= 768) await round.click();
  else await round.getByRole('button', { name: 'Details of Eval 3' }).click();
  await page.getByRole('button', { name: 'Eval view' }).click();
  const view = page.getByRole('region', { name: 'Eval view' });
  await expect(view).toBeVisible();
  return { machine, view };
}

const rowsOf = (view: ReturnType<Page['getByRole']>) => view.locator('.eval-row .eval-text');

test('M6.1 D6.1: by step, the verdict, its drift, and a row for each part', async ({ page, context }) => {
  const { view } = await opened(page, context);
  await expect(view.locator('.eval-head strong')).toHaveText('drifted · confidence 0.75');
  await expect(view.getByText('drift: commission 2%, omission 50%')).toBeVisible();
  await expect(view.getByRole('button', { name: 'By step' })).toHaveAttribute('aria-pressed', 'true');
  await expect(rowsOf(view)).toHaveText(['Findings', 'Unexplained changes', 'Phase 1 · plans/app/plan.md', 'Rules across the work', 'Ask: health endpoint', 'Checks RingFrame ran', 'Limitations']);
  await expect(view.locator('.eval-row').nth(1).locator('.eval-aside')).toHaveText('1');
  await expect(view.locator('.eval-row').nth(2).locator('.eval-aside')).toHaveText('1 met · 1 not met');
  await expect(page.getByText('evl_2')).toBeVisible();
});

test('M6.2 D6.2: by file, a row for each file, and a file opens its changes', async ({ page, context }) => {
  const { view } = await opened(page, context);
  await view.getByRole('button', { name: 'By file' }).click();
  await expect(rowsOf(view)).toHaveText(['src/health.rs', 'src/telemetry.rs', 'tests/health.rs']);
  await expect(view.locator('.eval-row').nth(1).locator('.eval-aside')).toHaveText('1 change · 1 unexplained');
  await view.getByRole('button', { name: /src\/health\.rs/ }).click();
  await expect(rowsOf(view)).toHaveText(['L30–L52', 'L60–L64']);
});

test('M6.3 M6.4 M6.5 D6.4 D6.5: a group, a step, a change, and the crumbs back', async ({ page, context }) => {
  const { machine, view } = await opened(page, context);
  await view.getByRole('button', { name: /Phase 1/ }).click();
  await expect(page.getByRole('button', { name: '‹ Eval view' })).toBeVisible();
  await expect(rowsOf(view)).toHaveText(['✗ 7  A failed send is told.', '✓ 8  /health returns the build number']);

  await view.getByRole('button', { name: /A failed send is told/ }).click();
  await expect(page.getByRole('button', { name: '‹ Phase 1' })).toBeVisible();
  await expect(view.locator('.eval-head .dim')).toHaveText('not met · 1 change');
  await expect(view.getByText('Done when: a send that fails shows the reason to the person.')).toBeVisible();
  await expect(view.getByText('map: no — the error is swallowed in send()')).toBeVisible();
  await expect(view.getByText('confirm: no — agreed with both · not counted')).toBeVisible();
  await expect(view.getByText('CHANGES (1)')).toBeVisible();

  await view.getByRole('button', { name: /src\/send\.rs/ }).click();
  await expect(page.getByRole('button', { name: '‹ A step' })).toBeVisible();
  await expect(view.locator('.eval-head strong')).toHaveText('src/send.rs L88–L97');
  const code = view.locator('.eval-code > div');
  await expect(code).toHaveCount(5);
  await expect(code.nth(1)).toHaveText('89 -    let _ = self.sock.write(msg);');
  await expect(view.locator('.eval-lit')).toHaveText('        log::debug!("send failed");');

  // The crumbs walk back the way in, then to the Details.
  await page.getByRole('button', { name: '‹ A step' }).click();
  await page.getByRole('button', { name: '‹ Phase 1' }).click();
  await page.getByRole('button', { name: '‹ Eval view' }).click();
  await page.getByRole('button', { name: '‹ Details' }).click();
  await expect(page.getByRole('region', { name: 'Eval 3' })).toBeVisible();
  expect(machine.of('read').filter((r) => r.what === 'eval_view')[0]).toMatchObject({ project: 'weft', eval: 'evl_3' });
});

test('M6.6: Findings opens what RingFrame noticed', async ({ page, context }) => {
  const { view } = await opened(page, context);
  await view.getByRole('button', { name: /^Findings/ }).click();
  await expect(view.getByText('what RingFrame noticed beside the steps')).toBeVisible();
  await expect(rowsOf(view)).toHaveText(['unclaimed rewrite: commit 94d7989 rewrites lines of 758156f']);
});

test('M6.7 D6.7: while it judges, the header counts the stages and follows the record', async ({ page, context }) => {
  const live = (reduce: number) => ({
    ...VIEW, closed: false, header: `judging · map 1 of 1 · reduce ${reduce} of 2 · confirm —`,
    by_step: [row('group', 'g:p1', 0, 'Phase 1 · plans/app/plan.md', '1 met, so far', '▾'),
      row('step', `s:${S7}`, 1, '7  A failed send is told.', 'judging · 1 change', '…', 'judging')],
  });
  const { view } = await opened(page, context, [live(1), live(2)]);
  await expect(view.locator('.eval-head strong')).toHaveText('judging · map 1 of 1 · reduce 1 of 2 · confirm —');
  await expect(view.getByText('updates as the judges record')).toBeVisible();
  await expect(view.locator('.eval-head strong')).toHaveText('judging · map 1 of 1 · reduce 2 of 2 · confirm —', { timeout: 5000 });
});

test('D6.1: on a desktop the view takes the agent\'s place, and Close leaves it', async ({ page, context }, info) => {
  test.skip(info.project.name !== 'desktop', 'a desktop');
  const { view } = await opened(page, context);
  await expect(page.getByRole('tree', { name: 'Work' })).toBeVisible();
  await expect(view.getByText('Click a row to open it.')).toBeVisible();
  await view.getByRole('button', { name: 'Close' }).click();
  await expect(view).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Eval 3' })).toHaveCount(0);
});
