// The gallery (`npm run gallery`): every web screen of the Atlas by its ID, at
// its frame less the card's status or browser bar (390×803 for M, 1280×754 for D), drawn against the fake machine
// and written to gallery/<ID>.png. A screen the browser cannot draw (a
// notification the system shows) is written as gallery/<ID>.txt, saying why.
import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { FakeMachine, atlas, project, type Agent, type Detail, type Project } from './fake-machine';
import { pull, swipeLeft } from './touch';
import { openAgent } from './open';
import { person, signIn } from './seed';
import { CLAUDE, CODEX, CODEX_NEW, DETAILS, S7, SESSIONS, VIEW, at, row } from './atlas-fixtures';

const OUT = 'gallery';
mkdirSync(OUT, { recursive: true });

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

/** Settings' cards: signed in as 0xnairb, the tree of studio open. */
async function settingsOpen(at: At, others: { name: string; address?: string }[] = []) {
  await signIn(at.context, person('0xnairb', [{ name: 'studio', address: at.machine.address }, ...others]));
  await at.page.goto('/');
  if (others.length > 0) await at.page.getByRole('button', { name: /studio/ }).click();
  await expect(at.page.getByRole('tree', { name: 'Work' })).toBeVisible();
}

/** What this browser keeps, as the card shows it: the device's name, notifications on. */
async function kept(at: At, { name, push }: { name?: string; push?: boolean }) {
  await at.page.evaluate(
    async ({ name, push }) => {
      const db = await new Promise<IDBDatabase>((done, fail) => {
        const r = indexedDB.open('weft', 1);
        r.onsuccess = () => done(r.result);
        r.onerror = () => fail(r.error);
      });
      const asked = <T,>(r: IDBRequest<T>) => new Promise<T>((done, fail) => ((r.onsuccess = () => done(r.result)), (r.onerror = () => fail(r.error))));
      const devices = db.transaction('devices', 'readwrite').objectStore('devices');
      const me = await asked(devices.get('this'));
      if (name && me) await asked(db.transaction('devices', 'readwrite').objectStore('devices').put({ ...me, name }, 'this'));
      if (push) {
        const macs = db.transaction('macs', 'readwrite').objectStore('macs');
        const keys = await asked(macs.getAllKeys());
        for (const k of keys) {
          const s = db.transaction('macs', 'readwrite').objectStore('macs');
          const v = await asked(s.get(k));
          await asked(db.transaction('macs', 'readwrite').objectStore('macs').put({ ...v, push: true }, k));
        }
      }
    },
    { name, push },
  );
}

/** What this browser has folded, before the app opens: docs, as the cards draw it. */
async function folded(at: At, keys: string[] = ['docs']) {
  await at.page.addInitScript((k) => localStorage.setItem('weft.folded', k), JSON.stringify(keys));
}

/** A session's row selected, as the cards draw it: on a desktop its agent opens beside the tree. */
async function selected(at: At, name: string) {
  await item(at, name).click();
  if (at.wide) await expect(at.page.getByLabel("The agent's screen")).toBeVisible();
}

async function tree(at: At) {
  await open(at);
  await expect(at.page.getByRole('tree', { name: 'Work' })).toBeVisible();
}

const item = (at: At, name: string) => at.page.getByRole('treeitem', { name, exact: true }).first();
const button = (at: At, name: string) => at.page.getByRole('button', { name, exact: true }).first();

