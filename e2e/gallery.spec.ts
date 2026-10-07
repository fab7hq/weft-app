// The gallery (`npm run gallery`): every web screen of the Atlas by its ID, at
// its frame (390×844 for M, 1280×800 for D), drawn against the fake machine
// and written to gallery/<ID>.png. A screen the browser cannot draw (a
// notification the system shows) is written as gallery/<ID>.txt, saying why.
import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { FakeMachine, atlas, type Agent, type Project } from './fake-machine';
import { pull, swipeLeft } from './touch';
import { person, signIn } from './seed';
import { DETAILS, JUDGED, NOT_RUN, S7, SEALED, SENT, VIEW, detail, row, type Section } from './atlas-fixtures';

const OUT = 'gallery';
mkdirSync(OUT, { recursive: true });

const CLAUDE = '3f9a1c07b2de-0';
const CODEX = '3f9a1c07b2de-1';

interface At {
  page: Page;
  context: BrowserContext;
  wide: boolean;
  /** The fake machine, started with the Atlas's sample unless a screen says otherwise. */
  machine: FakeMachine;
}

/** Sign in with studio (and these other machines), and open the app. */
async function open(at: At, others: { name: string; address?: string }[] = []) {
  await signIn(at.context, person('octo', [{ name: 'studio', address: at.machine.address }, ...others]));
  await at.page.goto('/');
}

/** What this browser has folded, before the app opens. */
async function folded(at: At, keys: string[]) {
  await at.page.addInitScript((k) => localStorage.setItem('weft.folded', k), JSON.stringify(keys));
}

/** A tap on a harness opens its agent, and selects it; back on the phone, the tree shows it selected. */
async function harnessTapped(at: At, harness: string) {
  await item(at, harness).click();
  await expect(at.page.getByLabel("The agent's screen")).toBeVisible();
  if (!at.wide) {
    await at.page.goBack();
    await expect(item(at, harness)).toHaveAttribute('aria-selected', 'true');
  }
}

async function tree(at: At) {
  await open(at);
  await expect(at.page.getByRole('tree', { name: 'Work' })).toBeVisible();
}

const item = (at: At, name: string) => at.page.getByRole('treeitem', { name, exact: true }).first();
const button = (at: At, name: string) => at.page.getByRole('button', { name, exact: true }).first();

async function agentOpen(at: At, harness: 'claude' | 'codex') {
  await tree(at);
  await item(at, harness).click();
  await expect(at.page.getByLabel("The agent's screen")).toBeVisible();
}

async function activate(at: At) {
  const pane = at.page.getByLabel('The agent', { exact: true });
  if (at.wide) await pane.click();
  else {
    await pane.tap();
    await pane.tap();
  }
}

/** Scroll the active pane back by `by` pixels. */
async function scrollBack(at: At, by: number) {
  const screen = at.page.getByLabel("The agent's screen");
  if (at.wide) {
    await screen.hover();
    await at.page.mouse.wheel(0, -by);
    return;
  }
  await pull(screen, by);
}

const history = (lines: number) => (m: Record<string, unknown>) => ({ type: 'ok', req: m.req, text: Array.from({ length: lines }, (_, i) => `line ${i + 1}`).join('\n') });

/** A pending the machine stages for an act, as the bar shows it. */
const staging = (agent: string, what: string, why: string, text: string) => (m: Record<string, unknown>) => [
  { type: 'pending', id: 'pnd_1', agent, what, why, text },
  { type: 'ok', req: m.req, pending: 'pnd_1' },
];

async function evalOn(at: At, work = 'health endpoint') {
  await tree(at);
  await item(at, work).click();
  await button(at, 'Eval').click();
}

/** The Details of a work, read as this payload. */
async function details(at: At, unit: string, d: Record<string, unknown>) {
  at.machine.onRead = (m) => (m.what === 'eval_view' ? { type: 'ok', req: m.req, eval_view: VIEW } : { type: 'ok', req: m.req, detail: d });
  await tree(at);
  await at.page.getByRole('button', { name: `Details of ${String(d.title)}` }).click();
  await expect(at.page.getByRole('region', { name: String(d.title) })).toBeVisible();
  void unit;
}

