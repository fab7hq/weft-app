// The gallery (`npm run gallery`): every web screen by its number, at its
// frame (390×803 for a phone's M, 1280×754 for a desktop's D), drawn against
// the fake machine and written to gallery/<ID>.png; Toile's `weft` holds each
// as phone/<n> or desktop/<n>. A screen the browser cannot draw (a
// notification the system shows) is written as gallery/<ID>.txt, saying why.
import { mkdirSync, writeFileSync } from 'node:fs';
import { card } from './card';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { FakeMachine, atlas, project, sessionOf, type Agent, type Detail, type Project, type Step, type UnitDetail, type WorkRow, reportOf } from './fake-machine';
import { pull, swipeLeft } from './touch';
import { drawWithDom, openAgent } from './open';
import { person, signIn } from './seed';
import { CLAUDE, CODEX, CODEX_NEW, DETAILS, RULED, RUNNING, SESSIONS, STILL, VIEW, at, large } from './atlas-fixtures';

const OUT = 'gallery';

/** The Seal's five questions, as 17.4 and 17.5 draw them. */
const SEAL_QUESTIONS = [
  { id: 'q1', ask: 'did_you_want', behaviour: 'A failed sign-in now writes the typed email address into the server log.',
    why: 'You said no to this before, and this change brings it back.', against: { decision: 'sel_0/d1', seal: 'sel_0', date: '2026-11-03' } },
  { id: 'q2', ask: 'did_you_want', behaviour: 'The sign-in page remembers the last email address typed on this device.',
    why: 'You weren’t sure last time, so it’s asked again.', asked_before: { decision: 'sel_1/d1', seal: 'sel_1', date: '2026-11-10' } },
  { id: 'q3', ask: 'did_you_want', behaviour: 'Signed-in sessions now end after 1 hour instead of 24 hours.', why: 'No request asked for it.' },
  { id: 'q4', ask: 'still_want', behaviour: 'Staying signed in on this device after the browser closes.', why: 'You asked for it; the change does not do it yet.' },
  { id: 'q5', ask: 'what_did_you_mean', behaviour: 'What you meant by “show an error”.', why: 'It can be read two ways.' },
];
/** 17.29, 17.30: the same five, the third against a rule of the project and the fourth a decision asked again since its file changed. */
const RULED_QUESTIONS = [
  SEAL_QUESTIONS[0], SEAL_QUESTIONS[1],
  { id: 'q3', ask: 'did_you_want', behaviour: 'The email typed at sign-in is written to the server log.', why: 'Nothing you asked for says to.',
    rules: [{ source: './AGENTS.md@3f2a9c1', quote: 'Never write a person’s email or password to a log.' }] },
  { id: 'q4', ask: 'did_you_want', behaviour: 'A session ends after 1 hour without activity.', why: 'You decided this before.',
    asked_before: { decision: 'sel_1/d2', seal: 'sel_1', date: '2026-11-03', answer: 'wanted', stale: true, changed: ['src/session.rs'] } },
  SEAL_QUESTIONS[4],
];
/** 9.15: the person's decisions in weft, newest first, one asked again. */
const decision = (id: string, behaviour: string, answer: string, answer_words: string, tone: string, day: string, files: string[], stale_line: string | null = null) =>
  ({ id, behaviour, answer, answer_words, tone, day, files, stale: stale_line !== null, stale_line });
const DECISIONS = {
  title: 'YOUR DECISIONS', count: '4 · 1 to ask again', changed: 'changed since',
  list: [
    decision('sel_2/d1', 'The sign-in button is off while it sends.', 'wanted', 'Wanted', 'teal', '10 Nov', ['src/login.rs']),
    decision('sel_1/d1', 'Emails are written to the server log.', 'not_wanted', 'Not wanted', 'amber', '3 Nov', ['src/log.rs', 'AGENTS.md']),
    decision('sel_1/d2', 'A session ends after 1 hour without activity.', 'wanted', 'Wanted', 'teal', '3 Nov', ['src/session.rs'],
      'src/session.rs has changed since; the next Eval that touches it asks again'),
    decision('sel_0/d1', 'The health page shows the build number.', 'wanted', 'Wanted', 'teal', '1 Nov', ['plans/weft/plan.md']),
  ],
};
mkdirSync(OUT, { recursive: true });
/** What the read check found in fab7, as 9.13 and 17.28 draw it. */
const SKIP_OUTPUT = { kind: 'untracked_bulk', path: 'output/', files: 329, bytes: 4_000_000, commits: 0, kinds_of_files: [['png', 329]], fix: { file: '.gitignore', line: '/output/' } };
const SKIP_EVIDENCE = {
  kind: 'data_bulk', path: 'research/papers/to-err-is-agentic/evidence/', files: 13708, bytes: 52_000_000, commits: 0, kinds_of_files: [['json', 13708]],
  fix: { file: '.gitattributes', line: 'research/papers/*/evidence/** linguist-generated=true' },
};
const SKIP_MEDIA = { kind: 'committed_media', path: 'marketing/weft/assets/final/', files: 24, bytes: 0, commits: 0, kinds_of_files: [['png', 20], ['mp4', 4]], fix: { file: '.gitattributes', line: 'marketing/weft/assets/final/** linguist-generated=true' } };
const SKIP_DUMP = { kind: 'large_text', path: 'data/dump.sql', files: 1, bytes: 48_000_000, commits: 0, kinds_of_files: [['sql', 1]], fix: { file: '.gitattributes', line: 'data/dump.sql linguist-generated=true' } };


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

/** Settings at one of its sections: a desktop through ☰ › Settings… and its list, a phone
 * through ☰ and its list; Advanced settings turned on first when asked. */