/** An agent open: on a desktop its row clicked; on a phone, as NEEDS YOU or › and Go to its agent would. */
async function agentOpen(at: At, harness: 'claude' | 'codex') {
  await tree(at);
  await openAgent(at.page, harness === 'claude' ? 'claude · fix login' : 'codex · health endpoint');
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

/** The agent's history, as `read history` answers it; any other read as the sample. */
const history = (lines: number) => (m: Record<string, unknown>) => (m.what === 'history' ? { type: 'ok', req: m.req, text: Array.from({ length: lines }, (_, i) => `line ${i + 1}`).join('\n') } : null);

/** A pending the machine stages for an act, as the bar shows it. */
const staging = (agent: string, what: string, why: string, text: string) => (m: Record<string, unknown>) => [
  { type: 'pending', id: 'pnd_1', agent, what, why, text },
  { type: 'ok', req: m.req, pending: 'pnd_1' },
];

/** Eval on the Open round, or Seal on Eval 3, from the tree's bar. */
async function roundAct(at: At, act: 'Eval' | 'Seal' = 'Eval') {
  await tree(at);
  await item(at, act === 'Eval' ? 'Open' : 'Eval 3').click();
  await at.page.locator('.tree-acts').getByRole('button', { name: act, exact: true }).click();
}

/** A work's Details, read as this payload, from › on its row. */
async function details(at: At, unit: string, d: Detail = DETAILS[unit]) {
  at.machine.reads.details[unit] = d;
  await tree(at);
  await item(at, d.title).getByRole('button', { name: `Details of ${d.title}` }).click();
  await expect(at.page.getByRole('region', { name: d.title })).toBeVisible();
}

/** An Eval's Details, from the tree: › on a phone, a click on a desktop. */
async function roundOpen(at: At) {
  await tree(at);
  if (at.wide) await item(at, 'Eval 3').click();
  else await item(at, 'Eval 3').getByRole('button', { name: 'Details of Eval 3' }).click();
  await expect(at.page.getByRole('region', { name: 'Eval 3' })).toBeVisible();
}

async function evalView(at: At, view: Record<string, unknown> = VIEW) {
  at.machine.reads.views.evl_3 = view;
  await roundOpen(at);
  await button(at, 'Eval view').click();
  await expect(at.page.getByRole('region', { name: 'Eval view' })).toBeVisible();
}

const BUILD = 'Read the build number from the environment and show it on /health';
const sheet = (at: At) => at.page.getByRole('dialog', { name: 'What do you want done?' });

/** Behind the area-4 cards: claude's view on a phone; claude open and selected on a desktop. */
async function behind(at: At) {
  await folded(at);
  await agentOpen(at, 'claude');
}

/** Ask, over claude's view: the header's Ask on a phone, the bar's on a desktop. */
async function askOpen(at: At) {
  await behind(at);
  if (at.wide) await at.page.locator('.tree-acts').getByRole('button', { name: 'Ask', exact: true }).click();
  else await at.page.locator('.appbar').getByRole('button', { name: 'Ask', exact: true }).click();
  await expect(sheet(at)).toBeVisible();
}

/** Pick an agent in SEND TO. */
async function sendTo(at: At, harness: string) {
  await sheet(at).getByRole('button', { name: /^SEND TO/ }).click();
  await sheet(at).getByRole('option', { name: harness, exact: true }).first().click();
}

/** Eval on the Open round (or Seal on Eval 3) from the tree's bar; on a desktop with claude open beside it. */
async function barOn(at: At, act: 'Eval' | 'Seal' = 'Eval') {
  await folded(at);
  if (at.wide) {
    await agentOpen(at, 'claude');
    await item(at, act === 'Eval' ? 'Open' : 'Eval 3').click();
    await at.page.locator('.tree-acts').getByRole('button', { name: act, exact: true }).click();
  } else await roundAct(at, act);
}


const withTree = (edit: (t: Project[], a: Agent[]) => void) => {
  const s = atlas();
  edit(s.tree, s.agents);
  return s;
};

/** The agent cards' moment: claude open and at work, beside codex; docs folded. */
const calm = () => withTree((t, a) => {
  a.splice(2);
  a[0].turn = 'working';
  t[0].needs = 0;
  t[0].agents.rows[1].turn = 'working';
});

/** The 13 cards' machine: weft alone, claude and codex running in it. */
const weftOnly = () => {
  const s = atlas();
  const tree = s.tree.filter((p) => p.project === 'weft');
  // codex at work with no Ask yet is not on these cards.
  tree[0].agents.rows = tree[0].agents.rows.filter((r) => r.agent !== CODEX_NEW);
  tree[0].agents.running = 2;
  return { ...s, agents: s.agents.filter((a) => a.agent !== CODEX_NEW && a.project === 'weft'), tree };
};

/** M13.5's: weft reopened at 07:58 after Weft ended uncleanly, every agent ended. */
const reopened = () => {
  const s = weftOnly();
  // In the machine's time, as the tree shows its times.
  s.tree[0].reopened = at(7, 58);
  s.tree[0].needs = 0;
  for (const a of s.agents) Object.assign(a, { running: false, turn: 'ended' });
  s.tree[0].agents.running = 0;
  s.tree[0].agents.ended += s.tree[0].agents.rows.filter((r) => r.state === 'running').length;
  s.tree[0].agents.rows = s.tree[0].agents.rows.map((r) => (r.state === 'running' ? { ...r, state: 'ended', turn: null, agent: null, at: at(7, 41), ask: { key: 'why.ended', harness: r.harness } } : r));
  // What each read says of those sessions: ended at 07:41, resumable.
  s.reads = { ...s.reads, sessions: { ...s.reads.sessions } };
  for (const r of s.tree[0].agents.rows) {
    const d = s.reads.sessions[r.session];
    if (d && d.state === 'running') s.reads.sessions[r.session] = { ...d, state: 'ended', turn: null, agent: null, resume: true, last: at(7, 41) };
  }
  return s;
};

/** What the cards draw in claude's pane: the desktop's lines, and the phone's as its narrower screen wraps them. */
const WORKING = {
  wide: ['● Read(src/login.rs)', '● Update(src/login.rs)', '  ⎿ Updated src/login.rs with 12 additions and 3 removals', '● Running cargo test…', '  test login::rejects_expired ... ok', '  test login::refreshes_token ... ok', '', '✻ Thinking… (esc to interrupt)', '', '❯'],
  phone: ['● Read(src/login.rs)', '● Update(src/login.rs)', '  ⎿ Updated src/login.rs with', '    12 additions and 3 removals', '● Running cargo test…', '  test login::rejects_expired ok', '  test login::refreshes_token ok', '', '✻ Thinking… (esc to interrupt)', '', '❯'],
};
const BLUE = (s: string) => `\x1b[38;2;88;166;255m${s}\x1b[0m`;
const ASKING = {
  wide: ['● Write(src/login.rs)', 'Do you want to make this edit to login.rs?', BLUE('❯ 1. Yes'), "  2. Yes, and don't ask again this session (shift+tab)", '  3. No, and tell Claude what to do differently (esc)'],
  phone: ['● Write(src/login.rs)', 'Do you want to make this edit', 'to login.rs?', BLUE('❯ 1. Yes'), "  2. Yes, and don't ask again", '     this session (shift+tab)', '  3. No, and tell Claude what to', '     do differently (esc)'],
};

/** Open claude (docs folded, as every screen has it), and draw these lines on its screen as the machine would. */
async function onClaude(at: At, lines: { wide: string[]; phone: string[] } = WORKING) {
  await agentOpen(at, 'claude');
  const bytes = Buffer.from((at.wide ? lines.wide : lines.phone).join('\r\n')).toString('base64');
  await expect.poll(() => at.machine.of('watch').some((m) => m.agent === CLAUDE)).toBe(true);
  at.machine.send({ type: 'screen', agent: CLAUDE, seq: 1, full: true, rows: 30, cols: at.wide ? 117 : 47, bytes });
}


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
    t[0].agents.rows[1].turn = 'ready';
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

  // 02 · The tree. M2.6–M2.9 and their D twins are superseded by M11.1, D11.1.
  { ids: ['M2.1', 'D2.1'], sample: () => ({ ...atlas(), agents: [], tree: [] }), run: async (at) => {
    await open(at);
    await expect(at.page.getByText('Nothing asked for yet.')).toBeVisible();
  } },
  // No agent runs, and the harness the project routes to is not set up (as T2.3).
  { ids: ['M2.3', 'D2.3'], sample: () => ({ ...atlas(), agents: [], tree: [{ ...project('weft', []), ask: { key: 'why.not_set_up', harness: 'claude' } }] }), run: async (at) => {
    await open(at);
    await expect(at.page.getByText('claude is not set up for RingFrame.')).toBeVisible();
  } },
  { ids: ['M2.4', 'D2.4'], sample: () => ({ ...atlas(), agents: [], tree: [{ ...project('weft', []), ask: { key: 'why.start_an_agent' }, setup: { ringframe: true, git: false, commit: false } }] }), run: tree },
  { ids: ['M2.5'], sample: () => {
    const s = atlas();
    return { ...s, agents: [{ ...s.agents[0], turn: 'ready' }], tree: [project('weft', [{ ...SESSIONS[1], turn: 'ready', title: null, asks: 0 }])] };
  }, run: async (at) => {
    await tree(at);
    await selected(at, 'claude · no Ask yet');
  } },

  // 03 · The agent
  { ids: ['M3.1', 'D3.1'], sample: calm, run: (at) => onClaude(at) },
  { ids: ['M3.3', 'D3.3'], sample: calm, run: async (at) => {
    await onClaude(at);
    await activate(at);
  } },
  { ids: ['M3.4', 'D3.4'], sample: () => ({ ...calm(), agents: atlas().agents.slice(0, 2) }), run: (at) => onClaude(at, ASKING) },
  { ids: ['M3.5', 'D3.5'], sample: calm, run: async (at) => {
    at.machine.onRead = history(200);
    await onClaude(at);
    await activate(at);
    await scrollBack(at, 300);
  } },
  { ids: ['M3.6'], sample: calm, run: async (at) => {
    at.machine.onRead = (m) => (m.what === 'history' ? { ...history(3)(m), transcript: 'Ctrl+O' } : null);
    await onClaude(at);
    await activate(at);
    await scrollBack(at, 600);
    await expect(at.page.getByText('claude keeps its own history: press Ctrl+O in the agent to read it.')).toBeVisible();
  } },
  { ids: ['M3.7', 'D3.7'], sample: calm, run: async (at) => {
    await onClaude(at);
    const s = calm();
    s.agents[0].running = false;
    Object.assign(s.tree[0].agents.rows[1], { state: 'ended', agent: null, turn: null });
    at.machine.send({ type: 'agents', agents: s.agents });
    at.machine.send({ type: 'tree', tree: s.tree });
    await expect(at.page.getByText('claude has ended. Its work is still on the list.')).toBeVisible();
  } },
  { ids: ['M3.8'], sample: () => withTree((t, a) => {
    t[0].ask = { key: 'why.not_set_up', harness: 'claude' };
    a.splice(1);
    a[0].turn = 'ready';
  }), run: (at) => onClaude(at, { wide: ['❯'], phone: ['❯'] }) },
  { ids: ['M3.10'], sample: calm, run: async (at) => {
    await onClaude(at);
    await at.page.getByPlaceholder('Message claude…').fill('yes, run the migration first');
    await at.page.getByRole('button', { name: '⇧', exact: true }).click();
  } },
  { ids: ['M3.11'], sample: calm, run: async (at) => {
    await onClaude(at);
    await button(at, '⇧').click();
  } },
  { ids: ['D3.11'], sample: calm, run: async (at) => {
    await onClaude(at);
    await activate(at);
    await button(at, 'Keys').click();
  } },
  { ids: ['M3.12', 'D3.12'], sample: calm, run: async (at) => {
    await onClaude(at);
    at.machine.down = true;
    at.machine.drop();
    await expect(at.page.getByText('Reconnecting')).toBeVisible();
  } },

  // 04 · Ask and the bar
  // Behind each card: on a phone claude's view (or the tree with health
  // endpoint picked); on a desktop claude open with health endpoint picked.
  { ids: ['M4.1', 'D4.1'], run: async (at) => {
    await askOpen(at);
    if (at.wide) {
      await sheet(at).getByRole('textbox').fill(BUILD);
      await sendTo(at, 'claude');
      await sheet(at).getByRole('textbox').focus();
    }
  } },
  { ids: ['M4.2'], run: async (at) => {
    await askOpen(at);
    await sheet(at).getByRole('textbox').fill(BUILD);
  } },
  { ids: ['M4.3', 'D4.3'], run: async (at) => {
    await askOpen(at);
    await sheet(at).getByRole('textbox').fill(BUILD);
    await sendTo(at, 'codex');
    await sheet(at).getByRole('button', { name: /^SEND TO/ }).click();
  } },
  { ids: ['M4.4', 'D4.4'], run: async (at) => {
    await folded(at);
    await details(at, 'ask_3', { ...DETAILS.ask_3, follows: 'evl_2' });
    await button(at, 'Follow up').click();
    await sheet(at).getByRole('textbox').fill('Read the build number from the environment, not a literal');
  } },
  { ids: ['M4.5', 'D4.5'], run: async (at) => {
    at.machine.onAct = staging(CLAUDE, 'Ready to ask claude', 'Weft will type  /rf:ask  into claude.\nThe agent will ask you which approach to take, in its own pane.', BUILD);
    await askOpen(at);
    await sheet(at).getByRole('textbox').fill(BUILD);
    await sendTo(at, 'claude');
    await sheet(at).getByRole('button', { name: 'Ask', exact: true }).click();
    await expect(at.page.getByRole('dialog', { name: 'Ready to ask claude' })).toBeVisible();
  } },
  ...([
    ['M4.6', 'D4.6', CODEX, 'Ready to send to codex', 'This is the exact wording. Weft will not change it.', 'Implement /health: read BUILD_NUMBER from the environment at startup; fall back to "unknown". Add a test …'],
    ['M4.7', '', CODEX, 'Ready to send to codex', 'This is the exact wording. Weft will not change it.\ncodex asked you about this and never got an answer, so it is still waiting. Sending it records your yes first.', 'Implement /health: read BUILD_NUMBER …'],
    ['M4.8', 'D4.8', CODEX, 'Eval this work?', "Weft will type  /rf:eval debate evl_2  into codex.\nWeft has gathered the change. The agent will run RingFrame's\njudging tasks on it; none of the judges did the work.", '/rf:eval debate evl_2 coverage contract'],
    ['M4.9', 'D4.9', CODEX, 'Seal this work?', 'Weft will type  /rf:seal evl_2  into codex.\nThe agent will ask what you decided, and write a receipt.', '/rf:seal evl_2'],
    ['M4.10', '', CLAUDE, 'Eval this work?', "Weft will type  /rf:eval debate evl_2  into claude.\nWeft has gathered the change. The agent will run RingFrame's\njudging tasks on it; none of the judges did the work.\nclaude did not do this work. Both acts read the record.", '/rf:eval debate evl_2 coverage contract'],
  ] as const).map(([m, d, agent, what, why, text]): Screen => ({
    ids: [m, d].filter(Boolean),
    run: async (at) => {
      at.machine.onAct = staging(agent, what, why, text);
      await barOn(at, what.startsWith('Seal') ? 'Seal' : 'Eval');
      await expect(at.page.getByRole('dialog', { name: what })).toBeVisible();
    },
  })),
  { ids: ['M4.11', 'D4.11'], run: async (at) => {
    at.machine.onAct = staging(CODEX, 'Eval this work?', 'The agent will run the judges.', '/rf:eval debate evl_2');
    at.machine.onResolve = (m) => [{ type: 'error', req: m.req, code: 'not_ready', message: 'Weft did not type it: the agent is working.' }];
    await barOn(at);
    await at.page.getByRole('dialog', { name: 'Eval this work?' }).getByRole('button', { name: 'Send', exact: true }).click();
    await expect(at.page.getByRole('dialog', { name: 'The agent has not said it is ready' })).toBeVisible();
    // On a phone the card shows it over claude's view.
    if (!at.wide) await button(at, 'NEEDS YOU 1').click();
  } },
  // No agent runs where the act goes: the machine names the session to resume, by its id.
  { ids: ['M4.12', 'D4.12'], run: async (at) => {
    const ended = { ...SESSIONS[2], state: 'ended' as const, turn: null, agent: null };
    at.machine.onAct = (m) => [{ type: 'error', req: m.req, code: 'not_running', message: 'codex is not running.', harness: 'codex', session: ended }];
    await barOn(at);
  } },
  { ids: ['M4.13'], run: async (at) => {
    at.machine.onAct = (m) => [{ type: 'error', req: m.req, code: 'not_running', message: 'codex is not running.', harness: 'codex', session: null }];
    await barOn(at);
  } },
  { ids: ['M4.14', 'D4.14'], run: async (at) => {
    at.machine.onAct = staging(CLAUDE, 'Ready to ask claude', 'The agent will ask you which approach to take, in its own pane.', BUILD);
    await askOpen(at);
    await sheet(at).getByRole('textbox').fill(BUILD);
    await sendTo(at, 'claude');
    await sheet(at).getByRole('button', { name: 'Ask', exact: true }).click();
    await expect(at.page.getByRole('dialog', { name: 'Ready to ask claude' })).toBeVisible();
    at.machine.send({ type: 'resolved', id: 'pnd_1', yes: true });
    await expect(at.page.getByText('Answered on the machine')).toBeVisible();
  } },

  // 05 · Details: a work's Ask in each of its states, as M11.2 draws it now. M5.5–M5.8 and
  // their D twins (the Eval and Seal sections) are superseded by M11.3, M11.4.
  { ids: ['M5.1'], run: (at) => details(at, 'ask_2') },
  { ids: ['M5.2', 'D5.2'], run: (at) => details(at, 'ask_1') },
  { ids: ['M5.3'], run: (at) => details(at, 'ask_3', { ...DETAILS.ask_3, crumb: { eval: null, seal: null }, proceed: true,
    ask: { ...DETAILS.ask_3.ask, aside: 'asked 2026-10-08 10:31 · ready to send', lines: [...DETAILS.ask_3.ask.lines.slice(0, 5), 'not sent yet · ready to send'] } }) },
  { ids: ['M5.4', 'D5.4'], run: (at) => details(at, 'ask_3') },
  { ids: ['M5.9'], sample: () => withTree((t) => t[0].work.open.asks.push({ unit: 'ask_9', title: 'old idea', harness: 'claude', word: 'asked' })),
    run: (at) => details(at, 'ask_9', { ...DETAILS.ask_1, unit: 'ask_9', title: 'old idea', proceed: false, follows: 'ask_9',
      ask: { state: 'DONE', aside: 'asked 2026-10-08 08:30 · cancelled', lines: ['You asked:', 'Try a second login provider', 'How it was sent:', 'cancelled'] } }) },
  { ids: ['M5.10'], run: (at) => details(at, 'ask_3', { ...DETAILS.ask_3, ask: { state: 'DONE', aside: '', lines: ['what you asked is not on disk', 'the prompt is not on disk'] } }) },

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
    // The lines each card draws: the phone's without the return type, indented less.
    const lines = (wide: boolean) => (wide
      ? [[88, ' fn send(&self, msg: &Msg) -> Result<()> {'], [89, '-     let _ = self.sock.write(msg);'], [89, '+     if let Err(e) = self.sock.write(msg) {'],
        [90, '+         log::debug!("send failed");'], [91, '+         return Err(e.into());'], [92, '+     }'], [93, '        Ok(())']]
      : [[88, ' fn send(&self, msg: &Msg) {'], [89, '-   let _ = self.sock.write(msg);'], [89, '+   if let Err(e) = self.sock.write(msg) {'],
        [90, '+     log::debug!("send failed");'], [91, '+     return Err(e.into());'], [92, '+   }'], [93, '     Ok(())']]
    ).map(([n, text]) => ({ n, text, lit: n === 90 }));
    await evalView(at, { ...VIEW, changes: { w_s: lines(at.wide) } });
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
    const claude = { ...SESSIONS[1], turn: 'ready' as const, title: null, asks: 0, ask: { key: 'why.not_set_up', harness: 'claude' } };
    return { ...s, agents: [{ ...s.agents[0], turn: 'ready' }], tree: [{ ...project('weft', [claude]), ask: { key: 'why.not_set_up', harness: 'claude' } }] };
  }, run: async (at) => {
    await tree(at);
    await selected(at, 'claude · no Ask yet');
    // On the phone the bar says it; on a desktop the agent beside the tree does.
    if (!at.wide) {
      await at.page.locator('.tree-acts').getByRole('button', { name: 'Ask', exact: true }).click();
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
    await settingsOpen(at, [{ name: 'laptop' }]);
    await kept(at, { push: true });
    await button(at, 'Menu').click();
    await expect(at.page.getByLabel(/Notifications from studio/)).toBeChecked();
  } },
  { ids: ['D9.1'], run: async (at) => {
    await settingsOpen(at, [{ name: 'laptop' }]);
    await item(at, 'claude · fix login').click();
    await kept(at, { name: 'Mac · Chrome', push: true });
    await button(at, 'Menu').click();
    await expect(at.page.getByLabel(/Notifications from studio/)).toBeChecked();
  } },
  { ids: ['D9.2'], run: async (at) => {
    await settingsOpen(at);
    await kept(at, { name: 'Mac · Chrome' });
    await button(at, 'Menu').click();
    await button(at, 'Settings…').click();
  } },
  { ids: ['M9.2'], run: async (at) => {
    at.machine.vapid = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';
    await settingsOpen(at);
    await button(at, 'Menu').click();
    await at.page.getByLabel(/Notifications from studio/).click();
    await expect(at.page.getByText('Add Weft to your Home Screen first')).toBeVisible();
  } },
  { ids: ['M9.3', 'D9.3'], run: async (at) => {
    // On the phone, as the app on the Home Screen; notifications are blocked for Weft.
    at.machine.vapid = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';
    await at.page.addInitScript(() => {
      Object.defineProperty(navigator, 'standalone', { value: true });
      Notification.requestPermission = async () => 'denied';
    });
    await settingsOpen(at);
    if (at.wide) await item(at, 'claude · fix login').click();
    await button(at, 'Menu').click();
    await at.page.getByLabel(/Notifications from studio/).click();
    await expect(at.page.getByText('Notifications are turned off for Weft in this browser.')).toBeVisible();
  } },
  ...([['M9.4', 'Delete my account'], ['M9.5', 'Sign out'], ['M9.6', 'Forget this device'], ['D9.4', 'Delete my account']] as const).map(([id, act]) => ({
    ids: [id],
    run: async (at: At) => {
      await settingsOpen(at, at.wide ? [] : [{ name: 'laptop' }]);
      await kept(at, at.wide ? { name: 'Mac · Chrome' } : { push: true });
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

  // 11 · Agents and rounds: the cards' moment, docs folded.
  // M11.1: claude selected; the phone's tree from its top.
  { ids: ['M11.1'], run: async (at) => {
    await tree(at);
    await item(at, 'claude · fix login').click();
  } },
  // D11.1: claude open beside the tree, asking; Eval 3 folded so the tree fits. The card's machine has
  // one project, so its tabs are weft's three agents.
  { ids: ['D11.1'], sample: () => { const s = atlas(); return { ...s, agents: s.agents.filter((a) => a.project === 'weft'), tree: s.tree.filter((p) => p.project === 'weft') }; }, run: async (at) => {
    await folded(at, ['weft/evl_3']);
    await onClaude(at, ASKING);
  } },
  { ids: ['M11.2'], run: (at) => details(at, 'ask_1') },
  { ids: ['D11.2'], run: async (at) => {
    await folded(at, ['docs', 'weft/evl_3']);
    await details(at, 'ask_1');
  } },
  { ids: ['M11.3'], run: roundOpen },
  { ids: ['D11.3'], run: async (at) => {
    await folded(at, ['docs', 'weft/open']);
    await roundOpen(at);
  } },
  ...(['M11.4', 'D11.4'] as const).map((id): Screen => ({
    ids: [id],
    run: async (at) => {
      await folded(at, ['docs', 'weft/open', 'weft/evl_3', 'weft/sealed']);
      await tree(at);
      if (at.wide) await item(at, 'Seal 4').click();
      else await item(at, 'Seal 4').getByRole('button', { name: 'Details of Seal 4' }).click();
      await expect(at.page.getByRole('region', { name: 'Seal 4' })).toBeVisible();
    },
  })),
  ...(['M11.5', 'D11.5'] as const).map((id): Screen => ({
    ids: [id],
    run: async (at) => {
      await folded(at, ['docs', 'weft/evl_3']);
      await tree(at);
      if (at.wide) await item(at, 'claude · readme fix').click();
      else await item(at, 'claude · readme fix').getByRole('button', { name: /^Details of/ }).click();
      await expect(at.page.getByRole('region', { name: 'claude · 3f9c2b71…a21e' })).toBeVisible();
    },
  })),
  // A running codex session no agent of Weft's holds, whose resume joins it.
  ...(['M11.9', 'D11.9'] as const).map((id): Screen => ({
    ids: [id],
    sample: () => withTree((t) => {
      const r = t[0].agents.rows[2];
      Object.assign(r, { agent: null, turn: 'working' });
    }),
    run: async (at) => {
      const r = at.machine.tree![0].agents.rows[2];
      at.machine.reads.sessions[r.session] = { session: r.session, harness: 'codex', state: 'running', turn: 'working', started: r.at - 18 * 60_000, last: r.at, resume: true, joins: true,
        asks: [{ unit: 'ask_h', title: 'health endpoint', harness: 'codex', word: 'asked', eval: null, seal: null }], agent: null };
      await folded(at, ['docs', 'weft/evl_3']);
      await tree(at);
      if (at.wide) await item(at, 'codex · health endpoint').click();
      else await item(at, 'codex · health endpoint').getByRole('button', { name: /^Details of/ }).click();
      await expect(at.page.getByText(/^Resume joins codex/)).toBeVisible();
    },
  })),
  ...(['M11.7', 'D11.7'] as const).map((id): Screen => ({
    ids: [id],
    run: async (at) => {
      await folded(at, ['docs', 'weft/evl_3']);
      await tree(at);
      await item(at, '12 earlier sessions').click();
      await expect(at.page.locator('.tree-row--past')).toHaveCount(12);
    },
  })),
  ...(['M11.8', 'D11.8'] as const).map((id): Screen => ({
    ids: [id],
    run: async (at) => {
      await tree(at);
      await at.page.getByRole('searchbox').fill('login');
      await expect(item(at, 'weft')).toContainText('2 match');
    },
  })),

  // 10 · Notices
  { ids: ['M10.1', 'D10.1'], run: async (at) => {
    await folded(at, ['docs']);
    await tree(at);
    if (at.wide) await button(at, 'NEEDS YOU 1').click();
    await at.page.locator('.tree-acts').getByRole('button', { name: 'Eval', exact: true }).click();
    await expect(at.page.getByText('Select Open to Eval its Asks.')).toBeVisible();
  } },
  { ids: ['M10.2', 'D10.2'], sample: calm, run: async (at) => {
    at.machine.onText = (m) => ({ type: 'error', req: m.req, code: 'in_flight', message: 'still typing' });
    await onClaude(at);
    const box = at.page.getByPlaceholder('Message claude…');
    await box.fill('try again');
    // ▶: on a touch screen Enter adds a line (M3.13).
    await at.page.getByRole('button', { name: 'Send', exact: true }).click();
    await expect(at.page.getByText('Weft did not type it: it is still typing the last one.')).toBeVisible();
    // The card's moment: the keyboard put away.
    await box.blur();
  } },
  { ids: ['M10.3'], run: async (at) => {
    await folded(at, ['docs']);
    await tree(at);
    // Turbo on, then docs' claude ends: the notice at the foot of the tree.
    const s = atlas();
    s.tree[0].turbo = true;
    s.agents[3].running = false;
    at.machine.send({ type: 'agents', agents: s.agents });
    at.machine.send({ type: 'tree', tree: s.tree });
    await expect(at.page.getByText('claude has ended. Its work is still on the list.')).toBeVisible();
  } },
  // 13 · Remote that survives: weft alone, as the cards draw it.
  ...(['M13.1', 'D13.1'] as const).map((id): Screen => ({
    ids: [id],
    sample: weftOnly,
    run: async (at) => {
      // Last heard today at 14:02; the machine stops answering.
      const heard = new Date();
      heard.setHours(14, 2, 0, 0);
      await signIn(at.context, person('octo', [{ name: 'studio', address: at.machine.address, seenAt: heard.getTime() }]));
      await at.page.goto('/');
      await expect(at.page.getByRole('tree', { name: 'Work' })).toBeVisible();
      // claude open beside the tree, as the card has it (not `onClaude`, which signs in afresh).
      if (at.wide) {
        await openAgent(at.page, 'claude · fix login');
        await expect.poll(() => at.machine.of('watch').some((m) => m.agent === CLAUDE)).toBe(true);
        const bytes = Buffer.from(WORKING.wide.join('\r\n')).toString('base64');
        at.machine.send({ type: 'screen', agent: CLAUDE, seq: 1, full: true, rows: 30, cols: 117, bytes });
      }
      at.machine.down = true;
      at.machine.drop();
      await expect(at.page.getByRole('status', { name: 'Waiting for the machine' })).toBeVisible({ timeout: 15_000 });
    },
  })),
  ...([['M13.2', 'D13.2', -1], ['M13.3', 'D13.3', 1]] as const).flatMap(([m, d, by]) => [m, d].map((id): Screen => ({
    ids: [id],
    run: async (at) => {
      at.machine.version = FakeMachine.VERSION + by;
      await open(at);
      await expect(at.page.getByRole('heading', { name: by < 0 ? 'Update Weft on studio' : 'Reload this page' })).toBeVisible();
    },
  }))),
  ...(['M13.4', 'D13.4'] as const).map((id): Screen => ({
    ids: [id],
    run: async (at) => {
      at.machine.signedOut = true;
      await open(at);
      await expect(at.page.getByRole('heading', { name: 'Sign in again on studio' })).toBeVisible();
    },
  })),
  ...(['M13.5', 'D13.5'] as const).map((id): Screen => ({
    ids: [id],
    sample: reopened,
    run: async (at) => {
      await tree(at);
      if (at.wide) await item(at, 'claude · fix login').click();
      await expect(at.page.getByRole('note')).toBeVisible();
    },
  })),
  ...(['M13.6', 'D13.6'] as const).map((id): Screen => ({
    ids: [id],
    sample: weftOnly,
    run: async (at) => {
      at.machine.update = '0.2.1';
      // The desktop card has claude open beside the tree.
      if (at.wide) await onClaude(at);
      else await tree(at);
      await expect(at.page.getByRole('status', { name: 'An update waiting' })).toBeVisible();
    },
  })),

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
      const at = { page, context, wide, machine };
      // Every card that draws docs draws it folded; a screen may fold otherwise.
      await folded(at);
      try {
        await s.run!(at);
        await page.waitForTimeout(400);
        await page.screenshot({ path: `${OUT}/${id}.png` });
      } finally {
        await machine.close();
      }
    });
  }
}
