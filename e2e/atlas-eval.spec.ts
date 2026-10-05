// The Eval view (M6.1–M6.7, D6.1–D6.7): the machine's view as pages you drill
// into, by step or by file; a step, a change's lines; live while it judges.
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { FakeMachine, atlas } from './fake-machine';
import { person, signIn } from './seed';

const S7 = 'plans/app/plan.md#Phase 1/7';
const row = (kind: string, key: string, depth: number, text: string, aside = '', mark = '', state: unknown = null) => ({ kind, key, depth, mark, text, aside, state });
const heading = (text: string) => row('heading', '', 0, text);
const text = (t: string, depth = 1, aside = '') => row('text', '', depth, t, aside);

const VIEW = {
  eval_id: 'evl_2',
  closed: true,
  header: 'drifted · confidence 0.75 · drift: commission 2%, omission 50%',
  by_step: [
    heading('FINDINGS'), text('unclaimed rewrite: commit 94d7989 rewrites lines of 758156f'),
    heading('UNEXPLAINED CHANGES'), row('change', 'c:w_t', 1, 'src/telemetry.rs  L12–L30', 'unexplained: posts the project path outside', '·'),
    row('group', 'g:p1', 0, 'Phase 1 · plans/app/plan.md', '1 met · 1 not met', '▾'),
    row('step', `s:${S7}`, 1, '7  A failed send is told.', 'not met · 1 change', '✗', 'not_met'),
    row('step', 's:p1/8', 1, '8  /health returns the build number', 'met · 2 changes', '✓', 'met'),
    row('group', 'g:rules', 0, 'Rules across the work', '2 met', '▾'),
    row('group', 'g:ask', 0, 'Ask: health endpoint', '1 met · 1 unsettled', '▾'),
    heading('CHECKS RINGFRAME RAN'), text('`cargo test`: succeeded in 12 s'),
    heading('LIMITATIONS'), text('No judge ran the app; the checks are the tests above.'),
  ],
  by_file: [
    row('group', 'f:src/health.rs', 0, 'src/health.rs', '2 changes', '▾'),
    row('change', 'c:w_h1', 1, 'L30–L52', 'required', '·'), row('change', 'c:w_h2', 1, 'L60–L64', 'consequence', '·'),
    row('group', 'f:src/telemetry.rs', 0, 'src/telemetry.rs', '1 change · 1 unexplained', '▾'),
    row('change', 'c:w_t', 1, 'L12–L30', 'unexplained: posts the project path outside', '·'),
    row('group', 'f:tests/health.rs', 0, 'tests/health.rs', '1 change', '▾'), row('change', 'c:w_x', 1, 'L1–L20', 'required', '·'),
  ],
  steps: {
    [S7]: [
      row('heading', '', 0, '7  A failed send is told.', 'not met', '✗', 'not_met'),
      text('Done when: a send that fails shows the reason to the person.'),
      heading('FOUND'), text('the error is logged at debug level and the person sees nothing'),
      heading('READINGS'), text('map: no  the error is swallowed in send()'), text('reduce: no  no message reaches the bar'),
      text('confirm: no  agreed with both', 1, 'not counted'),
      heading('CHANGES (1)'), row('change', 'c:w_s', 1, 'src/send.rs  L88–L97', 'required', '·'),
    ],
  },
  changes: {
    w_s: [
      { n: 88, text: ' fn send(&self, msg: &Msg) -> Result<()> {', lit: false },
      { n: 89, text: '-    let _ = self.sock.write(msg);', lit: false },
      { n: 89, text: '+    if let Err(e) = self.sock.write(msg) {', lit: false },
      { n: 90, text: '+        log::debug!("send failed");', lit: true },
      { n: 91, text: '     Ok(())', lit: false },
    ],
  },
};

const DETAIL = { title: 'health endpoint', harness: 'codex', provenance: '', sections: [], proceed: false, eval_view: true, follows: 'evl_2' };

async function opened(page: Page, context: BrowserContext, views: Record<string, unknown>[] = [VIEW]) {
  const machine = await FakeMachine.start();
  Object.assign(machine, atlas());
  let reads = 0;
  machine.onRead = (m) =>
    m.what === 'eval_view'
      ? { type: 'ok', req: m.req, eval_view: views[Math.min(reads++, views.length - 1)] }
      : { type: 'ok', req: m.req, detail: DETAIL };
  await signIn(context, person('octo', [{ name: 'studio', address: machine.address }]));
  await page.goto('/');
  await page.getByRole('button', { name: 'Details of health endpoint' }).click();
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
  const { view } = await opened(page, context);
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
  await expect(view.locator('.eval-head strong')).toHaveText('src/send.rs  L88–L97');
  const code = view.locator('.eval-code > div');
  await expect(code).toHaveCount(5);
  await expect(code.nth(1)).toHaveText(' 89 -    let _ = self.sock.write(msg);');
  await expect(view.locator('.eval-lit')).toHaveText('        log::debug!("send failed");');

  // The crumbs walk back the way in, then to the Details.
  await page.getByRole('button', { name: '‹ A step' }).click();
  await page.getByRole('button', { name: '‹ Phase 1' }).click();
  await page.getByRole('button', { name: '‹ Eval view' }).click();
  await page.getByRole('button', { name: '‹ Details' }).click();
  await expect(page.getByRole('region', { name: 'health endpoint' })).toBeVisible();
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
  await expect(page.getByRole('region', { name: 'health endpoint' })).toHaveCount(0);
});
