import { reportOf } from './fake-machine';
// The Atlas's sample (cards M11.x, D11.x; spec/atlas.md §6), as the machine
// sends it on the remote protocol: the project weft's sessions and units of work, and
// what each read answers. Shared by the fake machine, the specs and the gallery.
import type { Ask, Detail, Earlier, EvalDetail, Reads, SealDetail, Session, SessionDetail, UnitDetail, Found, WorkRow } from './fake-machine';

/** A time on the cards' day, 2026-10-08 (a Thursday), as the machine sends one. */
export const at = (h: number, m: number, day = 8) => Date.UTC(2026, 9, day, h, m);

export const WEFT = '3f9a1c07b2de';
export const DOCS = 'a1b2c3d4e5f6';
/** The tabs: claude waiting on fix login, codex whose turn ended on health endpoint, codex at work with no Ask yet. */
export const CLAUDE = `${WEFT}-0`;
export const CODEX = `${WEFT}-1`;
export const CODEX_NEW = `${WEFT}-2`;

/** The ended claude session readme fix was asked in (M11.5). */
export const README_SESSION = '3f9c2b71-5d0e-4c8a-9b1f-7e2d6c40a21e';

const session = (id: string, harness: string, state: Session['state'], turn: Session['turn'], title: string | null, when: number, asks: number, agent: string | null): Session => ({
  session: id, harness, state, turn, title, at: when, asks, agent,
  ask: state === 'ended' ? { key: 'why.ended', harness } : state === 'quiet' ? { key: 'why.quiet', harness } : null,
});

/** AGENTS, newest first: the three running, then the last 3 ended (M11.1, D11.1). */
export const SESSIONS: Session[] = [
  session('0199c2f0-7a1b-7c3d-8e9f-0a1b2c3d4e5f', 'codex', 'running', 'working', null, at(11, 31), 0, CODEX_NEW),
  session('8b2e4f60-1c3d-4e5f-a6b7-c8d9e0f1a2b3', 'claude', 'running', 'waiting', 'fix login', at(11, 29), 2, CLAUDE),
  session('0199c1d4-2b3c-7d4e-9f50-61a2b3c4d5e6', 'codex', 'running', 'turn_ended', 'health endpoint', at(10, 52), 2, CODEX),
  session(README_SESSION, 'claude', 'ended', null, 'readme fix', at(9, 12), 1, null),
  session('0199c0a8-3c4d-7e5f-8a61-72b3c4d5e6f7', 'codex', 'ended', null, 'lint pass', at(8, 30), 1, null),
  session('c7d8e9f0-a1b2-4c3d-8e4f-5a6b7c8d9e0f', 'claude', 'ended', null, null, at(8, 2), 0, null),
];

const ask = (unit: string, title: string, harness: string, word?: Ask['word']): Ask => (word ? { unit, title, harness, word } : { unit, title, harness });

/** A unit of work's row. */
const unit = (id: string, title: string, harness: string, status: WorkRow['status'], asks = 1, why: Partial<Pick<WorkRow, 'eval' | 'seal'>> = {}): WorkRow =>
  ({ unit: id, title, harness, status, asks, open: status.state === 'sealed' ? 0 : asks, eval: why.eval ?? null, seal: why.seal ?? null });
const closed = (title: string) => ({ key: 'why.closed', title });

/** WORK: fix login asked; health endpoint and its follow-up build number, judged by Eval 3; telemetry asking; readme fix sealed by Seal 4. */
export const UNITS: WorkRow[] = [
  unit('ask_1', 'fix login', 'claude', { state: 'asked' }, 1, { seal: { key: 'why.no_eval', title: 'fix login' } }),
  unit('ask_3', 'health endpoint', 'codex', { state: 'evaluated', report: reportOf('nothing') }, 2),
  unit('ask_2', 'telemetry', 'claude', { state: 'asking' }, 1, { seal: { key: 'why.no_eval', title: 'telemetry' } }),
  unit('ask_4', 'readme fix', 'claude', { state: 'sealed', decision: 'accepted' }, 2, { eval: closed('readme fix'), seal: closed('readme fix') }),
];
/** Eval 3's Asks: health endpoint and its follow-up. */
const EVAL_3_ASKS: Ask[] = [ask('ask_3', 'health endpoint', 'codex'), ask('ask_5', 'build number', 'codex')];