async function settingsAt(at: At, section?: string, advanced = false) {
  await button(at, 'Menu').click();
  if (at.wide) await at.page.getByRole('menu').getByRole('button', { name: 'Settings…' }).click();
  if (advanced) await at.page.getByLabel('Advanced settings').click({ force: true });
  if (!section) return;
  const list = at.wide ? at.page.getByRole('navigation', { name: 'Settings' }) : at.page.locator('.set-list');
  await list.getByRole('button', { name: new RegExp(`^${section}`) }).click();
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
const staging = (agent: string, what: string, why: string, text: string, sends: string | null = null) => (m: Record<string, unknown>) => [
  { type: 'pending', id: 'pnd_1', agent, what, why, text, sends },
  { type: 'ok', req: m.req, pending: 'pnd_1' },
];

/** Eval on fix login, or Seal on health endpoint, from the tree's bar. */
async function roundAct(at: At, act: 'Eval' | 'Seal' = 'Eval') {
  await tree(at);
  await item(at, act === 'Eval' ? 'fix login' : 'health endpoint').click();
  await at.page.locator('.tree-acts').getByRole('button', { name: act, exact: true }).click();
}

/** A unit of work's Details, from the tree: › on a phone, a click on a desktop. */
async function workOpen(at: At, title: string) {
  await tree(at);
  if (at.wide) await item(at, title).click();
  else await item(at, title).getByRole('button', { name: `Details of ${title}` }).click();
  await expect(at.page.locator('.workflow')).toBeVisible();
}

/** A step of the open unit's workflow, by its name. */
const step = (at: At, name: string) => at.page.locator('.workflow').getByRole('button', { name, exact: true });

/** An Ask's Details, read as this payload, from its step in its unit's workflow. */
async function details(at: At, unit: string, d: Detail = DETAILS[unit]) {
  at.machine.reads.details[unit] = d;
  const units = at.machine.reads.units;
  const owner = Object.values(units).find((u) => u.steps.some((x) => x.step === 'ask' && x.unit === unit))
    ?? (units[unit] = { unit, title: d.title, harness: d.harness, status: { state: 'asked' }, aside: '', steps: [{ step: 'ask', unit, title: d.title, follow_up: false, aside: '' }], follows: unit, eval: null, seal: null });
  await workOpen(at, owner.title);
  await step(at, d.title).click();
  await expect(at.page.getByRole('region', { name: d.title }).locator('.crumbs')).toBeVisible();
}

/** Eval 3's Details, from health endpoint's breadcrumb. */
async function roundOpen(at: At) {
  await details(at, 'ask_3');
  await at.page.locator('.crumbs').first().getByRole('button', { name: /^Eval 3/ }).click();
  await expect(at.page.getByRole('region', { name: 'Eval 3' })).toBeVisible();
}

async function evalView(at: At, view: Record<string, unknown> = VIEW) {
  at.machine.reads.views.evl_3 = view;
  await roundOpen(at);
  await button(at, 'Eval view').click();
  await expect(at.page.getByRole('region', { name: 'Eval view' }).locator('.ev-row').first()).toBeVisible();
}

/** An item of the Eval view, by its line. */
const itemOf = (at: At, text: string) => at.page.locator('.ev-row', { hasText: text }).first();

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
/** Pick an agent of weft in SEND TO, by its harness: rows are named as tabs. */
async function sendTo(at: At, harness: string) {
  await sheet(at).getByRole('button', { name: /^SEND TO/ }).click();
  await sheet(at).getByRole('option', { name: `weft · ${harness}`, exact: true }).first().click();
}

/** Eval on fix login (or Seal on health endpoint) from the tree's bar; on a desktop with claude open beside it. */
async function barOn(at: At, act: 'Eval' | 'Seal' = 'Eval') {
  await folded(at);
  if (at.wide) {
    await agentOpen(at, 'claude');
    await item(at, act === 'Eval' ? 'fix login' : 'health endpoint').click();
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
/** claude's turn ended: the same work, its reply done. */
const DONE = {
  wide: ['● Read(src/login.rs)', '● Update(src/login.rs)', '  ⎿ Updated src/login.rs with 12 additions and 3 removals', '● Running cargo test…', '  test login::rejects_expired ... ok', '  test login::refreshes_token ... ok', '', '● Done. Both login tests pass.', '', '❯'],
  phone: ['● Read(src/login.rs)', '● Update(src/login.rs)', '  ⎿ Updated src/login.rs with', '    12 additions and 3 removals', '● Running cargo test…', '  test login::rejects_expired ok', '  test login::refreshes_token ok', '', '● Done. Both login tests pass.', '', '❯'],
};
/** The agent cards' moment with claude's turn ended, its work going on to Eval. */
const done = () => withTree((t, a) => {
  a.splice(2);
  a[0].turn = 'ended';
  a[0].next = 'eval';
  t[0].needs = 0;
  t[0].agents.rows[1].turn = 'turn_ended';
});
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

/** The 12 cards' machine: claude waiting on its question, and codex. */
const twelve = () => ({ ...atlas(), agents: atlas().agents.slice(0, 2) });

/** claude's screen at the 12 cards' moment: the same turn, as its terminal draws it. */
const TWELVE = {
  wide: ['> Refresh the token before it expires, not after', '', "● I'll update src/login.rs so the session token refreshes 60 s before expiry, then run", '  the login tests.', '', '● Read(src/login.rs)', '  ⎿ Read 84 lines', '● Update(src/login.rs)', '  ⎿ Updated src/login.rs with 12 additions and 3 removals', '● Bash(cargo test -p app-core)', '  ⎿ test result: ok. 12 passed; 0 failed', '● Bash(cargo clippy)', '  ⎿ Finished `dev` profile', '', '● Done. The token now refreshes 60 s early; cargo test passes (12 tests). One question:', '  should a failed refresh retry, or sign the person out?', '', '─'.repeat(94), '❯ '],
  phone: ['● Read(src/login.rs)', '● Update(src/login.rs)', '  ⎿ Updated src/login.rs with', '    12 additions and 3 removals', '● Running cargo test…', '  test login::rejects_expired ok', '  test login::refreshes_token ok', '● Bash(cargo clippy)', '', '● Done. The token now refreshes 60 s', '  early; cargo test passes (12', '  tests). One question: should a', '  failed refresh retry, or sign the', '  person out?', '', '❯'],
};

/** claude's agent, in Conversation. */
async function conversing(at: At) {
  await agentOpen(at, 'claude');
  await at.page.getByRole('tab', { name: 'Conversation' }).first().click();
  await expect(at.page.getByText('Refresh the token before it expires, not after')).toBeVisible();
}

/** The sample of the cards of agents across projects: gl with codex at work and
 * claude ready, openbox with claude waiting for you. */
const GL_CODEX = 'a0c1d2e3f4a5-0';
const OPENBOX_CLAUDE = 'b0c1d2e3f4a5-0';
function across(): ReturnType<typeof atlas> {
  const since = Date.now() - 120_000;
  const agents: Agent[] = [
    { agent: GL_CODEX, project: 'gl', harness: 'codex', title: 'Codex', turn: 'working', running: true, since },
    { agent: 'a0c1d2e3f4a5-1', project: 'gl', harness: 'claude', title: 'Claude Code', turn: 'ready', running: true, since },
    { agent: OPENBOX_CLAUDE, project: 'openbox', harness: 'claude', title: 'Claude Code', turn: 'waiting', running: true, since },
  ];
  const rows = [{ ...sessionOf(agents[0], 'health endpoint'), at: at(11, 31) }, { ...sessionOf(agents[1]), at: at(11, 2) }, { ...sessionOf(agents[2], 'billing export'), at: at(11, 29) }];
  const tree = [project('gl', rows.slice(0, 2), {}, { open: 1 }), project('openbox', rows.slice(2), {}, { open: 2 })];
  return { ...atlas(), agents, tree, harnesses: [] };
}
const ACROSS: Record<string, string[]> = {
  [GL_CODEX]: ['● Running cargo test…', '  test health::answers_200 ... ok', '  test health::reports_version ... ok', '', '✻ Working… (esc to interrupt)', '', '›'],
  [OPENBOX_CLAUDE]: ['● Write(src/billing.rs)', '  Do you want to make this edit to billing.rs?', BLUE('  ❯ 1. Yes'), "    2. Yes, and don't ask again this session", '    3. No, and tell Claude what to do differently'],
};
/** The across sample with twelve agents, a tab strip that overflows: each project runs every harness once. */
function many(): ReturnType<typeof atlas> {
  const a = across();
  const since = Date.now() - 120_000;
  const more: [string, string, string][] = [['gl', 'agy', 'Antigravity'], ['gl', 'grok', 'Grok'],
    ['openbox', 'codex', 'Codex'], ['openbox', 'agy', 'Antigravity'], ['openbox', 'grok', 'Grok'],
    ['docs', 'claude', 'Claude Code'], ['docs', 'codex', 'Codex'], ['docs', 'agy', 'Antigravity'], ['docs', 'grok', 'Grok']];
  a.tree.push(project('docs', [], {}, { open: 0 }));
  more.forEach(([name, harness, title], n) => {
    const agent: Agent = { agent: `d0c1d2e3f4a5-${n}`, project: name, harness, title, turn: 'ready', running: true, since };
    a.agents.push(agent);
    const p = a.tree.find((t) => t.project === name)!;
    p.agents.rows.push({ ...sessionOf(agent), at: at(11, 40 + n) });
    p.agents.running += 1;
  });
  return a;
}
/** The across sample with docs' codex and claude running too. */
function withDocs(): ReturnType<typeof atlas> {
  const a = across();
  const since = Date.now() - 120_000;
  a.agents.push(
    { agent: 'c0c1d2e3f4a5-0', project: 'docs', harness: 'codex', title: 'Codex', turn: 'ready', running: true, since },
    { agent: 'c0c1d2e3f4a5-1', project: 'docs', harness: 'claude', title: 'Claude Code', turn: 'ready', running: true, since },
  );
  return a;
}
const tab = (at: At, name: string) => at.page.getByRole('navigation', { name: 'Tabs' }).getByRole('button', { name: new RegExp(`^${name}`) });
/** Pick an item of the layout menu of the pane holding that tab. */
async function layout(at: At, item: string, holding: string) {
  // Split, the layout is for the pane you are in, from the bar above the panes.
  await tab(at, holding).click();
  await at.page.getByRole('button', { name: 'Layout', exact: true }).first().click();
  await at.page.getByRole('menuitem', { name: item, exact: true }).click();
}
/** The pane you are in, active, as the cards draw it: the bar reads Ask · Keys. */
const inPane = (at: At) => at.page.locator('.pane-box--current, .panes:not(.panes--many) .pane-box').first().getByLabel('The agent', { exact: true }).click();
/** As the two-pane card lays them out: gl's two on the left, gl · codex shown; openbox · claude on the right, the pane you are in. */
async function twoPanes(at: At) {
  await tree(at);
  await item(at, 'claude · billing export').click();
  await layout(at, 'Split right', 'openbox · claude');
  await tab(at, 'gl · codex').click();
  await tab(at, 'openbox · claude').click();
  await drawn(at, GL_CODEX);
  await drawn(at, OPENBOX_CLAUDE);
  await inPane(at);
}
/** Draw the cards' lines on an agent's screen, once it is watched. */
async function drawn(at: At, agent: string) {
  const beside = (m?: Record<string, unknown>) => [m?.also ?? []].flat() as { agent?: string }[];
  const watched = (m?: Record<string, unknown>) => m?.agent === agent || beside(m).some((a) => a.agent === agent);
  await expect.poll(() => watched(at.machine.of('watch').at(-1))).toBe(true);
  at.machine.send({ type: 'screen', agent, seq: 1, full: true, rows: 30, cols: 60, bytes: Buffer.from(ACROSS[agent].join('\r\n')).toString('base64') });
}

/** The 17 cards' Ask sheet: a rule or practice as the machine offers it. */
const rule = (id: string, label: string, text: string) => ({ id, label, text, family: null, layer: 'practice' });
const PLAN = { slug: 'build-number', path: 'plans/build-number/plan.md', title: 'Build number' };
const ROUTES = ['native_goal', 'native_plan', 'native_direct'];
const PRACTICES = [
  rule('practice.yagni', 'YAGNI', 'Add a capability only when a present requirement needs it; leave out options, parameters, and extension points that nobody has asked for.'),
  rule('practice.testing_pyramid', 'Testing Pyramid', 'Write the failing test from the requirement first and make it pass with the smallest change.'),
  rule('practice.knuth', 'Knuth', 'Do not optimize on suspicion; measure first, and optimize the measured bottleneck only.'),
  rule('practice.kiss', 'KISS', 'Write readable code: choose clear names and short functions.'),
  rule('practice.dry', 'DRY', 'Keep one source for each piece of knowledge.'),
];
/** 17.1: the route, plan and practices picked for the words. */
const SHEET = {
  routes: ROUTES, route: 'native_goal', tasks: ['implement'], task: 'implement', plan: PLAN, plans: [PLAN],
  route_rules: [
    rule('claude.step_loop', 'Step Loop', 'Work the plan’s steps one at a time, in its order.'),
    rule('claude.done_check', 'Done Check', 'Show each check as you run it: the command and its result.'),
  ],
  practices: PRACTICES, proposed: null, senses: false,
};
/** 17.22: no route picked for the words; two practices proposed of nine. */
const UNSURE = {
  ...SHEET, route: null, plan: null, route_rules: [], senses: true, proposed: ['practice.root_cause', 'practice.testing_pyramid'],
  practices: [rule('practice.root_cause', 'Root Cause', 'Prove the failing mechanism and remove it; no retries, watchdogs or restarts that hide it.'), ...PRACTICES,
    rule('practice.postel', 'Postel', 'Be strict in what you produce.'), rule('practice.hyrum', 'Hyrum', 'Treat every observable behaviour as relied on.'), rule('practice.gall', 'Gall', 'Grow a working simple system.')],
};
/** 17.13: a fix's sheet, for codex. */
const FIX_SHEET = {
  ...SHEET, plan: null, plans: [], route_rules: [], proposed: null,
  practices: [rule('practice.minimal_diff', 'Minimal diff', 'For a fix, change only what the fix needs.'), rule('practice.verify', 'Verify', 'Run the checks before you say it is done.')],
};
const UNKNOWN = 'The health check sometimes says the build is unknown. Can you look at it?';
/** 17.2: the exact prompt RingFrame composed. */
const PROMPT = `/goal ${BUILD}\n\nPlan: plans/build-number/plan.md\n\nRules:\nWhile implementing:\n- YAGNI: Add a capability only when a present requirement needs it; leave out options, parameters, and extension points that nobody has asked for, and remove code that no current path uses.\n- Testing Pyramid: Write the failing test from the requirement first and make it pass with the smallest change.\n- Knuth: Do not optimize on suspicion; measure first, and optimize the measured bottleneck only.\nFor this route:\n- Step Loop: Work the plan's steps one at a time, in its order.\n- Done Check: Show each check as you run it: the command and its result.`;

/** Ask, over claude's view, with these words, to claude. */
async function asked(at: At, words: string) {
  await askOpen(at);
  await sheet(at).getByRole('textbox').fill(words);
  if (at.wide) await sendTo(at, 'claude');
}

/** A dialog the machine stages for an act, which types nothing; its yes as it names it. */
const staged = (agent: string, what: string, why: string, go: { word: string; warn: boolean }) => (m: Record<string, unknown>) => [
  { type: 'pending', id: 'pnd_1', agent, what, why, text: '', sends: null, go },
  { type: 'ok', req: m.req, pending: 'pnd_1' },
];

/** health endpoint's Details, as 17.4–17.17 draw it: two Asks, Eval 2, and its Seal or none. */
const ALIGNED = { step: 'eval', eval: 'evl_2', n: 2, report: reportOf('nothing'), aside: 'read 11:20 · Nothing to look at · 5 settled' } as const;
const DRIFTED = { step: 'eval', eval: 'evl_2', n: 2, report: reportOf('found'), aside: 'read 11:20 · 1 thing to look at · 4 settled' } as const;
const health = (status: WorkRow['status'], judged: Step, sealed: Step | null, offers?: ('follow_up' | 'undo')[]): UnitDetail => ({
  unit: 'ask_3', title: 'health endpoint', harness: 'codex', status, aside: '2 Asks · codex · since 10:52',
  steps: [
    { step: 'ask', unit: 'ask_3', title: 'Add a health endpoint that reports the build number', follow_up: false, aside: 'codex · sent 10:52' },
    { step: 'ask', unit: 'ask_5', title: 'Return 503 while the database is down', follow_up: true, aside: 'codex · sent 11:04' },
    judged, sealed ?? { step: 'not_sealed' },
  ],
  follows: 'evl_2', eval: null, seal: null, ...(offers ? { offers } : {}),
});
/** 17.25, 17.26: weft alone, codex at work on health endpoint, and the two works the cards draw. */
const waiting = () => {
  const s = withTree((t) => {
    t.splice(1);
    t[0].needs = 0;
    t[0].agents = { ...t[0].agents, running: 1, ended: 0, earlier: 0, rows: t[0].agents.rows.filter((r) => r.agent === CODEX) };
    t[0].work = { units: t[0].work.units.filter((u) => u.unit === 'ask_3' || u.unit === 'ask_4'), earlier: 0 };
  });
  return { ...s, agents: s.agents.filter((a) => a.agent === CODEX) };
};
/** The sample with health endpoint sealed. */
const sealedAs = (decision: string) => () => withTree((t) => (t[0].work.units[1].status = { state: 'sealed', decision }));
/** 17.13: a follow-up's words, from what Eval 2 found. */
const REMEDY = { words: 'Fix what the last Eval found:\n- not met: Return 503 while the database is down\n- unexplained change: src/db/pool.rs rewrites the retry loop', eval: 'evl_2', n: 2 };
/** 17.17: the commits Undo offers, newest first, down to where the work started. */
const COMMITS = ([
  ['e81b7c2', 'Return 503 while the database is down', '11:18'],
  ['a40c9f3', "Fix the probe's timeout", '11:17'],
  ['2d8e6b1', 'Retry the database probe once before answering 503, with a short back-off so a blip does not page anyone', '11:16'],
  ['c03f5aa', "Log the health check's database probe", '11:15'],
  ['91d4e07', 'Wire the build number into the release script', '11:11'],
  ['5be2a19', "Test the health endpoint's JSON", '11:07'],
  ['7ab3d10', 'Add a health endpoint that reports the build number', '11:02'],
  ['4f2a9c1', 'Tidy the router before the health work', '10:49'],
] as const).map(([short, subject, when]) => ({ id: `${short}${'0'.repeat(33)}`, short, subject, when, start: short === '4f2a9c1' }));
/** 17.18: the Done list, parked first. */
const DONE_ROWS = ([
  ['readme fix', 'claude', 'parked', 'waiting on something', 'aligned', '2026-10-24T09:40:00Z', true],
  ['health endpoint', 'codex', 'rejected', 'broke something', 'drifted', '2026-10-25T11:32:00Z', false],
  ['build number', 'codex', 'accepted', null, 'aligned', '2026-10-25T10:40:00Z', false],
  ['login redirect', 'claude', 'dropped', 'superseded', 'incomplete', '2026-10-24T16:10:00Z', false],
  ['rate limit headers', 'codex', 'rejected', 'not what I asked', 'drifted', '2026-10-23T15:02:00Z', false],
  ['telemetry opt-out', 'claude', 'accepted', null, 'aligned', '2026-10-23T10:12:00Z', false],
  ['session timeout', 'codex', 'accepted', null, 'aligned', '2026-10-22T14:30:00Z', false],
  ['dark mode tokens', 'claude', 'rejected', 'wrong approach', 'drifted', '2026-10-21T11:05:00Z', false],
  ['retry the upload', 'codex', 'accepted', null, 'aligned', '2026-10-20T09:15:00Z', false],
] as const).map(([title, harness, decision, reason, verdict, when, parked], i) => ({
  unit: title === 'health endpoint' ? 'ask_3' : `ask_d${i}`, title, harness, decision, reason,
  report: reportOf(({ aligned: 'nothing', drifted: 'found', incomplete: 'unsettled' } as const)[verdict]), at: when, parked,
}));
/** 17.6, 6.7: the Eval's one judge at work. */
const judging = () => {
  const s = atlas();
  const since = Date.now() - 60_000;
  s.agents.push({ agent: 'j0b1c2d3e4f5-1', project: 'weft', harness: 'claude', title: 'Claude', turn: 'working', running: true, since, judge: 'evl_3' } as Agent);
  return s;
};

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
  { ids: ['M2.1', 'D2.1'], sample: () => ({ ...atlas(), agents: [], tree: [{ ...project('weft', []), ask: { key: 'why.start_an_agent' } }] }), run: async (at) => {
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
  // The Mac's 104 columns on a phone: smaller to fit, down to 9 px, then sideways.
  { ids: ['M3.14'], sample: calm, run: async (at) => {
    await agentOpen(at, 'claude');
    await expect.poll(() => at.machine.of('watch').some((m) => m.agent === CLAUDE)).toBe(true);
    const wide = ['● Read(src/login.rs)', '● Update(src/login.rs)', "  ⎿ Updated src/login.rs with 12 additions and 3 removals; the expiry check now reads the token's own clock", '● Running cargo test -p auth -- login::rejects_expired login::refreshes_token --nocapture', '  test login::rejects_expired ... ok', '  test login::refreshes_token ... ok', '', '✻ Thinking… (esc to interrupt) · 1m 12s · ↓ 2.4k tokens', '', '❯'];
    at.machine.send({ type: 'screen', agent: CLAUDE, seq: 1, full: true, rows: 30, cols: 104, bytes: Buffer.from(wide.join('\r\n')).toString('base64') });
    await expect(at.page.locator('.pane-bar--h')).toBeVisible();
  } },
  { ids: ['M3.3', 'D3.3'], sample: calm, run: async (at) => {
    await onClaude(at);
    await activate(at);
  } },
  { ids: ['M3.4', 'D3.4'], sample: () => ({ ...calm(), agents: atlas().agents.slice(0, 2) }), run: (at) => onClaude(at, ASKING) },

  // 16 · The next act.
  { ids: ['D16.3'], sample: done, run: async (at) => {
    await onClaude(at, DONE);
    await expect(at.page.locator('.tree-act--put-eval')).toBeVisible();
  } },
  { ids: ['M16.3'], sample: done, run: async (at) => {
    await tree(at);
    await item(at, 'claude · fix login').click();
    await expect(at.page.locator('.tree-act--put-eval')).toBeVisible();
  } },
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
    await at.page.getByRole('button', { name: 'Fn', exact: true }).click();
  } },
  { ids: ['M3.11'], sample: calm, run: async (at) => {
    await onClaude(at);
    await button(at, 'Fn').click();
    await button(at, 'Ctrl').click();
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
  ...([
    ['M4.6', 'D4.6', CODEX, 'Ready to send', 'This is the exact wording. Weft will not change it.', 'Implement /health: read BUILD_NUMBER from the environment at startup; fall back to "unknown". Add a test …'],
    ['M4.7', '', CODEX, 'Ready to send', 'This is the exact wording. Weft will not change it.\ncodex asked you about this and never got an answer, so it is still waiting. Sending it records your yes first.', 'Implement /health: read BUILD_NUMBER …'],
  ] as const).map(([m, d, agent, what, why, text]): Screen => ({
    ids: [m, d].filter(Boolean),
    run: async (at) => {
      // A send's bar has SEND TO; the card shows it open.
      const sends = what === 'Ready to send' ? 'ask_3' : null;
      at.machine.onAct = staging(agent, what, why, text, sends);
      await barOn(at, what.startsWith('Seal') ? 'Seal' : 'Eval');
      const bar = at.page.getByRole('dialog', { name: what });
      await expect(bar).toBeVisible();
      if (m === 'M4.6') await bar.getByRole('button', { name: /^SEND TO/ }).click();
    },
  })),
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
  { ids: ['M5.9'], sample: () => withTree((t) => t[0].work.units.push({ unit: 'ask_9', title: 'old idea', harness: 'claude', status: { state: 'asked' }, asks: 1, eval: null, seal: null })),
    run: (at) => details(at, 'ask_9', { ...DETAILS.ask_1, unit: 'ask_9', title: 'old idea', proceed: false, follows: 'ask_9',
      ask: { state: 'DONE', aside: 'asked 2026-10-08 08:30 · cancelled', lines: ['You asked:', 'Try a second login provider', 'How it was sent:', 'cancelled'] } }) },
  { ids: ['M5.10'], run: (at) => details(at, 'ask_3', { ...DETAILS.ask_3, ask: { state: 'DONE', aside: '', lines: ['what you asked is not on disk', 'the prompt is not on disk'] } }) },

  // 06 · The Eval view: the items, one chosen; an item's detail; its lines; what each read said; still reading.
  { ids: ['M6.1', 'D6.1'], run: async (at) => {
    await evalView(at);
    // A phone marks the item last opened.
    if (!at.wide) {
      await itemOf(at, 'Asked before · remembers the last email').click();
      await button(at, '‹ Items').click();
    }
  } },
  { ids: ['M6.3'], run: async (at) => {
    await evalView(at);
    await itemOf(at, 'Asked before · remembers the last email').click();
  } },
  { ids: ['M6.4', 'D6.4'], run: async (at) => {
    await evalView(at);
    await itemOf(at, 'The typed email goes into the server log').click();
  } },
  { ids: ['M6.5', 'D6.5'], run: async (at) => {
    await evalView(at);
    await itemOf(at, 'Sessions end after 1 hour, not 24').click();
    await button(at, 'The lines that show it ›').click();
    await expect(at.page.locator('.ev-code').first()).toBeVisible();
  } },
  { ids: ['M6.6'], run: async (at) => {
    await evalView(at);
    await itemOf(at, '“Show an error” — the reads differ').click();
    await button(at, 'What each read said ›').click();
  } },
  { ids: ['M6.7', 'D6.7'], sample: judging, run: (at) => evalView(at, STILL) },
  // 6.8: a change against a rule of the project; 6.9: one a rule settled before, that rule changed since.
  ...([['6.8', 'Against a rule · the typed email is logged'], ['6.9', 'Failed sign-ins kept 90 days · its rule has changed']] as const).map(([n, line]): Screen => ({
    ids: [`M${n}`, `D${n}`],
    run: async (at) => {
      await evalView(at, RULED);
      await itemOf(at, line).click();
      await expect(at.page.locator('.ev-detail .rule-block')).toBeVisible();
    },
  })),

  // 07 · A harness not set up: it broke after its agent started (as T3.8).
  { ids: ['M7.1', 'D7.1'], sample: () => {
    const s = atlas();
    const claude = { ...SESSIONS[1], turn: 'ready' as const, title: null, asks: 0, ask: { key: 'why.not_set_up', harness: 'claude' } };
    return { ...s, agents: [{ ...s.agents[0], turn: 'ready' }], tree: [{ ...project('weft', [claude]), ask: { key: 'why.not_set_up', harness: 'claude' } }] };
  }, run: async (at) => {
    await tree(at);
    await selected(at, 'claude · no Ask yet');
    // On the phone the Ask sheet says it, and asks anyway; on a desktop the agent beside the tree does.
    if (!at.wide) {
      await at.page.locator('.tree-acts').getByRole('button', { name: 'Ask', exact: true }).click();
      await expect(at.page.getByText('claude is not set up for RingFrame. Set it up on studio from ☰ › Updates…')).toBeVisible();
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

  // 09 · Settings: a project's own (9.12–9.15), starting an agent (9.7), and this device's
  // notifications and leaving (9.2–9.6), now in Settings › This device & account.
  { ids: ['M9.12', 'D9.12'], run: async (at) => {
    await settingsOpen(at);
    await at.page.getByRole('button', { name: "weft's settings" }).first().click();
    await expect(at.page.getByText('RingFrame · Hyrum')).toBeVisible();
  } },
  // 9.13, 9.14: weft's settings, with what an Eval there should skip, and with nothing to.
  ...([['9.13', [SKIP_OUTPUT, SKIP_EVIDENCE, SKIP_MEDIA, SKIP_DUMP]], ['9.14', []]] as const).map(([n, findings]): Screen => ({
    ids: [`M${n}`, `D${n}`],
    run: async (at) => {
      at.machine.skip = { weft: [...findings] };
      await settingsOpen(at);
      await at.page.getByRole('button', { name: "weft's settings" }).first().click();
      await expect(at.page.getByRole('region', { name: 'FILES AN EVAL SHOULD SKIP' })).toBeVisible();
      await at.page.getByRole('region', { name: 'FILES AN EVAL SHOULD SKIP' }).scrollIntoViewIfNeeded();
    },
  })),
  // 9.15: weft's settings, with the person's decisions.
  { ids: ['M9.15', 'D9.15'], run: async (at) => {
    at.machine.decisions = { weft: DECISIONS };
    await settingsOpen(at);
    await at.page.getByRole('button', { name: "weft's settings" }).first().click();
    const section = at.page.getByRole('region', { name: 'YOUR DECISIONS' });
    await expect(section.locator('.dec-changed')).toBeVisible();
    await section.scrollIntoViewIfNeeded();
  } },
  { ids: ['M9.2'], run: async (at) => {
    at.machine.vapid = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';
    await settingsOpen(at);
    await settingsAt(at, 'This device & account');
    await at.page.getByLabel(/Notifications on this device/).click();
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
    await settingsAt(at, 'This device & account');
    await at.page.getByLabel(/Notifications on this device/).click();
    await expect(at.page.getByText('Notifications are turned off for Weft in this browser.')).toBeVisible();
  } },
  ...([['M9.4', 'Delete my account'], ['M9.5', 'Sign out'], ['M9.6', 'Forget this device'], ['D9.4', 'Delete my account']] as const).map(([id, act]) => ({
    ids: [id],
    run: async (at: At) => {
      await settingsOpen(at, at.wide ? [] : [{ name: 'laptop' }]);
      await kept(at, at.wide ? { name: 'Mac · Chrome' } : { push: true });
      await settingsAt(at, 'This device & account');
      await button(at, act).click();
      await expect(at.page.getByRole('dialog')).toBeVisible();
    },
  })),
  { ids: ['M9.7', 'D9.7'], run: async (at) => {
    await tree(at);
    await button(at, 'Start an agent in weft').click();
    await expect(at.page.getByRole('radiogroup', { name: 'Start an agent' })).toBeVisible();
  } },

  // 19 · Settings for everyone: ☰, then a section; Advanced settings shows the rest in place.
  { ids: ['M19.1'], run: async (at) => {
    await settingsOpen(at);
    await settingsAt(at);
  } },
  { ids: ['D19.1'], run: async (at) => {
    await settingsOpen(at, [{ name: 'laptop' }]);
    await item(at, 'claude · fix login').click();
    await button(at, 'Menu').click();
  } },
  { ids: ['M19.11'], run: async (at) => {
    await settingsOpen(at);
    await settingsAt(at, undefined, true);
  } },
  ...([['19.2', 'General', false], ['19.3', 'Eval', false], ['19.4', 'Eval', true], ['19.5', 'Rules', false], ['19.7', 'Agent apps', false]] as const).map(([n, section, advanced]): Screen => ({
    ids: [`M${n}`, `D${n}`],
    run: async (at) => {
      await settingsOpen(at);
      await settingsAt(at, section, advanced);
    },
  })),
  { ids: ['M19.6'], run: async (at) => {
    await settingsOpen(at);
    await settingsAt(at, 'Rules');
    await at.page.getByRole('button', { name: /^Software development/ }).click();
  } },
  ...([['D19.6', 'Rules'], ['D19.8', 'Agent apps']] as const).map(([id, section]): Screen => ({
    ids: [id],
    run: async (at) => {
      await settingsOpen(at);
      await settingsAt(at, section, true);
    },
  })),
  { ids: ['M19.9', 'D19.9'], run: async (at) => {
    await settingsOpen(at, at.wide ? [] : [{ name: 'laptop' }]);
    await kept(at, { name: 'Mac · Chrome', push: true });
    await settingsAt(at, 'This device & account');
  } },
  { ids: ['M19.10', 'D19.10'], run: async (at) => {
    at.machine.settings = { ...at.machine.settings, effective: { ...(at.machine.settings.effective as object), keep_days: 10 } };
    await settingsOpen(at);
    await settingsAt(at, 'General');
    await expect(at.page.getByRole('textbox', { name: 'days' })).toHaveValue('10');
  } },

  // 11 · Agents and rounds: the cards' moment, docs folded.
  // M11.1: claude selected; the phone's tree from its top.
  { ids: ['M11.1'], run: async (at) => {
    await tree(at);
    await item(at, 'claude · fix login').click();
  } },
  // D11.1: claude open beside the tree, asking. The card's machine has
  // one project, so its tabs are weft's three agents.
  { ids: ['D11.1'], sample: () => { const s = atlas(); return { ...s, agents: s.agents.filter((a) => a.project === 'weft'), tree: s.tree.filter((p) => p.project === 'weft') }; }, run: async (at) => {
    await folded(at, []);
    await onClaude(at, ASKING);
  } },
  { ids: ['M11.2'], run: (at) => details(at, 'ask_1') },
  // WORK as units of work, and a unit's workflow.
  { ids: ['M11.10'], run: async (at) => {
    await folded(at, ['docs']);
    await tree(at);
  } },
  // Each agent's row on two lines: its name, then its harness, state and time.
  { ids: ['M11.12'], run: async (at) => {
    await folded(at, ['docs']);
    await tree(at);
  } },
  { ids: ['D11.12'], run: async (at) => {
    await folded(at, ['docs']);
    await agentOpen(at, 'codex');
  } },
  { ids: ['D11.10'], run: async (at) => {
    await folded(at, ['docs']);
    await agentOpen(at, 'codex');
  } },
  ...(['M11.11', 'D11.11'] as const).map((id): Screen => ({
    ids: [id],
    run: async (at) => {
      await folded(at, ['docs']);
      await workOpen(at, 'health endpoint');
    },
  })),
  { ids: ['D11.2'], run: async (at) => {
    await folded(at, ['docs']);
    await details(at, 'ask_1');
  } },
  { ids: ['M11.3'], run: roundOpen },
  { ids: ['D11.3'], run: async (at) => {
    await folded(at, ['docs']);
    await roundOpen(at);
  } },
  // 11.16: Eval 3's Details with what its readers counted and did not read.
  ...(['M11.16', 'D11.16'] as const).map((id): Screen => ({
    ids: [id],
    run: async (at) => {
      at.machine.reads.evals.evl_3 = { ...at.machine.reads.evals.evl_3, not_read: [
        { kind: 'generated', folder: 'research/papers/to-err-is-agentic/evidence/', files: 13708 },
        { kind: 'binary', folder: 'marketing/weft/assets/final/', files: 12 },
        { kind: 'binary', folder: 'weft-app/web/public/', files: 4 },
        { kind: 'binary', folder: 'site/', files: 2 },
        { kind: 'binary', folder: 'logo.png', files: 1 },
        { kind: 'lock', folder: 'weft/Cargo.lock', files: 1 },
        { kind: 'lock', folder: 'weft-app/package-lock.json', files: 1 },
      ] } as typeof at.machine.reads.evals.evl_3;
      await folded(at, ['docs']);
      await roundOpen(at);
      await expect(at.page.getByRole('region', { name: 'Not read' })).toBeVisible();
    },
  })),
  ...(['M11.4', 'D11.4'] as const).map((id): Screen => ({
    ids: [id],
    run: async (at) => {
      await folded(at, ['docs']);
      await workOpen(at, 'readme fix');
      await step(at, 'Seal 4').click();
      await expect(at.page.getByRole('region', { name: 'Seal 4' })).toBeVisible();
    },
  })),
  ...(['M11.5', 'D11.5'] as const).map((id): Screen => ({
    ids: [id],
    run: async (at) => {
      await folded(at, ['docs']);
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
      await folded(at, ['docs']);
      await tree(at);
      if (at.wide) await item(at, 'codex · health endpoint').click();
      else await item(at, 'codex · health endpoint').getByRole('button', { name: /^Details of/ }).click();
      await expect(at.page.getByText(/^Resume joins codex/)).toBeVisible();
    },
  })),
  ...(['M11.7', 'D11.7'] as const).map((id): Screen => ({
    ids: [id],
    run: async (at) => {
      await folded(at, ['docs']);
      await tree(at);
      await item(at, 'Earlier sessions').click();
      await expect(at.page.locator('.tree-row--past')).toHaveCount(12);
    },
  })),
  // 11.13: earlier sessions a page at a time: the first 50 listed, and Show 50 more under them.
  ...(['M11.13', 'D11.13'] as const).map((id): Screen => ({
    ids: [id],
    sample: () => {
      const s = atlas();
      s.reads.earlier.weft = large().earlier.slice(0, 120);
      s.tree[0].agents.earlier = 120;
      return s;
    },
    run: async (at) => {
      await folded(at, ['docs']);
      await tree(at);
      await item(at, 'Earlier sessions').click();
      await expect(at.page.locator('.tree-row--past')).toHaveCount(50);
      await at.page.locator('.tree-row--show-more').scrollIntoViewIfNeeded();
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
    await expect(at.page.getByText('Select a work to Eval it.')).toBeVisible();
  } },
  { ids: ['M10.2', 'D10.2'], sample: calm, run: async (at) => {
    at.machine.onText = (m) => ({ type: 'error', req: m.req, code: 'in_flight', message: 'still typing' });
    await onClaude(at);
    // A desktop's one row names the agent's tab (D15.1).
    const box = at.page.getByPlaceholder(at.page.viewportSize()!.width >= 768 ? 'Message weft · claude…' : 'Message claude…');
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

  // 14 · Agents across projects
  { ids: ['D14.1'], sample: across, run: async (at) => {
    await tree(at);
    await openAgent(at.page, 'codex · health endpoint');
    await drawn(at, GL_CODEX);
    await activate(at);
  } },
  // 15 · Panes and tabs like an editor
  { ids: ['D15.1'], sample: across, run: async (at) => {
    await twoPanes(at);
  } },
  // Twelve agents: every tab has its ✕, the strip scrolls, the tab in front is in view.
  { ids: ['D15.5'], sample: many, run: async (at) => {
    await tree(at);
    await item(at, 'claude · billing export').click();
    await drawn(at, OPENBOX_CLAUDE);
    await inPane(at);
  } },
  { ids: ['D15.6'], sample: many, run: async (at) => {
    await twoPanes(at);
  } },
  { ids: ['D15.7'], sample: across, run: async (at) => {
    await twoPanes(at);
    await button(at, 'Hide the list').click();
  } },
  // The Mac shows openbox · claude in a narrow pane: the agent is 46 columns, drawn at its own size.
  { ids: ['D3.14'], sample: across, run: async (at) => {
    // Its wait reads the agent's text, which WebGL draws in a canvas.
    await drawWithDom(at.page);
    await twoPanes(at);
    const narrow = ['● Write(src/billing.rs)', '  Do you want to make this edit', '  to billing.rs?', '  ❯ 1. Yes', "    2. Yes, and don't ask again", '       this session', '    3. No, and tell Claude what', '       to do differently'];
    at.machine.send({ type: 'screen', agent: OPENBOX_CLAUDE, seq: 2, full: true, rows: 24, cols: 46, bytes: Buffer.from(narrow.join('\r\n')).toString('base64') });
    await expect(at.page.getByText('to do differently')).toBeVisible();
  } },
  { ids: ['D15.2'], sample: across, run: async (at) => {
    await tree(at);
    await openAgent(at.page, 'codex · health endpoint');
    await drawn(at, GL_CODEX);
    await inPane(at);
    await button(at, 'Layout').click();
    await expect(at.page.getByRole('menu', { name: 'Layout' })).toBeVisible();
  } },
  { ids: ['D15.3'], sample: withDocs, run: async (at) => {
    await tree(at);
    await item(at, 'claude · billing export').click();
    await layout(at, 'Split right', 'openbox · claude');
    // gl · claude below gl · codex; docs' two to the right, docs · codex below openbox · claude.
    const moves: [string, string][] = [
      ['gl · claude', 'Split down'],
      ['docs · codex', 'Move tab to the next pane'],
      ['docs · claude', 'Move tab to the next pane'],
      ['docs · codex', 'Split down'],
      ['docs · claude', 'Move tab to the next pane'],
      ['docs · claude', 'Move tab to the next pane'],
    ];
    for (const [name, item] of moves) {
      await tab(at, name).click();
      await layout(at, item, name);
    }
    await expect(at.page.locator('.pane-box')).toHaveCount(4);
    await tab(at, 'docs · codex').click();
    await drawn(at, GL_CODEX);
    await drawn(at, OPENBOX_CLAUDE);
    await inPane(at);
    await layout(at, 'Split right', 'docs · codex');
    await expect(at.page.getByText('Four panes at most.', { exact: false })).toBeVisible();
  } },
  { ids: ['D15.4'], sample: across, run: async (at) => {
    await twoPanes(at);
    // gl · codex shown from its row, selected in the tree as the card draws it.
    await item(at, 'codex · health endpoint').click();
    await inPane(at);
    // gl · claude held over the right pane's lower fifth, not yet let go.
    const from = (await tab(at, 'gl · claude').boundingBox())!;
    const to = (await at.page.locator('.pane-box').nth(1).boundingBox())!;
    await at.page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await at.page.mouse.down();
    await at.page.mouse.move(from.x + from.width / 2 + 12, from.y + from.height / 2 + 6);
    await at.page.mouse.move(to.x + to.width / 2, to.y + to.height * 0.85, { steps: 8 });
    await at.page.mouse.move(to.x + to.width / 2, to.y + to.height * 0.86);
    await expect(at.page.locator('.drop-zone--down')).toBeVisible();
  } },
  // 12 · Terminal and Conversation: claude in weft waits on its question.
  { ids: ['M12.1', 'D12.1', 'M12.4'], sample: twelve, run: conversing },
  { ids: ['M12.2', 'D12.2'], sample: twelve, run: async (at) => {
    await conversing(at);
    await at.page.getByRole('button', { name: /^▸ 4 tool steps/ }).click();
    await expect(at.page.getByText('cargo clippy')).toBeVisible();
  } },
  { ids: ['M12.3', 'D12.3'], sample: twelve, run: (at) => onClaude(at, TWELVE) },
  { ids: ['M14.1'], sample: across, run: async (at) => {
    await tree(at);
    await openAgent(at.page, 'codex · health endpoint');
    await drawn(at, GL_CODEX);
  } },
  { ids: ['M14.2'], sample: across, run: async (at) => {
    await tree(at);
    await openAgent(at.page, 'codex · health endpoint');
    await drawn(at, GL_CODEX);
    await at.page.locator('.agent-name').click();
    await expect(at.page.getByRole('dialog', { name: 'Agents' })).toBeVisible();
  } },

  // 17 · Ask with a route, plan and rules; Eval and Seal in one dialog each; after a Seal.
  ...(['M17.1', 'D17.1'] as const).map((id): Screen => ({ ids: [id], run: async (at) => {
    at.machine.sheet = () => SHEET;
    await asked(at, BUILD);
    await expect(sheet(at).getByText('Step Loop')).toBeVisible();
  } })),
  ...(['M17.2', 'D17.2'] as const).map((id): Screen => ({ ids: [id], run: async (at) => {
    at.machine.sheet = () => SHEET;
    at.machine.onAct = staging(CLAUDE, 'Ask claude?', 'This is exactly what claude will receive.', PROMPT);
    await asked(at, BUILD);
    await expect(sheet(at).getByText('Step Loop')).toBeVisible();
    await sheet(at).getByRole('button', { name: 'Ask', exact: true }).click();
    await expect(at.page.getByRole('dialog', { name: 'Ask claude?' })).toBeVisible();
  } })),
  ...(['M17.3', 'D17.3'] as const).map((id): Screen => ({ ids: [id], run: async (at) => {
    // What it reads: 3 commits and 14 files since its first Ask this morning.
    const reads = { since: 'ask', when: new Date(new Date().setHours(9, 12, 0, 0)).toISOString(), commits: 3, files: 14, skipped: { generated: 1, binary: 1 }, large: false };
    const stage = staged(CODEX, 'Eval this work?', 'health endpoint · 2 Asks\nclaude reads the whole change against what you asked, and reads again only where it is unsure.\nNothing is typed into the agent’s pane.', { word: 'act.eval', warn: false });
    at.machine.onAct = (m) => stage(m).map((o) => (o.type === 'pending' ? { ...o, reads } : o));
    await folded(at);
    if (at.wide) await agentOpen(at, 'codex');
    else await tree(at);
    await item(at, 'health endpoint').click();
    await at.page.locator('.tree-acts').getByRole('button', { name: 'Eval', exact: true }).click();
    await expect(at.page.getByRole('dialog', { name: 'Eval this work?' })).toBeVisible();
  } })),
  // 17.28: the dialog once output/ was ignored, the evidence still to mark and a nested repository said.
  ...(['M17.28', 'D17.28'] as const).map((id): Screen => ({ ids: [id], run: async (at) => {
    const reads = {
      since: 'ask', when: '2026-11-08T10:00:00Z', commits: 52, files: 13852, files_before: 14181, skipped: { generated: 0, vendored: 0, binary: 19, lock: 2 },
      folder: 'research/papers/to-err-is-agentic/evidence/', folder_files: 13708, large: true,
      findings: [{ ...SKIP_OUTPUT, added: true }, SKIP_EVIDENCE, { kind: 'sub_repo', path: 'homepage/', files: 12, bytes: 0, commits: 0, kinds_of_files: [], fix: null }],
    };
    const stage = staged(CODEX, 'Eval this work?', 'health endpoint · 2 Asks\nclaude reads the whole change against what you asked, and reads again only where it is unsure.\nNothing is typed into the agent’s pane.', { word: 'act.eval', warn: false });
    at.machine.onAct = (m) => stage(m).map((o) => (o.type === 'pending' ? { ...o, reads } : o));
    await folded(at);
    if (at.wide) await agentOpen(at, 'codex');
    else await tree(at);
    await item(at, 'health endpoint').click();
    await at.page.locator('.tree-acts').getByRole('button', { name: 'Eval', exact: true }).click();
    await expect(at.page.getByRole('dialog', { name: 'Eval this work?' }).locator('.skip-row--added')).toBeVisible();
  } })),
  // 17.31: the Eval dialog of fix login, with health endpoint begun on top of it: it reads fix login's own change.
  ...(['M17.31', 'D17.31'] as const).map((id): Screen => ({ ids: [id], run: async (at) => {
    const today = (h: number, m: number) => new Date(new Date().setHours(h, m, 0, 0)).toISOString();
    const reads = { since: 'ask', when: today(9, 12), commits: 2, files: 6, skipped: {}, large: false, until: { ask: 'ask_3', title: 'health endpoint', time: today(10, 40) } };
    const stage = staged(CLAUDE, 'Eval this work?', 'fix login · 2 Asks\nclaude reads the whole change against what you asked, and reads again only where it is unsure.\nNothing is typed into the agent’s pane.', { word: 'act.eval', warn: false });
    at.machine.onAct = (m) => stage(m).map((o) => (o.type === 'pending' ? { ...o, reads } : o));
    await barOn(at);
    const dialog = at.page.getByRole('dialog', { name: 'Eval this work?' });
    await expect(dialog.getByText('claude reads this work’s own change', { exact: false })).toBeVisible();
    await expect(dialog.getByText('health endpoint', { exact: false }).first()).toBeVisible();
  } })),
  // 17.25: Eval's yes, still opening: its steps, the files read so far and the bar filled by the share done.
  ...(['M17.25', 'D17.25'] as const).map((id): Screen => ({ ids: [id], sample: waiting, run: async (at) => {
    const stage = staged(CODEX, 'Eval this work?', 'health endpoint · 2 Asks\nclaude reads the whole change against what you asked, and reads again only where it is unsure.\nNothing is typed into the agent’s pane.', { word: 'act.eval', warn: false });
    at.machine.onAct = (m) => stage(m).map((o) => (o.type === 'pending' ? { ...o, reads: { since: 'ask', when: new Date(new Date().setHours(9, 12, 0, 0)).toISOString(), commits: 3, files: 14, skipped: {}, large: false } } : o));
    // The yes is never answered: the Eval is still opening.
    let req: unknown = null;
    at.machine.onResolve = (m) => ((req = m.yes ? m.req : req), []);
    await folded(at);
    if (at.wide) await agentOpen(at, 'codex');
    else await tree(at);
    await item(at, 'health endpoint').click();
    await at.page.locator('.tree-acts').getByRole('button', { name: 'Eval', exact: true }).click();
    await at.page.getByRole('dialog', { name: 'Eval this work?' }).getByRole('button', { name: 'Eval', exact: true }).click();
    await expect.poll(() => req).not.toBeNull();
    at.machine.send({ type: 'progress', project: 'weft', req, job: {
      id: 'job_5', kind: 'eval_open', on: { work: 'ask_3' }, age_ms: 18_000, share: 0.2,
      steps: [
        { key: 'step.reading_change', state: 'now', ms: 18_000, done: 38, total: 103, unit: 'files', args: { new: '9' } },
        { key: 'step.dividing', state: 'next' },
        { key: 'step.preparing_readers', state: 'next' },
        { key: 'step.starting_readers', state: 'next', args: { harness: 'Claude Code' } },
        { key: 'step.waiting_ready', state: 'next', args: { agent: 'Claude Code' } },
      ],
    } });
    await expect(at.page.getByRole('dialog', { name: 'Opening the Eval…' }).locator('.wait-step-count')).toHaveText('38 of 103 files · 9 of them new');
  } })),
  // 17.26: Seal's yes, still sealing: its steps, the files read as they are now, and the bar.
  ...(['M17.26', 'D17.26'] as const).map((id): Screen => ({ ids: [id], sample: waiting, run: async (at) => {
    // The act is never answered: the Seal is still under way.
    let req: unknown = null;
    at.machine.onAct = (m) => ((req = m.req), []);
    await folded(at);
    if (at.wide) await agentOpen(at, 'codex');
    else await tree(at);
    await item(at, 'health endpoint').click();
    await at.page.locator('.tree-acts').getByRole('button', { name: 'Seal', exact: true }).click();
    await at.page.getByRole('dialog', { name: 'Seal this work?' }).getByRole('button', { name: 'Seal', exact: true }).click();
    await expect.poll(() => req).not.toBeNull();
    at.machine.send({ type: 'progress', project: 'weft', req, job: {
      id: 'job_7', kind: 'seal', on: { work: 'ask_3' }, age_ms: 9_000, share: 0.4,
      steps: [
        { key: 'step.checking_work', state: 'done', ms: 2_000 },
        { key: 'step.reading_files_now', state: 'now', ms: 7_000, done: 8412, total: 15902, unit: 'files' },
        { key: 'step.writing_decision', state: 'next' },
        { key: 'step.noting_git', state: 'next' },
      ],
    } });
    await expect(at.page.getByRole('dialog', { name: 'Sealing…' }).locator('.wait-step-count')).toHaveText('8,412 of 15,902 files');
  } })),
  // 11.14: a Seal's Details while its receipt is checked, the files counted, the rest still coming.
  ...(['M11.14', 'D11.14'] as const).map((id): Screen => ({ ids: [id], run: async (at) => {
    // Its facts come at once; RingFrame's check of its receipt is never answered.
    at.machine.onRead = (m) => (m.what === 'receipt' ? { type: 'noop' } : null);
    await tree(at);
    const unit = item(at, 'readme fix');
    if (at.wide) await unit.click();
    else await unit.getByRole('button', { name: 'Details of readme fix' }).click();
    await at.page.locator('.workflow').getByRole('button', { name: 'Seal 4', exact: true }).click();
    at.machine.send({ type: 'progress', project: 'weft', job: {
      id: 'job_8', kind: 'seal_check', on: { seal: 'rcp_7f3a2c' }, age_ms: 3_000, share: 0.53,
      steps: [{ key: 'step.reading_files_now', state: 'now', ms: 3_000, done: 8412, total: 15902, unit: 'files' }],
    } });
    await expect(at.page.locator('.wait-fact .wait-fact-count')).toHaveText('8,412 of 15,902 files');
  } })),
  // 11.15: the same Seal's receipt could not be checked: why, in amber, and Try again.
  ...(['M11.15', 'D11.15'] as const).map((id): Screen => ({ ids: [id], run: async (at) => {
    at.machine.onRead = (m) => (m.what === 'receipt' ? { type: 'error', req: m.req, code: 'refused', message: "RingFrame could not read the Seal's record (seals/seal_01M7….json is missing)" } : null);
    await tree(at);
    const unit = item(at, 'readme fix');
    if (at.wide) await unit.click();
    else await unit.getByRole('button', { name: 'Details of readme fix' }).click();
    await at.page.locator('.workflow').getByRole('button', { name: 'Seal 4', exact: true }).click();
    await expect(at.page.getByRole('alert').getByRole('button', { name: 'Try again', exact: true })).toBeVisible();
  } })),
  // 17.27: the Eval dialog of a large change: what it reads, the amber note and Eval anyway.
  { ids: ['D17.27'], run: async (at) => {
    const reads = {
      since: 'ask', when: '2026-11-08T10:00:00Z', commits: 52, files: 13852, skipped: {},
      folder: 'research/papers/to-err-is-agentic/evidence/', folder_files: 13708, large: true,
    };
    const stage = staged(CODEX, 'Eval this work?', 'health endpoint · 2 Asks\nclaude reads the whole change against what you asked, and reads again only where it is unsure.\nNothing is typed into the agent’s pane.', { word: 'act.eval', warn: false });
    at.machine.onAct = (m) => stage(m).map((o) => (o.type === 'pending' ? { ...o, reads } : o));
    await folded(at);
    await agentOpen(at, 'codex');
    await item(at, 'health endpoint').click();
    await at.page.locator('.tree-acts').getByRole('button', { name: 'Eval', exact: true }).click();
    await expect(at.page.getByRole('dialog', { name: 'Eval this work?' }).getByRole('button', { name: 'Eval anyway', exact: true })).toBeVisible();
  } },
  ...([['M17.4', false], ['D17.4', false], ['M17.5', true], ['D17.5', true]] as const).map(([id, why]): Screen => ({
    ids: [id],
    sample: () => withTree((t) => (t[0].work.units[1].status = { state: 'evaluated', report: reportOf('found') })),
    run: async (at) => {
      at.machine.reads.units.ask_3 = health({ state: 'evaluated', report: reportOf('found') }, DRIFTED, null);
      at.machine.reads.questions = { ask_3: SEAL_QUESTIONS };
      if (at.wide) {
        await workOpen(at, 'health endpoint');
        await at.page.locator('.detail-acts').getByRole('button', { name: 'Seal', exact: true }).click();
      } else {
        await tree(at);
        await item(at, 'health endpoint').click();
        await at.page.locator('.tree-acts').getByRole('button', { name: 'Seal', exact: true }).click();
      }
      // 17.4 is the second of five questions, answered; 17.5 the review of all five with the decision.
      const dialog = at.page.getByRole('dialog', { name: 'Seal health endpoint' });
      await expect(dialog).toBeVisible();
      const next = dialog.getByRole('button', { name: 'Next', exact: true });
      const pick = async (label: string) => {
        await dialog.locator('.seal-label').waitFor();
        await dialog.getByRole('radio', { name: label, exact: true }).click();
      };
      await pick('Not wanted');
      await next.click();
      await pick('Not wanted');
      if (!why) return;
      await next.click();
      await pick('I wanted this');
      await next.click();
      await pick('Later');
      await next.click();
      await pick('Not sure');
      await next.click();
      await expect(dialog.getByRole('heading', { name: 'Your answers' })).toBeVisible();
      await dialog.getByRole('radiogroup', { name: 'Decision' }).getByRole('radio', { name: 'Rejected' }).click();
      await dialog.getByRole('radiogroup', { name: 'Why' }).getByRole('radio', { name: 'Not what I asked' }).click();
    },
  })),
  // 17.29: the third question, against a rule of the project, answered; 17.30: the fourth, a decision asked again since its file changed.
  ...([['M17.29', 3], ['D17.29', 3], ['M17.30', 4], ['D17.30', 4]] as const).map(([id, n]): Screen => ({
    ids: [id],
    sample: () => withTree((t) => (t[0].work.units[1].status = { state: 'evaluated', report: reportOf('found') })),
    run: async (at) => {
      at.machine.reads.units.ask_3 = health({ state: 'evaluated', report: reportOf('found') }, DRIFTED, null);
      at.machine.reads.questions = { ask_3: RULED_QUESTIONS };
      if (at.wide) {
        await workOpen(at, 'health endpoint');
        await at.page.locator('.detail-acts').getByRole('button', { name: 'Seal', exact: true }).click();
      } else {
        await tree(at);
        await item(at, 'health endpoint').click();
        await at.page.locator('.tree-acts').getByRole('button', { name: 'Seal', exact: true }).click();
      }
      const dialog = at.page.getByRole('dialog', { name: 'Seal health endpoint' });
      await expect(dialog).toBeVisible();
      const next = dialog.getByRole('button', { name: 'Next', exact: true });
      const pick = async (label: string) => {
        await dialog.locator('.seal-label').waitFor();
        await dialog.getByRole('radio', { name: label, exact: true }).click();
      };
      await pick('Not wanted');
      await next.click();
      await pick('Not wanted');
      await next.click();
      await expect(dialog.locator('.seal-rule')).toBeVisible();
      await pick('Not wanted');
      if (n === 3) return;
      await next.click();
      await expect(dialog.locator('.seal-file')).toHaveText('src/session.rs');
      await pick('I wanted this');
    },
  })),
  ...(['M17.6', 'D17.6'] as const).map((id): Screen => ({ ids: [id], sample: judging, run: async (at) => {
    await evalView(at, RUNNING);
    // Its readers' job: each step's time, and the reads counted on the one under way.
    at.machine.send({ type: 'progress', project: 'weft', job: { id: 'job_r', kind: 'readers', on: { work: 'ask_3', eval: 'evl_3' }, age_ms: 271_000, steps: [
      { key: 'step.a', state: 'done', ms: 6_000 }, { key: 'step.b', state: 'now', ms: 265_000, done: 3, total: 7, unit: 'reads' }, { key: 'step.c', state: 'next' }, { key: 'step.d', state: 'next' },
    ] } });
    await expect(at.page.locator('.wait-step-count')).toHaveText('3 of 7 read');
  } })),
  ...(['M17.10', 'D17.10'] as const).map((id): Screen => ({ ids: [id], sample: judging, run: async (at) => {
    at.machine.onAct = staged(CODEX, 'Stop this Eval?', 'The judges of Build account erasure stop, and the Eval is voided.', { word: 'dialog.stop_eval.go', warn: true });
    await evalView(at, RUNNING);
    await button(at, 'Stop Eval').click();
    await expect(at.page.getByRole('dialog', { name: 'Stop this Eval?' })).toBeVisible();
  } })),
  ...(['M17.11', 'D17.11'] as const).map((id): Screen => ({ ids: [id], sample: sealedAs('accepted'), run: async (at) => {
    at.machine.reads.units.ask_3 = health({ state: 'sealed', decision: 'accepted' }, ALIGNED, { step: 'seal', seal: 'sel_8k2', n: 2, decision: 'accepted', aside: '11:32 · by you' }, []);
    await workOpen(at, 'health endpoint');
  } })),
  ...(['M17.12', 'D17.12', 'M17.13', 'D17.13', 'M17.17', 'D17.17'] as const).map((id): Screen => ({ ids: [id], sample: sealedAs('rejected'), run: async (at) => {
    at.machine.reads.units.ask_3 = health({ state: 'sealed', decision: 'rejected' }, DRIFTED, { step: 'seal', seal: 'sel_8k2', n: 2, decision: 'rejected', reason: 'broke something', aside: '11:32 · by you' }, ['follow_up', 'undo']);
    at.machine.onRead = (m) => (m.what === 'remedy' ? { type: 'ok', req: m.req, remedy: REMEDY } : m.what === 'commits' ? { type: 'ok', req: m.req, commits: { commits: COMMITS } } : null);
    at.machine.sheet = () => FIX_SHEET;
    await workOpen(at, 'health endpoint');
    if (id.endsWith('17.13')) {
      await button(at, 'Follow up').click();
      await expect(sheet(at).getByText('Minimal diff')).toBeVisible();
    }
    if (id.endsWith('17.17')) {
      await button(at, 'Undo').click();
      await expect(at.page.getByRole('dialog', { name: 'Undo this work?' })).toBeVisible();
    }
  } })),
  ...(['M17.18', 'D17.18'] as const).map((id): Screen => ({ ids: [id], run: async (at) => {
    at.machine.onRead = (m) => (m.what === 'done' ? { type: 'ok', req: m.req, done: { total: DONE_ROWS.length, rows: DONE_ROWS, next: null } } : null);
    await tree(at);
    await at.page.getByRole('treeitem', { name: /sealed earlier/ }).click();
    await expect(at.page.getByRole('tree', { name: 'Done' })).toBeVisible();
    // The desktop card has the first sealed row's work open beside the list.
    if (at.wide) {
      at.machine.reads.units.ask_3 = health({ state: 'sealed', decision: 'rejected' }, DRIFTED, { step: 'seal', seal: 'sel_8k2', n: 2, decision: 'rejected', reason: 'broke something', aside: '11:32 · by you' }, ['follow_up', 'undo']);
      await item(at, 'health endpoint').click();
      await expect(at.page.locator('.workflow')).toBeVisible();
    }
  } })),
  ...(['M17.19', 'D17.19'] as const).map((id): Screen => ({ ids: [id], run: async (at) => {
    await settingsOpen(at);
    await at.page.getByRole('button', { name: "weft's settings" }).first().click();
    await at.page.getByText('Git note', { exact: true }).click();
    await expect(at.page.getByRole('dialog', { name: 'Record Seals as Git notes?' })).toBeVisible();
  } })),
  ...(['M17.22', 'D17.22'] as const).map((id): Screen => ({ ids: [id], run: async (at) => {
    at.machine.sheet = () => UNSURE;
    await asked(at, UNKNOWN);
    await expect(sheet(at).getByText('Pick a route to ask.')).toBeVisible();
  } })),
  ...(['M17.23', 'D17.23'] as const).map((id): Screen => ({ ids: [id], run: async (at) => {
    // Sense answers the empty sheet, then reads the words and has not answered yet.
    at.machine.sheet = (q) => (q.words ? null : UNSURE);
    await askOpen(at);
    if (at.wide) await sendTo(at, 'claude');
    await expect.poll(() => at.machine.of('settings').some((m) => m.what === 'ask' && String(m.unit).includes('"claude"'))).toBe(true);
    await expect(sheet(at).getByText('Pick a route to ask.')).toBeVisible();
    await sheet(at).getByRole('textbox').fill(UNKNOWN);
    await expect(sheet(at).getByText('Sensing your best fit…')).toBeVisible();
  } })),
  // 17.24: one amber line beside the acts, never a stop. Weft reads codex as not set up
  // (as the card), or RingFrame alone will not draft its Ask; and the same line in 17.3 and 17.4.
  ...(['M17.24', 'D17.24', 'M17.24-refused', 'D17.24-refused'] as const).map((id): Screen => ({ ids: [id],
    sample: () => withTree((t) => {
      if (id.endsWith('refused')) return;
      t[0].agents.rows.filter((r) => r.harness === 'codex').forEach((r) => (r.ask = { key: 'why.not_set_up', harness: 'codex' }));
    }),
    run: async (at) => {
      at.machine.sheetRefused = { codex: 'codex has no RingFrame plugin.' };
      await folded(at);
      await agentOpen(at, 'codex');
      if (at.wide) await at.page.locator('.tree-acts').getByRole('button', { name: 'Ask', exact: true }).click();
      else await at.page.locator('.appbar').getByRole('button', { name: 'Ask', exact: true }).click();
      await sheet(at).getByRole('textbox').fill(UNKNOWN);
      await expect(sheet(at).locator('.ask-hint')).toHaveText(id.endsWith('refused')
        ? 'This agent may not take an Ask: codex has no RingFrame plugin.'
        : 'codex is not set up for RingFrame. Set it up on studio from ☰ › Updates…');
    },
  })),
  ...(['M17.24-eval', 'D17.24-eval', 'M17.24-seal', 'D17.24-seal'] as const).map((id): Screen => ({ ids: [id],
    sample: () => withTree((t) => {
      const u = t[0].work.units[1];
      u.status = { state: 'evaluated', report: reportOf('found') };
      Object.assign(u, { eval: { key: 'why.not_set_up', harness: 'codex' }, seal: { key: 'why.not_set_up', harness: 'codex' } });
    }),
    run: async (at) => {
      const name = id.endsWith('eval') ? 'Eval this work?' : 'Seal this work?';
      at.machine.onAct = staged(CODEX, 'Eval this work?', 'health endpoint · 2 Asks\nclaude reads the whole change against what you asked, and reads again only where it is unsure.\nNothing is typed into the agent’s pane.', { word: 'act.eval', warn: false });
      await folded(at);
      if (at.wide) await agentOpen(at, 'codex');
      else await tree(at);
      await item(at, 'health endpoint').click();
      await at.page.locator('.tree-acts').getByRole('button', { name: id.endsWith('eval') ? 'Eval' : 'Seal', exact: true }).click();
      await expect(at.page.getByRole('dialog', { name }).locator('.ask-hint')).toHaveText('codex is not set up for RingFrame. Set it up on studio from ☰ › Updates…');
    },
  })),
  { ids: ['M17.20', 'M17.21'], note: 'A push notification, drawn by the phone itself; e2e/desktop-push.spec.ts checks that a push shows and opens where it says.' },
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
        // `CARDS=1 npm run gallery`: each screen as a Toile card too.
        if (process.env.CARDS) {
          mkdirSync(`${OUT}/cards`, { recursive: true });
          writeFileSync(`${OUT}/cards/${id}.html`, await card(page, id));
        }
      } finally {
        await machine.close();
      }
    });
  }
}
