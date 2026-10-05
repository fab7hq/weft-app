// The Atlas's sample Details and Eval view (spec/atlas.md §6), as the machine
// sends them: shared by the specs and the gallery.

export type Section = { act: string; state: string; aside: string; lines: string[]; open: boolean };
export const NOT_RUN = (act: string): Section => ({ act, state: "HAVEN'T RUN", aside: '', lines: [], open: false });
export const ASKED = ['You asked:', 'Read the build number from the environment and show it on /health'];
export const SENT: Section = { act: 'ask', state: 'DONE', aside: '', lines: [...ASKED, 'The prompt codex sent:', 'Implement /health: read BUILD_NUMBER …'], open: false };
export const JUDGED: Section = {
  act: 'eval', state: 'DONE', aside: "doesn't match what you asked, 0.67 agreed", open: true,
  lines: [
    'judged by codex · recorded as drifted, 0.67', '3 judges checked the work · none of them did it',
    'JUDGE      map · codex · gpt-5.6-terra', 'JUDGE      reduce · claude · sonnet-5', 'JUDGE      confirm · claude · sonnet-5', '',
    '✗ returns the real build number', '  no · all 3 judges agreed', '  it still reads a literal "dev" at src/health.rs:41',
    '✓ adds a test for /health', '  yes · all 3 judges agreed', '',
    'CHANGED WITH NO JUDGE ABLE TO TIE IT TO WHAT YOU ASKED', '  src/telemetry.rs', '', 'A check is a judgement, not a guarantee.',
  ],
};
export const SEALED: Section = {
  act: 'seal', state: 'DONE', aside: 'accepted', open: true,
  lines: ['ON THE EVAL   recorded as aligned, 1.00 agreed', 'RECEIPT       rcp_7f3a2c', 'The receipt still matches what RingFrame wrote.', 'A Seal records what was decided. It does not make the work right.'],
};

export const detail = (title: string, harness: string, provenance: string, sections: Section[], more: Record<string, unknown> = {}) => ({
  title, harness, provenance, sections, proceed: false, eval_view: false, recorded: null, holds: null, debate_in: null, follows: 'ask_3', ...more,
});

export const DETAILS: Record<string, ReturnType<typeof detail>> = {
  ask_1: detail('fix login', 'claude', 'asked 2026-10-05 08:40 · waiting for your yes', [
    { act: 'ask', state: 'DONE', aside: '', lines: ['You asked:', 'Refresh the token before it expires, not after', 'The prompt claude composed:', 'In src/login.rs refresh the session token 60 s before expiry …'], open: true },
  ], { proceed: true, follows: 'ask_1' }),
  ask_2: detail('telemetry', 'claude', 'asked 2026-10-05 09:12 · asked, still being composed', [
    { act: 'ask', state: 'ASKING', aside: '', lines: ['You asked:', 'Count how often /health is called, per hour', 'claude has not composed its prompt yet.'], open: true },
  ], { follows: 'ask_2' }),
  ask_3: detail('health endpoint', 'codex', 'asked 2026-10-04 14:02 · sent · word for word', [SENT, NOT_RUN('eval'), NOT_RUN('seal')]),
};

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