/** The 12 ended sessions past the tree's, as D11.6 lists them. */
export const EARLIER: Earlier[] = ([
  ['0199b3e7-4a5b-7c6d-8e7f-90a1b2c3d4e5', 'codex', 'flaky test', 7, 40, 8, 'today'],
  ['c2d05e3b-6f7a-4b8c-9d0e-1f2a3b4c5d6e', 'claude', null, 7, 15, 8, 'today'],
  ['9e41aa06-7b8c-4d9e-8f0a-1b2c3d4e5f60', 'claude', 'eval view rows', 17, 40, 7, 'yesterday'],
  ['0199a011-8c9d-7e0f-9a1b-2c3d4e5f6071', 'codex', 'pane resize', 16, 2, 7, 'yesterday'],
  ['51b7c9d0-9d0e-4f1a-8b2c-3d4e5f607182', 'claude', 'session list api', 14, 15, 7, 'yesterday'],
  ['01999e55-0e1f-7a2b-8c3d-4e5f60718293', 'codex', null, 11, 20, 7, 'yesterday'],
  ['7d22e1f8-1f2a-4b3c-9d4e-5f60718293a4', 'claude', 'turn-state map', 18, 22, 6, 'week'],
  ['5c7e2a91-2a3b-4c4d-8e5f-60718293a4b5', 'claude', 'docs links', 15, 10, 6, 'week'],
  ['e6f03b19-3b4c-4d5e-9f60-718293a4b5c6', 'claude', 'notify on wait', 11, 47, 6, 'week'],
  ['01997a2d-4c5d-7e6f-8071-8293a4b5c6d7', 'codex', 'ci cache', 17, 5, 5, 'week'],
  ['38ab51c6-5d6e-4f70-8182-93a4b5c6d7e8', 'claude', 'theme tokens', 14, 30, 5, 'week'],
  ['a0f2d7e4-6e7f-4081-9293-a4b5c6d7e8f9', 'claude', null, 9, 12, 5, 'week'],
] as const).map(([id, harness, title, h, m, day, group]) => ({ session: id, harness, title, asks: title ? 1 : 0, at: at(h, m, day), group }));

/** The sealed units past the tree's, newest first. */
export const SEALED_ROWS: WorkRow[] = [
  unit('ask_7', 'lint pass', 'codex', { state: 'sealed', decision: 'accepted' }, 1, { eval: closed('lint pass'), seal: closed('lint pass') }),
  unit('ask_8', 'session list api', 'claude', { state: 'sealed', decision: 'deferred' }, 3, { eval: closed('session list api'), seal: closed('session list api') }),
  unit('ask_9', 'turn-state map', 'claude', { state: 'sealed', decision: 'accepted' }, 1, { eval: closed('turn-state map'), seal: closed('turn-state map') }),
  unit('ask_10', 'ci cache', 'codex', { state: 'sealed', decision: 'rejected' }, 2, { eval: closed('ci cache'), seal: closed('ci cache') }),
];