async function evalView(at: At, view: Record<string, unknown> = VIEW) {
  await details(at, 'ask_3', { ...DETAILS.ask_3, eval_view: true });
  at.machine.onRead = (m) => ({ type: 'ok', req: m.req, eval_view: view });
  await button(at, 'Eval view').click();
  await expect(at.page.getByRole('region', { name: 'Eval view' })).toBeVisible();
}

const withTree = (edit: (t: Project[], a: Agent[]) => void) => {
  const s = atlas();
  edit(s.tree, s.agents);
  return s;
};

const GATHERED: Section = { act: 'eval', state: 'GATHERED', aside: '', lines: ['gathered by Weft', '[E]VAL  debate in codex'], open: true };
const PROV = 'asked 2026-10-04 14:02 · sent · word for word';

interface Screen {
  ids: string[];
  /** The machine's sample, when not the Atlas's. */
  sample?: () => ReturnType<typeof atlas>;
  run?: (at: At) => Promise<void>;
  /** Not a page: what the gallery writes in its place. */
  note?: string;
}

const SCREENS: Screen[] = [
  // 01 · Start
  { ids: ['M1.1', 'D1.1'], run: async (at) => {
    await at.page.route('**/api/me', () => {});
    await open(at);
  } },
  { ids: ['M1.2', 'D1.2'], run: async (at) => {
    await at.page.route('**/api/me', (r) => r.abort());
    await open(at);
    await expect(at.page.getByRole('heading', { name: 'No connection' })).toBeVisible();
  } },
  { ids: ['M1.3', 'D1.3'], run: async (at) => {
    await at.page.goto('/');
    await expect(at.page.getByRole('link', { name: 'Sign in with GitHub' })).toBeVisible();
  } },
  { ids: ['M1.4', 'D1.4'], run: async (at) => void (await at.page.goto('/privacy')) },
  { ids: ['M1.5', 'D1.5'], run: async (at) => {
    await signIn(at.context, person('octo', []));
    await at.page.goto('/');
    await expect(at.page.getByRole('heading', { name: 'Add a machine' })).toBeVisible();
  } },
  { ids: ['M1.6', 'D1.6'], run: async (at) => {
    await open(at, [{ name: 'laptop' }]);
    await expect(at.page.getByRole('heading', { name: 'Your machines' })).toBeVisible();
    // The cards draw the confirmation for laptop open; on the phone, over its swiped row.
    const laptop = at.page.getByRole('listitem').filter({ hasText: 'laptop' });
    if (!at.wide) {
      await swipeLeft(laptop);
    }
    await laptop.getByRole('button', { name: 'Remove', exact: true }).click();
    await expect(at.page.getByRole('dialog')).toBeVisible();
  } },
  { ids: ['M1.7', 'D1.7'], run: async (at) => {
    at.machine.down = true;
    await open(at);
    await expect(at.page.locator('.tree-skeleton')).toBeVisible();
  } },
  { ids: ['M1.8'], sample: () => withTree((t, a) => {
    t.splice(1);
    Object.assign(t[0], { needs: 0 });
    for (const h of t[0].harnesses) {
      h.works = h.works.slice(0, 1).map((x) => ({ ...x, turn: null }));
      h.turn = 'ready';
    }
    for (const x of a) x.turn = 'ready';
  }), run: async (at) => {
    await tree(at);
    await item(at, 'fix login').click();
    at.machine.down = true;
    at.machine.drop();
    await expect(at.page.getByText('Reconnecting')).toBeVisible();
  } },
  { ids: ['D1.8'], run: async (at) => {
    await folded(at, ['docs']);
    await tree(at);
    await button(at, 'NEEDS YOU 1').click();
    await expect(at.page.getByLabel("The agent's screen")).toBeVisible();
    at.machine.down = true;
    at.machine.drop();
    await expect(at.page.getByText('Reconnecting')).toBeVisible();
  } },

  // 02 · The tree
  { ids: ['M2.1', 'D2.1'], sample: () => ({ ...atlas(), agents: [], tree: [] }), run: async (at) => {
    await open(at);
    await expect(at.page.getByText('Nothing asked for yet.')).toBeVisible();
  } },
  // No agent runs, and the harness the project routes to is not set up (as T2.3).
  { ids: ['M2.3', 'D2.3'], sample: () => ({ ...atlas(), agents: [], tree: [{ project: 'weft', open: 0, needs: 0, ask: { key: 'why.not_set_up', harness: 'claude' }, harnesses: [] }] }), run: async (at) => {
    await open(at);
    await expect(at.page.getByText('claude is not set up for RingFrame.')).toBeVisible();
  } },
  { ids: ['M2.4', 'D2.4'], sample: () => ({ ...atlas(), agents: [], tree: [{ project: 'weft', open: 0, needs: 0, ask: { key: 'why.start_an_agent' }, setup: { ringframe: true, git: false, commit: false }, harnesses: [] }] }), run: tree },
  { ids: ['M2.5'], sample: () => {
    const s = atlas();
    return { ...s, agents: [{ ...s.agents[0], turn: 'ready' }], tree: [{ project: 'weft', open: 1, needs: 0, ask: null, harnesses: [{ ...s.tree[0].harnesses[0], turn: 'ready', works: [] }] }] };
  }, run: async (at) => {
    await tree(at);
    await harnessTapped(at, 'claude');
  } },
  { ids: ['M2.6', 'D2.6'], run: async (at) => {
    await folded(at, ['docs']);
    await tree(at);
    if (at.wide) await harnessTapped(at, 'codex');
    await item(at, 'health endpoint').click();
  } },
  ...(['M2.7', 'D2.7'] as const).map((id): Screen => ({
    ids: [id],
    sample: () => withTree((t, a) => {
      // weft as the card has it, docs folded, and site with its claude folded.
      const [claude, codex] = t[0].harnesses;
      Object.assign(t[0], { needs: 0 });
      Object.assign(claude, { turn: 'ready', works: [{ ...claude.works[0], turn: 'ready' }] });
      codex.works = codex.works.slice(0, 1);
      t.push({ project: 'site', open: 1, needs: 0, ask: null, harnesses: [{ ...t[1].harnesses[0], agent: 'site-0', works: [] }] });
      a[0].turn = 'ready';
      // The desktop card has another agent asking for you.
      if (id === 'D2.7') a[2].turn = 'waiting';
    }),
    run: async (at) => {
      await folded(at, ['docs', 'site/claude']);
      await tree(at);
      if (at.wide) await harnessTapped(at, 'claude');
      await item(at, 'fix login').click();
    },
  })),
  { ids: ['M2.8'], sample: () => withTree((t, a) => {
    const h = t[0].harnesses[0];
    Object.assign(t[0], { open: 24, needs: 0 });
    h.turn = 'ready';
    a[0].turn = 'ready';
    h.works = Array.from({ length: 24 }, (_, i) => ({ unit: `ask_${i + 6}`, title: `task ${i + 6}`, word: 'asked' as const, turn: i === 2 ? 'ready' as const : null, eval: null, seal: null }));
  }), run: async (at) => {
    await tree(at);
    await item(at, 'task 8').click();
  } },
  { ids: ['M2.9', 'D2.9'], sample: () => withTree((t, a) => {
    // The project has turbo on (the header's ⚡ turbo); claude was started in it.
    t.splice(1);
    const [claude, codex] = t[0].harnesses;
    Object.assign(t[0], { needs: 0, turbo: true });
    Object.assign(claude, { turbo: true, turn: 'ready', works: [{ ...claude.works[0], turn: 'ready' }] });
    Object.assign(codex, { running: false, agent: null, turn: null, works: [{ ...codex.works[0], turn: null }] });
    a[0].turn = 'ready';
    a[1].running = false;
  }), run: async (at) => {
    await tree(at);
    if (at.wide) await harnessTapped(at, 'claude');
    await item(at, 'health endpoint').click();
  } },

  // 03 · The agent
  { ids: ['M3.1', 'D3.1'], run: (at) => agentOpen(at, 'codex') },
  { ids: ['M3.3', 'D3.3'], run: async (at) => {
    await agentOpen(at, 'codex');
    await activate(at);
  } },
  { ids: ['M3.4', 'D3.4'], run: (at) => agentOpen(at, 'claude') },
  { ids: ['M3.5', 'D3.5'], run: async (at) => {
    at.machine.onRead = history(200);
    await agentOpen(at, 'codex');
    await activate(at);
    await scrollBack(at, 300);
  } },
  { ids: ['M3.6'], run: async (at) => {
    at.machine.onRead = history(3);
    await agentOpen(at, 'codex');
    await activate(at);
    await scrollBack(at, 600);
    await scrollBack(at, 600);
  } },
  { ids: ['M3.7', 'D3.7'], run: async (at) => {
    await agentOpen(at, 'codex');
    const s = atlas();
    s.agents[1].running = false;
    Object.assign(s.tree[0].harnesses[1], { running: false, agent: null, turn: null });
    at.machine.send({ type: 'agents', agents: s.agents });
    at.machine.send({ type: 'tree', tree: s.tree });
    await expect(at.page.getByText('codex has ended. Its work is still on the list.')).toBeVisible();
  } },
  { ids: ['M3.8'], sample: () => withTree((t) => (t[0].ask = { key: 'why.not_set_up', harness: 'codex' })), run: (at) => agentOpen(at, 'codex') },
  { ids: ['M3.10'], run: async (at) => {
    await agentOpen(at, 'codex');
    await at.page.getByPlaceholder('Message codex…').focus();
  } },
  { ids: ['M3.11'], run: async (at) => {
    await agentOpen(at, 'codex');
    await button(at, 'The bar').click();
  } },
  { ids: ['D3.11'], run: async (at) => {
    await agentOpen(at, 'codex');
    await activate(at);
    await button(at, 'Keys').click();
  } },
  { ids: ['M3.12', 'D3.12'], run: async (at) => {
    await agentOpen(at, 'codex');
    at.machine.down = true;
    at.machine.drop();
    await expect(at.page.getByText('Reconnecting')).toBeVisible();
  } },

  // 04 · Ask and the bar
  { ids: ['M4.1', 'D4.1'], run: async (at) => {
    await tree(at);
    await button(at, 'Ask').click();
  } },
  { ids: ['M4.2'], run: async (at) => {
    await tree(at);
    await button(at, 'Ask').click();
    await at.page.getByRole('dialog', { name: 'What do you want done?' }).getByRole('textbox').fill('Read the build number from the environment and show it on /health');
  } },
  { ids: ['M4.3', 'D4.3'], run: async (at) => {
    await tree(at);
    await item(at, 'health endpoint').click();
    await button(at, 'Ask').click();
    await at.page.getByRole('dialog', { name: 'What do you want done?' }).getByRole('textbox').fill('Add a test for the fallback');
  } },
  { ids: ['M4.4', 'D4.4'], run: async (at) => {
    await details(at, 'ask_3', { ...DETAILS.ask_3, follows: 'evl_2' });
    await button(at, 'Follow up').click();
  } },
  ...([
    ['M4.5', 'D4.5', CLAUDE, 'Ready to ask claude', 'Weft will type  /rf:ask  into claude.\nThe agent will ask you which approach to take, in its own pane.', 'Read the build number from the environment and show it on /health'],
    ['M4.6', 'D4.6', CODEX, 'Ready to send to codex', 'This is the exact wording. Weft will not change it.', 'Implement /health: read BUILD_NUMBER from the environment at startup; fall back to "unknown".'],
    ['M4.7', '', CODEX, 'Ready to send to codex', 'This is the exact wording. Weft will not change it.\ncodex asked you about this and never got an answer, so it is still waiting. Sending it records your yes first.', 'Implement /health: read BUILD_NUMBER …'],
    ['M4.8', 'D4.8', CODEX, 'Eval this work?', "Weft will type  /rf:eval debate evl_2  into codex.\nWeft has gathered the change. The agent will run RingFrame's\njudging tasks on it; none of the judges did the work.", '/rf:eval debate evl_2 coverage contract'],
    ['M4.9', 'D4.9', CODEX, 'Seal this work?', 'Weft will type  /rf:seal evl_2  into codex.\nThe agent will ask what you decided, and write a receipt.', '/rf:seal evl_2'],
    ['M4.10', '', CLAUDE, 'Eval this work?', "Weft will type  /rf:eval debate evl_2  into claude.\nWeft has gathered the change. The agent will run RingFrame's\njudging tasks on it; none of the judges did the work.\nclaude did not do this work. Both acts read the record.", '/rf:eval debate evl_2 coverage contract'],
  ] as const).map(([m, d, agent, what, why, text]): Screen => ({
    ids: [m, d].filter(Boolean),
    run: async (at) => {
      at.machine.onAct = staging(agent, what, why, text);
      await evalOn(at);
      await expect(at.page.getByRole('dialog', { name: what })).toBeVisible();
    },
  })),
  { ids: ['M4.11', 'D4.11'], run: async (at) => {
    at.machine.onAct = staging(CODEX, 'Eval this work?', 'The agent will run the judges.', '/rf:eval debate evl_2');
    at.machine.onResolve = (m) => [{ type: 'error', req: m.req, code: 'not_ready', message: 'Weft did not type it: the agent is working.' }];
    await evalOn(at);
    await button(at, 'Send').click();
    await expect(at.page.getByRole('dialog', { name: 'The agent has not said it is ready' })).toBeVisible();
  } },
  { ids: ['M4.12', 'D4.12'], run: async (at) => {
    at.machine.onAct = (m) => [{ type: 'error', req: m.req, code: 'not_running', message: 'codex is not running.', harness: 'codex', session: { at: Date.now() - 3_600_000, last: 'Implement /health: read BUILD_NUMBER' } }];
    await evalOn(at);
  } },
  { ids: ['M4.13'], run: async (at) => {
    at.machine.onAct = (m) => [{ type: 'error', req: m.req, code: 'not_running', message: 'codex is not running.', harness: 'codex', session: null }];
    await evalOn(at);
  } },
  { ids: ['M4.14', 'D4.14'], run: async (at) => {
    at.machine.onAct = staging(CODEX, 'Eval this work?', 'The agent will run the judges.', '/rf:eval debate evl_2');
    await evalOn(at);
    await expect(at.page.getByRole('dialog', { name: 'Eval this work?' })).toBeVisible();
    at.machine.send({ type: 'resolved', id: 'pnd_1', yes: true });
    await expect(at.page.getByText('Answered on the machine')).toBeVisible();
  } },

  // 05 · Details
  { ids: ['M5.1'], run: (at) => details(at, 'ask_2', DETAILS.ask_2) },
  { ids: ['M5.2', 'D5.2'], run: (at) => details(at, 'ask_1', DETAILS.ask_1) },
  { ids: ['M5.3'], run: (at) => details(at, 'ask_3', detail('health endpoint', 'codex', 'asked 2026-10-04 14:02 · ready to send', [
    { act: 'ask', state: 'DONE', aside: '', lines: ['You asked:', 'Read the build number from the environment and show it on /health', 'The prompt codex composed:', 'Implement /health: read BUILD_NUMBER from the environment at startup; …'], open: true },
  ], { proceed: true })) },
  { ids: ['M5.4', 'D5.4'], run: (at) => details(at, 'ask_3', DETAILS.ask_3) },
  { ids: ['M5.5'], run: (at) => details(at, 'ask_3', detail('health endpoint', 'codex', PROV, [SENT, GATHERED, NOT_RUN('seal')], { eval_view: true, debate_in: 'codex' })) },
  { ids: ['M5.6', 'D5.6'], run: (at) => details(at, 'ask_3', detail('health endpoint', 'codex', `${PROV} · judged by codex`, [SENT, JUDGED, NOT_RUN('seal')], { eval_view: true, recorded: 'drifted, 0.67' })) },
  { ids: ['M5.7', 'D5.7'], run: (at) => details(at, 'ask_4', detail('readme fix', 'codex', 'asked 2026-10-03 11:20 · sent · word for word · judged by codex · sealed 2026-10-03 12:05',
    [SENT, { ...JUDGED, open: false }, SEALED], { eval_view: true, recorded: 'aligned, 1.00', holds: true })) },
  { ids: ['M5.8'], run: (at) => details(at, 'ask_4', detail('readme fix', 'codex', '… · sealed 2026-10-03 12:05',
    [SENT, { ...JUDGED, open: false }, { ...SEALED, lines: ['RECEIPT       rcp_7f3a2c', 'THE RECEIPT NO LONGER HOLDS', 'the work has moved on since it was sealed'] }], { eval_view: true, holds: false })) },
  { ids: ['M5.9'], run: (at) => details(at, 'ask_1', detail('fix login', 'claude', 'asked 2026-10-02 16:30 · cancelled',
    [{ act: 'ask', state: 'DONE', aside: '', lines: ['You asked:', 'Try a second login provider'], open: true }])) },
  { ids: ['M5.10'], run: (at) => details(at, 'ask_3', detail('health endpoint', 'codex', `${PROV} · judged by codex`, [
    { act: 'ask', state: 'DONE', aside: '', lines: ['what you asked is not on disk', 'the prompt is not on disk'], open: true },
    { ...JUDGED, lines: ["that check's record is not on disk"] }, NOT_RUN('seal')])) },

  // 06 · The Eval view
  { ids: ['M6.1', 'D6.1'], run: (at) => evalView(at) },
  { ids: ['M6.2', 'D6.2'], run: async (at) => {
    await evalView(at);
    await button(at, 'By file').click();
  } },
  { ids: ['M6.3'], run: async (at) => {
    await evalView(at);
    await at.page.getByRole('button', { name: /Phase 1/ }).click();
  } },
  { ids: ['M6.4', 'D6.4'], run: async (at) => {
    await evalView(at);
    await at.page.getByRole('button', { name: /Phase 1/ }).click();
    await at.page.getByRole('button', { name: /A failed send is told/ }).click();
  } },
  { ids: ['M6.5', 'D6.5'], run: async (at) => {
    await evalView(at);
    await at.page.getByRole('button', { name: /Phase 1/ }).click();
    await at.page.getByRole('button', { name: /A failed send is told/ }).click();
    await at.page.getByRole('button', { name: /src\/send\.rs/ }).click();
  } },
  { ids: ['M6.6'], run: async (at) => {
    await evalView(at);
    await at.page.getByRole('button', { name: /^Findings/ }).click();
  } },
  { ids: ['M6.7', 'D6.7'], run: (at) => evalView(at, {
    ...VIEW, closed: false, header: 'judging · map 1 of 1 · reduce 1 of 2 · confirm —',
    by_step: [row('group', 'g:p1', 0, 'Phase 1 · plans/app/plan.md', '1 met, so far', '▾'),
      row('step', `s:${S7}`, 1, '7  A failed send is told.', 'judging · 1 change', '…', 'judging'),
      row('step', 's:p1/8', 1, '8  /health returns the build number', 'met, so far · 2 changes', '✓', { read: 'met' })],
  }) },

  // 07 · A harness not set up: it broke after its agent started (as T3.8).
  { ids: ['M7.1', 'D7.1'], sample: () => {
    const s = atlas();
    return { ...s, agents: [{ ...s.agents[0], turn: 'ready' }], tree: [{ project: 'weft', open: 1, needs: 0, ask: { key: 'why.not_set_up', harness: 'claude' }, harnesses: [{ ...s.tree[0].harnesses[0], turn: 'ready', works: [] }] }] };
  }, run: async (at) => {
    await tree(at);
    await harnessTapped(at, 'claude');
    // On the phone the bar says it; on a desktop the agent beside the tree does.
    if (!at.wide) {
      await button(at, 'Eval').click();
      await expect(at.page.getByText('claude is not set up for RingFrame. Set it up in Weft on studio: U.')).toBeVisible();
    }
  } },

  // 08 · Allowing a device
  ...([['M8.1', 'D8.1', null], ['M8.2', 'D8.2', 'denied'], ['M8.3', '', 'expired'], ['M8.4', '', 'not_owner']] as const).map(([m, d, code]): Screen => ({
    ids: [m, d].filter(Boolean),
    run: async (at) => {
      at.machine.allowAtOnce = false;
      await open(at);
      await expect.poll(() => at.machine.of('pair').length).toBe(1);
      at.machine.send({ type: 'asking' });
      if (code) at.machine.send({ type: 'refused', code });
      await expect(at.page.getByRole('heading', { name: code ? 'Not allowed' : /^Allow this/ })).toBeVisible();
    },
  })),

  // 09 · Settings
  { ids: ['M9.1'], run: async (at) => {
    await open(at, [{ name: 'laptop' }]);
    await at.page.getByRole('button', { name: /studio/ }).click();
    await button(at, 'Menu').click();
  } },
  { ids: ['D9.1'], run: async (at) => {
    await open(at, [{ name: 'laptop' }]);
    await at.page.getByRole('button', { name: /studio/ }).click();
    await button(at, 'Menu').click();
  } },
  { ids: ['D9.2'], run: async (at) => {
    await tree(at);
    await button(at, 'Menu').click();
    await button(at, 'Settings…').click();
  } },
  { ids: ['M9.2'], run: async (at) => {
    at.machine.vapid = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';
    await tree(at);
    await button(at, 'Menu').click();
    await at.page.getByLabel(/Notifications from studio/).click();
    await expect(at.page.getByText('Add Weft to your Home Screen first')).toBeVisible();
  } },
  { ids: ['M9.3', 'D9.3'], run: async (at) => {
    // On the phone, as the app on the Home Screen; the machine gives no key yet.
    await at.page.addInitScript(() => Object.defineProperty(navigator, 'standalone', { value: true }));
    await tree(at);
    await button(at, 'Menu').click();
    await at.page.getByLabel(/Notifications from studio/).click();
    await expect(at.page.getByText('Connect to the machine first.')).toBeVisible();
  } },
  ...([['M9.4', 'Delete my account'], ['M9.5', 'Sign out'], ['M9.6', 'Forget this device'], ['D9.4', 'Delete my account']] as const).map(([id, act]) => ({
    ids: [id],
    run: async (at: At) => {
      await tree(at);
      await button(at, 'Menu').click();
      if (at.wide) await button(at, 'Settings…').click();
      await button(at, act).click();
      await expect(at.page.getByRole('dialog')).toBeVisible();
    },
  })),
  { ids: ['M9.7', 'D9.7'], run: async (at) => {
    await tree(at);
    await button(at, 'Menu').click();
    await (at.wide ? at.page.getByRole('menu') : at.page).getByRole('button', { name: 'Start an agent' }).click();
    await expect(at.page.getByRole('radiogroup', { name: 'Start an agent' })).toBeVisible();
  } },

  // 10 · Notices
  { ids: ['M10.1', 'D10.1'], run: async (at) => {
    await folded(at, ['docs']);
    await tree(at);
    if (at.wide) await button(at, 'NEEDS YOU 1').click();
    await button(at, 'Eval').click();
    await expect(at.page.getByText('Nothing to work on yet.')).toBeVisible();
  } },
  { ids: ['M10.2', 'D10.2'], run: async (at) => {
    at.machine.onText = (m) => ({ type: 'error', req: m.req, code: 'in_flight', message: 'still typing' });
    await agentOpen(at, 'claude');
    const box = at.page.getByPlaceholder('Message claude…');
    await box.fill('try again');
    await box.press('Enter');
    await expect(at.page.getByText('Weft did not type it: it is still typing the last one.')).toBeVisible();
  } },
  { ids: ['M10.3'], note: 'Turbo and the TUI\'s other notices at the foot of the tree: the web has no notice line of its own. An agent that ends says so in its own view (M3.7), and a press that cannot go says why where it was pressed (M10.1, M10.2).' },
  { ids: ['M10.4'], note: 'A push notification, drawn by the phone itself; e2e/desktop-push.spec.ts checks that it shows and opens the agent.' },
  { ids: ['D10.3'], note: 'A browser notification, drawn by the system; e2e/desktop-push.spec.ts checks that it shows and opens the agent.' },
];

for (const s of SCREENS) {
  for (const id of s.ids) {
    test(id, async ({ page, context }, info) => {
      const wide = id.startsWith('D');
      test.skip(wide !== (info.project.name === 'gallery-desktop'), 'the other frame');
      if (s.note) return writeFileSync(`${OUT}/${id}.txt`, `${s.note}\n`);
      const machine = await FakeMachine.start();
      Object.assign(machine, s.sample ? s.sample() : atlas());
      try {
        await s.run!({ page, context, wide, machine });
        await page.waitForTimeout(400);
        await page.screenshot({ path: `${OUT}/${id}.png` });
      } finally {
        await machine.close();
      }
    });
  }
}
