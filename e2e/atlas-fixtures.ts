// The Atlas's sample (cards M11.x, D11.x; spec/atlas.md §6), as the machine
// sends it on remote protocol 3: the project weft's sessions and rounds, and
// what each read answers. Shared by the fake machine, the specs and the gallery.
import type { Ask, Detail, Earlier, EvalDetail, Reads, Round, SealDetail, SealRow, Session, SessionDetail } from './fake-machine';

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

/** WORK: Open since Eval 3, Eval 3 aligned and not sealed, Sealed · 4 seals 31. */
export const OPEN: Ask[] = [ask('ask_1', 'fix login', 'claude', 'asked'), ask('ask_2', 'telemetry', 'claude', 'asking')];
export const EVAL_3: Round = {
  eval: 'evl_3', n: 3, judging: false, verdict: 'aligned', agreement: '0.67',
  asks: [ask('ask_3', 'health endpoint', 'codex'), ask('ask_5', 'build number', 'codex')], seal: null,
};

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

/** Sealed, newest first (D11.4): Seal 4 sealed Eval 2, Seal 3 Eval 1, Seals 2 and 1 no Eval. */
export const SEALED_ROWS: SealRow[] = [
  { seal: 'rcp_7f3a2c', n: 4, decision: 'accepted', at: at(9, 40), eval: 2, asks: 2 },
  { seal: 'rcp_5b21e0', n: 3, decision: 'accepted', at: at(16, 5, 7), eval: 1, asks: 9 },
  { seal: 'rcp_3c90aa', n: 2, decision: 'accepted', at: at(12, 30, 6), eval: null, asks: 11 },
  { seal: 'rcp_18f4d2', n: 1, decision: 'accepted', at: at(10, 0, 5), eval: null, asks: 9 },
];

const crumb = (e: [string, number, Round['verdict']] | null, s: [string, number] | null): Detail['crumb'] => ({
  eval: e && { eval: e[0], n: e[1], verdict: e[2] },
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
    unit: 'ask_3', title: 'health endpoint', harness: 'codex', crumb: crumb(['evl_3', 3, 'aligned'], null),
    ask: { state: 'DONE', aside: 'asked 2026-10-08 10:31 · sent', lines: [
      'You asked:', 'Read the build number from the environment and show it on /health',
      'The prompt codex composed:', 'Implement /health: read BUILD_NUMBER …', 'How it was sent:', 'sent · word for word'] },
    session: SESSIONS[2], proceed: false, follows: 'evl_3',
  },
  ask_5: {
    unit: 'ask_5', title: 'build number', harness: 'codex', crumb: crumb(['evl_3', 3, 'aligned'], null),
    ask: { state: 'DONE', aside: 'asked 2026-10-08 10:40 · sent', lines: [
      'You asked:', 'Put the build number in the page footer', 'The prompt codex composed:', 'Show BUILD_NUMBER in the footer …', 'How it was sent:', 'sent · word for word'] },
    session: SESSIONS[2], proceed: false, follows: 'evl_3',
  },
  ask_4: {
    unit: 'ask_4', title: 'readme fix', harness: 'claude', crumb: crumb(['evl_2', 2, 'aligned'], ['rcp_7f3a2c', 4]),
    ask: { state: 'DONE', aside: 'asked 2026-10-08 08:52 · sent', lines: [
      'You asked:', 'Fix the install line in the README', 'The prompt claude composed:', 'In README.md replace the install line …', 'How it was sent:', 'sent · word for word'] },
    session: SESSIONS[3], proceed: false, follows: 'evl_2',
  },
  ask_6: {
    unit: 'ask_6', title: 'docs links', harness: 'claude', crumb: crumb(['evl_2', 2, 'aligned'], ['rcp_7f3a2c', 4]),
    ask: { state: 'DONE', aside: 'asked 2026-10-06 15:02 · sent', lines: ['You asked:', 'Fix the broken links in docs/', 'How it was sent:', 'sent · word for word'] },
    session: null, proceed: false, follows: 'evl_2',
  },
};

/** An Eval's Details (M11.3, D11.3). */
export const EVALS: Record<string, EvalDetail> = {
  evl_3: {
    eval: 'evl_3', n: 3, judging: false, verdict: 'aligned', agreement: '0.67', judged_by: 'codex', at: at(10, 58),
    findings: [{ mark: '✓', text: 'reads BUILD_NUMBER at startup' }, { mark: '✗', text: 'no test for the footer' }],
    checks: [{ mark: '✓', text: 'cargo test', result: 'passed' }],
    asks: EVAL_3.asks, sealed: null, seal: null,
  },
  evl_2: {
    eval: 'evl_2', n: 2, judging: false, verdict: 'aligned', agreement: '1.0', judged_by: 'codex', at: at(9, 31),
    findings: [{ mark: '✓', text: 'the install line works' }], checks: [{ mark: '✓', text: 'cargo test', result: 'passed' }],
    asks: [ask('ask_4', 'readme fix', 'claude'), ask('ask_6', 'docs links', 'claude')],
    sealed: { seal: 'rcp_7f3a2c', n: 4 }, seal: { key: 'why.sealed_already', title: 'Eval 2' },
  },
};

/** A Seal's Details (M11.4, D11.4). */
export const SEALS: Record<string, SealDetail> = {
  rcp_7f3a2c: {
    seal: 'rcp_7f3a2c', n: 4, decision: 'accepted', at: at(9, 40),
    eval: { eval: 'evl_2', n: 2, verdict: 'aligned', agreement: '1.0' }, receipt: 'rcp_7f3a2c', holds: true, broken: [],
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
  details: DETAILS, evals: EVALS, seals: SEALS, sessions: SESSION_DETAILS,
  sealed: { weft: SEALED_ROWS }, earlier: { weft: EARLIER }, views: { evl_3: VIEW, evl_2: VIEW },
});

/** A LARGE project, to page: 300 sessions (2 running), 120 seals of 400 Asks. */
export function large(): { sessions: Session[]; earlier: Earlier[]; sealed: SealRow[] } {
  const sessions: Session[] = Array.from({ length: 300 }, (_, i) => {
    const running = i < 2;
    const id = `big${String(i).padStart(5, '0')}-0000-4000-8000-000000000000`;
    return session(id, i % 2 ? 'codex' : 'claude', running ? 'running' : 'ended', running ? 'ready' : null, `task ${300 - i}`, at(11, 0) - i * 3_600_000, 1, running ? `b16b16b16b16-${i}` : null);
  });
  const earlier: Earlier[] = sessions.slice(5).map((s) => ({ session: s.session, harness: s.harness, title: s.title, asks: s.asks, at: s.at, group: 'earlier' }));
  const sealed: SealRow[] = Array.from({ length: 120 }, (_, i) => ({ seal: `rcp_${String(120 - i).padStart(6, '0')}`, n: 120 - i, decision: 'accepted', at: at(9, 0) - i * 3_600_000, eval: null, asks: i < 40 ? 4 : 3 }));
  return { sessions, earlier, sealed };
}

export const S7 = 'plans/app/plan.md#Phase 1/7';
export const row = (kind: string, key: string, depth: number, text: string, aside = '', mark = '', state: unknown = null) => ({ kind, key, depth, mark, text, aside, state });
const heading = (text: string) => row('heading', '', 0, text);
const text = (t: string, depth = 1, aside = '') => row('text', '', depth, t, aside);

export const VIEW = {
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