/** A unit of work's Details: health endpoint, judged and not sealed; readme fix, sealed. */
export const UNIT_DETAILS: Record<string, UnitDetail> = {
  ask_1: {
    unit: 'ask_1', title: 'fix login', harness: 'claude', status: UNITS[0].status, aside: '1 Ask · claude · since 11:29',
    steps: [{ step: 'ask', unit: 'ask_1', title: 'fix login', follow_up: false, aside: 'claude · not sent yet' }, { step: 'not_sealed' }],
    follows: 'ask_1', eval: null, seal: UNITS[0].seal,
  },
  ask_2: {
    unit: 'ask_2', title: 'telemetry', harness: 'claude', status: UNITS[2].status, aside: '1 Ask · claude · since 11:20',
    steps: [{ step: 'ask', unit: 'ask_2', title: 'telemetry', follow_up: false, aside: 'claude · asking' }, { step: 'not_sealed' }],
    follows: 'ask_2', eval: null, seal: UNITS[2].seal,
  },
  ask_3: {
    unit: 'ask_3', title: 'health endpoint', harness: 'codex', status: UNITS[1].status, aside: '2 Asks · codex · since 10:31',
    steps: [
      { step: 'ask', unit: 'ask_3', title: 'health endpoint', follow_up: false, aside: 'codex · sent 10:31' },
      { step: 'ask', unit: 'ask_5', title: 'build number', follow_up: true, aside: 'codex · sent 10:40' },
      { step: 'eval', eval: 'evl_3', n: 3, report: reportOf('nothing'), aside: 'judged 10:58 · Nothing to look at · 2 settled' },
      { step: 'not_sealed' },
    ],
    follows: 'evl_3', eval: null, seal: null,
  },
  ask_4: {
    unit: 'ask_4', title: 'readme fix', harness: 'claude', status: UNITS[3].status, aside: '2 Asks · claude · since 08:52',
    steps: [
      { step: 'ask', unit: 'ask_4', title: 'readme fix', follow_up: false, aside: 'claude · sent 08:52' },
      { step: 'ask', unit: 'ask_6', title: 'docs links', follow_up: true, aside: 'claude · sent 09:02' },
      { step: 'eval', eval: 'evl_2', n: 2, report: reportOf('nothing'), aside: 'judged 09:31 · Nothing to look at · 1 settled' },
      { step: 'seal', seal: 'rcp_7f3a2c', n: 4, decision: 'accepted', aside: '09:40 · by you' },
    ],
    follows: 'evl_2', eval: closed('readme fix'), seal: closed('readme fix'),
  },
};

const crumb = (e: [string, number, Found | null] | null, s: [string, number] | null): Detail['crumb'] => ({
  eval: e && { eval: e[0], n: e[1], report: e[2] && reportOf(e[2]) },
  seal: s && { seal: s[0], n: s[1] },
});

/** A work's Details (M11.2, D11.2), each from its Ask. */
export const DETAILS: Record<string, Detail> = {
  ask_1: {
    unit: 'ask_1', title: 'fix login', harness: 'claude', crumb: crumb(null, null),
    ask: { state: 'DONE', aside: 'asked 2026-10-08 11:29 · not sent yet', lines: [
      'You asked:', 'Refresh the token before it expires, not after',
      'The prompt claude composed:', 'In src/login.rs refresh the session token 60 s before expiry …',
      'How it was sent:', 'not sent yet, waiting for proceeding'] },
    session: SESSIONS[1], proceed: true, follows: 'ask_1',
  },
  ask_2: {
    unit: 'ask_2', title: 'telemetry', harness: 'claude', crumb: crumb(null, null),
    ask: { state: 'ASKING', aside: 'asked 2026-10-08 11:20 · asked, still being composed', lines: [
      'You asked:', 'Count how often /health is called, per hour', 'claude has not composed its prompt yet.'] },
    session: SESSIONS[1], proceed: false, follows: 'ask_2',
  },
  ask_3: {
    unit: 'ask_3', title: 'health endpoint', harness: 'codex', crumb: crumb(['evl_3', 3, 'nothing'], null),
    ask: { state: 'DONE', aside: 'asked 2026-10-08 10:31 · sent', lines: [
      'You asked:', 'Read the build number from the environment and show it on /health',
      'The prompt codex composed:', 'Implement /health: read BUILD_NUMBER …', 'How it was sent:', 'sent · word for word'] },
    session: SESSIONS[2], proceed: false, follows: 'evl_3',
  },
  ask_5: {
    unit: 'ask_5', title: 'build number', harness: 'codex', crumb: crumb(['evl_3', 3, 'nothing'], null),
    ask: { state: 'DONE', aside: 'asked 2026-10-08 10:40 · sent', lines: [
      'You asked:', 'Put the build number in the page footer', 'The prompt codex composed:', 'Show BUILD_NUMBER in the footer …', 'How it was sent:', 'sent · word for word'] },
    session: SESSIONS[2], proceed: false, follows: 'evl_3',
  },
  ask_4: {
    unit: 'ask_4', title: 'readme fix', harness: 'claude', crumb: crumb(['evl_2', 2, 'nothing'], ['rcp_7f3a2c', 4]),
    ask: { state: 'DONE', aside: 'asked 2026-10-08 08:52 · sent', lines: [
      'You asked:', 'Fix the install line in the README', 'The prompt claude composed:', 'In README.md replace the install line …', 'How it was sent:', 'sent · word for word'] },
    session: SESSIONS[3], proceed: false, follows: 'evl_2',
  },
  ask_6: {
    unit: 'ask_6', title: 'docs links', harness: 'claude', crumb: crumb(['evl_2', 2, 'nothing'], ['rcp_7f3a2c', 4]),
    ask: { state: 'DONE', aside: 'asked 2026-10-06 15:02 · sent', lines: ['You asked:', 'Fix the broken links in docs/', 'How it was sent:', 'sent · word for word'] },
    session: null, proceed: false, follows: 'evl_2',
  },
};

/** One item of an Eval, as the machine sends it. */
export const item = (key: string, kind: 'before' | 'look' | 'unsettled' | 'settled', text: string, more: Record<string, unknown> = {}) => ({
  key, kind, text, count: 1, dots: [] as boolean[], again: false, head: '', big: text, why: [] as string[], sure: '', said: null as string | null, check: null as string | null,
  windows: [] as string[], reads: [] as { who: string; said: string }[], ...more,
});

/** The items of fix login's Eval (cards 6.1–6.7, 11.3): what to look at, then what is settled. */
export const ITEMS = [
  item('c|sel_1/d2', 'before', 'Asked before · remembers the last email', {
    head: 'Asked before · not sure at your Seal of 10 Nov', big: 'The sign-in page remembers the last email address typed on this device.',
    why: ['When you sealed this work on 10 Nov you weren’t sure you wanted this, so it comes back to you. The change still does it. Your Seal asks about it again.'],
    windows: ['w_form'],
  }),
  item('w|w_sess', 'look', 'Sessions end after 1 hour, not 24', {
    dots: [true, true], head: 'To look at', big: 'Signed-in sessions end after 1 hour instead of 24.',
    why: ['The agent didn’t mention it, and your Ask doesn’t cover it.'], sure: 'read twice, both agree', windows: ['w_sess'],
    reads: [{ who: 'First read', said: 'Signed-in sessions end after 1 hour instead of 24.' }, { who: 'Second read', said: 'Sessions are cut to an hour.' }],
  }),
  item('r|ask_2/f0', 'look', 'Staying signed in is not in the change', {
    dots: [true], head: 'To look at', big: 'Staying signed in on this device is not in the change.',
    why: ['You asked for it in your second Ask.', 'What is missing: a remembered session'], sure: 'read once',
    reads: [{ who: 'First read', said: 'no unit keeps the session past the browser closing' }],
  }),
  item('w|w_log', 'look', 'The typed email goes into the server log', {
    dots: [true, true], head: 'To look at · against your decision of 3 Nov', big: 'A failed sign-in now writes the email address that was typed into the server log.',
    why: ['It goes against your decision of 3 Nov: when you sealed audit log, you said you didn’t want emails in the logs. Your Ask doesn’t mention it either.'],
    sure: 'read twice, both agree', said: 'Failed sign-ins are now logged with the email so we can spot attacks.', windows: ['w_log'],
    reads: [{ who: 'First read', said: 'The email typed is logged on a failed sign-in.' }, { who: 'Second read', said: 'Emails go into the server log.' }],
  }),
  item('r|ask_1/f0', 'unsettled', '“Show an error” — the reads differ', {
    dots: [false, false, false], head: 'Could not settle', big: 'A wrong password shows an error.',
    why: ['The reads differ on what you meant by “show an error”: a short message under the password field, or a pop-up that has to be closed. Your Seal asks what you meant.'],
    sure: 'read three times, the reads differ', check: 'What would settle it: type a wrong password on the sign-in page and see what appears.', windows: ['w_form'],
    reads: [
      { who: 'First read', said: 'Can’t tell: a message appears under the field, but the Ask may mean a pop-up.' },
      { who: 'Second read', said: 'The change adds a short message under the password field, which is one way to show an error.' },
      { who: 'Third read', said: 'Can’t tell: nothing says which kind of error you wanted.' },
    ],
  }),
  item('r|ask_1/f1', 'settled', 'Sign-in button off while it sends', {
    dots: [true], head: 'Settled', big: 'The sign-in button is off while it sends.', sure: 'read once',
    reads: [{ who: 'First read', said: 'disabled while sending' }],
  }),
  item('settled|explained', 'settled', '11 other changes your Ask explains', {
    count: 11, head: 'Settled', why: ['Each was read as something your Ask asks for, or as following from it.'],
  }),
];

/** An Eval's Details (M11.3, D11.3): its headline and its items, as the machine sends them. */
export const EVALS: Record<string, EvalDetail> = {
  evl_3: {
    eval: 'evl_3', n: 3, judging: false, report: { faults: 3, cannot_settle: 1, declared: 1, against_decisions: 1 }, judged_by: 'claude', at: at(11, 20),
    headline: '5 things to look at · 12 settled', items: ITEMS, questions: 5, checks: [{ mark: '✓', text: 'npm test', result: 'passed' }],
    asks: EVAL_3_ASKS, sealed: null, seal: null,
  },
  evl_2: {
    eval: 'evl_2', n: 2, judging: false, report: { faults: 0, cannot_settle: 0, declared: 0, against_decisions: 0 }, judged_by: 'codex', at: at(9, 31),
    headline: 'Nothing to look at · 2 settled', items: ITEMS.slice(5), questions: 0, checks: [{ mark: '✓', text: 'cargo test', result: 'passed' }],
    asks: [ask('ask_4', 'readme fix', 'claude'), ask('ask_6', 'docs links', 'claude')],
    sealed: { seal: 'rcp_7f3a2c', n: 4 }, seal: { key: 'why.sealed_already', title: 'Eval 2' },
  },
} as unknown as Record<string, EvalDetail>;

/** A Seal's Details (M11.4, D11.4). */
export const SEALS: Record<string, SealDetail> = {
  rcp_7f3a2c: {
    seal: 'rcp_7f3a2c', n: 4, decision: 'accepted', at: at(9, 40),
    eval: { eval: 'evl_2', n: 2, report: reportOf('nothing') }, receipt: 'rcp_7f3a2c', holds: true, broken: [],
    asks: EVALS.evl_2.asks,
  },
};

/** A session's Details (M11.5, D11.5): the ended claude readme fix was asked in. */
export const SESSION_DETAILS: Record<string, SessionDetail> = {
  [README_SESSION]: {
    session: README_SESSION, harness: 'claude', state: 'ended', turn: null, started: at(8, 47), last: at(9, 12), resume: true,
    asks: [{ unit: 'ask_4', title: 'readme fix', harness: 'claude', word: 'sealed', eval: 2, seal: 4 }], agent: null,
  },
  [SESSIONS[1].session]: {
    session: SESSIONS[1].session, harness: 'claude', state: 'running', turn: 'waiting', started: at(11, 2), last: at(11, 29), resume: false,
    asks: [{ unit: 'ask_1', title: 'fix login', harness: 'claude', word: 'asked', eval: null, seal: null },
      { unit: 'ask_2', title: 'telemetry', harness: 'claude', word: 'asking', eval: null, seal: null }], agent: CLAUDE,
  },
};

/** Every read of the sample. */
export const reads = (): Reads => structuredClone({
  units: UNIT_DETAILS, details: DETAILS, evals: EVALS, seals: SEALS, sessions: SESSION_DETAILS,
  sealed: { weft: SEALED_ROWS }, earlier: { weft: EARLIER }, views: { evl_3: VIEW, evl_2: VIEW },
});

/** A LARGE project, to page: 300 sessions (2 running), 120 sealed units. */
export function large(): { sessions: Session[]; earlier: Earlier[]; sealed: WorkRow[] } {
  const sessions: Session[] = Array.from({ length: 300 }, (_, i) => {
    const running = i < 2;
    const id = `big${String(i).padStart(5, '0')}-0000-4000-8000-000000000000`;
    return session(id, i % 2 ? 'codex' : 'claude', running ? 'running' : 'ended', running ? 'ready' : null, `task ${300 - i}`, at(11, 0) - i * 3_600_000, 1, running ? `b16b16b16b16-${i}` : null);
  });
  const earlier: Earlier[] = sessions.slice(5).map((s) => ({ session: s.session, harness: s.harness, title: s.title, asks: s.asks, at: s.at, group: 'earlier' }));
  const sealed: WorkRow[] = Array.from({ length: 120 }, (_, i) => unit(`ask_${String(120 - i).padStart(6, '0')}`, `sealed ${120 - i}`, 'claude', { state: 'sealed', decision: 'accepted' }, i < 40 ? 4 : 3));
  return { sessions, earlier, sealed };
}

/** fix login's Eval view, closed: its items and the lines they point at. */
export const VIEW = {
  eval_id: 'evl_3', title: 'fix login', closed: true, headline: '5 things to look at · 12 settled', waiting: false, items: ITEMS, progress: null,
  lines: {
    w_sess: { path: 'src/auth/session.ts', lines: [
      { n: 10, text: ' export const SESSION = {', lit: false },
      { n: 11, text: '   cookie: "sid",', lit: false },
      { n: 12, text: '-  maxAgeHours: 24,', lit: false },
      { n: 12, text: '+  maxAgeHours: 1,', lit: true },
      { n: 13, text: '+  rolling: false,', lit: true },
      { n: 14, text: ' };', lit: false },
      { n: 15, text: ' ', lit: false },
      { n: 16, text: ' export function newSession(user) {', lit: false },
    ] },
    w_log: { path: 'src/auth/login.ts', lines: [
      { n: 41, text: '   if (!ok) {', lit: false },
      { n: 42, text: '+    log.warn("failed sign-in", { email });', lit: true },
      { n: 43, text: '     return fail();', lit: false },
      { n: 44, text: '   }', lit: false },
    ] },
    w_form: { path: 'src/ui/SignIn.tsx', lines: [
      { n: 18, text: '   <input name="email" defaultValue={last} />', lit: true },
      { n: 19, text: '   <input name="password" type="password" />', lit: false },
      { n: 20, text: '+  {error && <p class="error">{error}</p>}', lit: true },
    ] },
  },
};

/** The steps of a running Eval, each done, under way or still to come. */
const steps = (lights: ('done' | 'now' | 'next')[], names: string[]) => names.map((name, i) => ({ name, light: lights[i] }));

/** 17.6: fix login's Eval before its first read is in: only the question carried from an earlier Seal. */
export const RUNNING = {
  ...VIEW, closed: false, headline: '', waiting: true, items: ITEMS.slice(0, 1), lines: {},
  progress: {
    arcs: ['now', 'next', 'next'], label: '1st read', note: 'reading',
    steps: steps(['done', 'now', 'next', 'next'], ['What you asked', 'Reading the change, all of it at once', 'Reading again where unsure, if needed', 'Questions for your Seal, if needed']),
    tests: ['npm test is running'],
  },
};

/** 6.7: its first read in, the second under way: two items are read again. */
export const STILL = {
  ...RUNNING, waiting: false,
  items: [
    ITEMS[0],
    { ...ITEMS[1], dots: [], again: true },
    ITEMS[2],
    { ...ITEMS[3], dots: [true] },
    { ...ITEMS[4], text: '“Show an error” — the first read can’t tell', dots: [], again: true },
    ITEMS[5], ITEMS[6],
  ],
  progress: {
    ...RUNNING.progress, arcs: ['done', 'now', 'next'], label: '2nd read',
    steps: steps(['done', 'done', 'now', 'next'], ['What you asked', 'Read the change', 'Reading again where unsure', 'Questions for your Seal, if needed']),
  },
};
