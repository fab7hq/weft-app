// The TUI's tree (ADR-0029, M11.1, D11.1): each project's AGENTS, every
// session weftd holds, newest first, and its WORK by Eval round, with the
// machine's words. Amber only for an agent that waits for you. A tap selects
// a row, and the bar's acts follow the selection; › opens its Details. Sealed
// and the earlier sessions travel as counts: Sealed unfolds a page at a time,
// read as it scrolls.
import { signal } from '@preact/signals';
import { useEffect, useRef } from 'preact/hooks';
import type { Machine } from '../api';
import { clock } from '../bar';
import * as m from '../machine';
import { go, here } from '../nav';
import { fill, stateWord, turnWord, w } from '../words';
import { TreeBar, askOn, evalOn, sealOn } from './Bar';
import { HeaderPills } from './Status';

/** What the bar's acts are on: a row of the tree, by what it is. */
export type Selected =
  | { kind: 'agent'; project: string; session: string }
  | { kind: 'open'; project: string }
  | { kind: 'eval'; project: string; eval: string }
  | { kind: 'ask'; project: string; unit: string }
  | { kind: 'seal'; project: string; seal: string }
  | { kind: 'earlier'; project: string };

export const selected = signal<Selected | null>(null);

/** A Seal as Sealed unfolds it (`read sealed`). */
export interface SealRow {
  seal: string;
  n: number;
  decision: string;
  at: number | null;
  eval: number | null;
  asks: number;
}

/** What Sealed has read of each project: its pages so far, the `after` of the next, and the count it was read at. */
const sealed = signal<Record<string, { rows: SealRow[]; next: string | null; count: number }>>({});

/** How many Asks a Seal covered, as Sealed read it, if it has. */
export const sealedCount = (project: string, seal: string) => sealed.value[project]?.rows.find((r) => r.seal === seal)?.asks ?? null;

/** The selection, as the tree holds it now: none once its row has gone. */
export type Chosen =
  | { kind: 'agent'; p: m.Project; row: m.Session }
  | { kind: 'open'; p: m.Project }
  | { kind: 'eval'; p: m.Project; round: m.Round }
  | { kind: 'ask'; p: m.Project; ask: m.Ask; round: m.Round | null }
  | { kind: 'seal'; p: m.Project; seal: SealRow }
  | { kind: 'earlier'; p: m.Project };

export function chosen(): Chosen | null {
  const s = selected.value;
  const p = s && m.tree.value.find((x) => x.project === s.project);
  if (!s || !p) return null;
  switch (s.kind) {
    case 'agent': {
      const row = p.agents.rows.find((r) => r.session === s.session);
      return row ? { kind: 'agent', p, row } : null;
    }
    case 'eval': {
      const round = p.work.evals.find((r) => r.eval === s.eval);
      return round ? { kind: 'eval', p, round } : null;
    }
    case 'ask': {
      const open = p.work.open.asks.find((a) => a.unit === s.unit);
      if (open) return { kind: 'ask', p, ask: open, round: null };
      for (const round of p.work.evals) {
        const ask = round.asks.find((a) => a.unit === s.unit);
        if (ask) return { kind: 'ask', p, ask, round };
      }
      return null;
    }
    case 'seal': {
      const seal = sealed.value[p.project]?.rows.find((r) => r.seal === s.seal);
      return seal ? { kind: 'seal', p, seal } : null;
    }
    default:
      return { kind: s.kind, p };
  }
}

/** Why a harness cannot record, as its project's machine said: it is not set up for RingFrame (M7.1). */
export function unready(p: m.Project, harness: string): m.Why | null {
  return p.ask && p.ask.harness === harness && p.ask.key !== 'why.start_an_agent' ? p.ask : null;
}

/** What this browser has folded or unfolded: a project by name, a round as
 * `project/open`, `project/evl_…`, and Sealed, folded until unfolded, as `project/sealed`. */
const FOLDS = 'weft.folded';
const folded = signal<string[]>(read());

function read(): string[] {
  try {
    return JSON.parse(localStorage.getItem(FOLDS) ?? '[]');
  } catch {
    return [];
  }
}

function fold(key: string): void {
  folded.value = folded.value.includes(key) ? folded.value.filter((k) => k !== key) : [...folded.value, key];
  try {
    localStorage.setItem(FOLDS, JSON.stringify(folded.value));
  } catch {
    // A private window keeps the fold for this page only.
  }
}

/** Whether a row is open: as drawn first (Sealed folded, the rest open), unless this browser turned it. */
const isOpen = (key: string, first = true) => first !== folded.value.includes(key);

/** The window's mark and name, as the TUI's title bar draws them. */
export function Mark() {
  return (
    <span class="mark" aria-label="Weft">
      <span class="mark-weave">╸┃╺</span>
      <span class="mark-word">WEFT</span>
    </span>
  );
}

/** NEEDS YOU and how many, while an agent asks for input: a tap opens the next one. */
export function NeedsYouPill({ machine }: { machine: Machine }) {
  const n = m.needsYou.value;
  if (n === 0) return null;
  const next = () => {
    const asking = m.agents.value.filter((a) => a.turn === 'waiting');
    const view = here();
    const at = asking.findIndex((a) => view?.name === 'agent' && a.agent === view.agent);
    go({ name: 'agent', machine: machine.id, agent: asking[(at + 1) % asking.length].agent });
  };
  return (
    <button class="needs-pill" type="button" onClick={next}>
      {`${w('title.needs_you').toUpperCase()} ${n}`}
    </button>
  );
}

/** The way to start an agent from the empty tree. */
export function StartButton({ machine }: { machine: Machine }) {
  return (
    <button class="tree-act tree-act--start" type="button" onClick={() => go({ name: 'start', machine: machine.id, from: m.tree.value[0]?.project ?? machine.name })}>
      {w('start.title')}
    </button>
  );
}

/** What the empty tree says, as the TUI's empty list does. */
function Empty({ machine }: { machine: Machine }) {
  const why = m.tree.value.find((p) => p.ask)?.ask;
  // M2.3, D2.3: the harness is not set up; else M2.1, D2.1: nothing asked yet.
  if (why && why.key !== 'why.start_an_agent')
    return (
      <div class="tree-empty">
        <p class="tree-empty-why">{fill(why.key, { harness: why.harness ?? '' })}</p>
        <p class="tree-empty-line">{w('tree.runs_either_way')}</p>
        <p class="tree-empty-line tree-empty-line--faint">{fill('web.why.set_up_on', { machine: machine.name })}</p>
      </div>
    );
  return (
    <div class="tree-empty">
      <p class="tree-empty-said">{w('tree.nothing_asked')}</p>
      <span class="phone-only"><StartButton machine={machine} /></span>
    </div>
  );
}

/** The checklist's lines: what each says, and how to make it hold while it does not. */
const NEEDS = [
  ['ringframe', 'tree.has_ringframe', 'tree.ringframe_how'],
  ['git', 'tree.has_git', 'tree.git_how'],
  ['commit', 'tree.has_commit', 'tree.commit_how'],
] as const;

/** RingFrame is not set up in this project yet: what it still needs, as the machine's RingFrame said. */
function Checklist({ needs }: { needs: m.Needs }) {
  return (
    <div class="checklist">
      <p class="checklist-said">{w('tree.not_set_up')}</p>
      <ul aria-label={w('tree.not_set_up')}>
        {NEEDS.map(([fact, said, how]) => {
          const held = needs[fact];
          return (
            <li key={fact} data-held={String(held)}>
              <span class="checklist-mark">{held === null ? '?' : held ? '✓' : '✗'}</span>
              <span class="checklist-what">{w(said)}</span>
              <span class="checklist-how">{held === false ? w(how) : ''}</span>
            </li>
          );
        })}
      </ul>
      <p class="checklist-said checklist-said--last">{w('tree.sets_it_up')}</p>
    </div>
  );
}

/** Connecting (M1.7, D1.7): the tree's shape, with no words until the machine answers. */
function Skeleton() {
  const bars: [number, number][] = [[16, 120], [32, 173], [48, 226], [16, 159], [32, 212]];
  return (
    <div class="tree tree-skeleton" aria-busy="true">
      {bars.map(([at, width], i) => (
        <div key={i} class="tree-row" style={{ paddingLeft: `${at}px` }}>
          <span class="skeleton-bar" style={{ width: `${width}px` }} />
        </div>
      ))}
    </div>
  );
}

/** Nothing in the tree but what the machine says is missing. */
const bare = (p: m.Project) => p.agents.rows.length === 0 && p.work.open.asks.length === 0 && p.work.evals.length === 0 && p.work.sealed.seals === 0;

/** What a session's row says after its harness: its turn, ended, or when it was last active (D11). */
export function stateOf(s: m.Session): string {
  if (s.state === 'ended') return w('state.ended');
  if (s.state === 'quiet') return fill('state.last_active', { time: clock(s.at) });
  return s.turn ? turnWord(s.turn) : w('state.running');
}

/** A session's row as it is named: its harness and its latest Ask. */
export const sessionName = (s: m.Session) => `${s.harness} · ${s.title ?? w('tree.no_ask')}`;

/** A round's name: `Eval 3`. */
export const evalName = (n: number) => fill('tree.eval', { n: String(n) });

/** How the tree opens a view: the person goes there, and back comes here. */
interface Moves {
  machine: Machine;
  wide: boolean;
  onAgent: (agent: string) => void;
}

export function TreeList({ machine, onAgent, wide = false }: { machine: Machine; onAgent: (agent: string) => void; wide?: boolean }) {
  if (!m.welcomed.value) return <Skeleton />;
  const projects = m.tree.value;
  if (projects.every((p) => bare(p) && !p.setup)) return <Empty machine={machine} />;
  const moves = { machine, wide, onAgent };
  return (
    <div class="tree" role="tree" aria-label="Work">
      {projects.map((p) => <ProjectRows key={p.project} p={p} moves={moves} />)}
    </div>
  );
}

function ProjectRows({ p, moves }: { p: m.Project; moves: Moves }) {
  const open = isOpen(p.project);
  const { machine } = moves;
  return (
    <div role="none">
      <div class="tree-row tree-row--project" role="treeitem" aria-label={p.project} aria-expanded={open} onClick={() => fold(p.project)}>
        <span class="tree-fold">{open ? '▾' : '▸'}</span>
        <span class="tree-name">{p.project}</span>
        {/* Its Open Asks and the agents that need you (D12.3). */}
        <span class="tree-aside">
          {`${p.open} ${w('title.open')}`}
          {p.needs > 0 && (
            <>
              {' · '}
              <span class="needs" data-needs-you="true">{`${p.needs} ●`}</span>
            </>
          )}
        </span>
      </div>
      {open && p.setup && <Checklist needs={p.setup} />}
      {open && !bare(p) && (
        <>
          <div class="tree-section" role="none">
            <span class="tree-section-name">{w('tree.agents')}</span>
            <span class="tree-section-aside">{fill('tree.counts', { n: String(p.agents.running), m: String(p.agents.ended) })}</span>
          </div>
          {p.agents.rows.map((s) => <AgentRow key={s.session} p={p} s={s} moves={moves} />)}
          {p.agents.earlier > 0 && (
            <div
              class="tree-row tree-row--earlier"
              role="treeitem"
              aria-label={earlierSaid(p.agents.earlier)}
              aria-selected={isSelected({ kind: 'earlier', project: p.project })}
              onClick={() => {
                selected.value = { kind: 'earlier', project: p.project };
                go({ name: 'earlier', machine: machine.id, project: p.project });
              }}
            >
              <span class="tree-name">{earlierSaid(p.agents.earlier)}{moves.wide && ' ›'}</span>
              {!moves.wide && <span class="tree-more" aria-hidden="true">›</span>}
            </div>
          )}
          <Work p={p} moves={moves} />
        </>
      )}
    </div>
  );
}

const earlierSaid = (n: number) => (n === 1 ? w('tree.earlier_one') : fill('tree.earlier', { n: String(n) }));

const isSelected = (s: Selected) => JSON.stringify(selected.value) === JSON.stringify(s);

/** One session (M11.1: two lines; D11.1: one row, its title under its harness, the time at the end). */
function AgentRow({ p, s, moves }: { p: m.Project; s: m.Session; moves: Moves }) {
  const { machine, wide, onAgent } = moves;
  const me: Selected = { kind: 'agent', project: p.project, session: s.session };
  const on = isSelected(me);
  const waiting = s.state === 'running' && s.turn === 'waiting';
  const running = s.state === 'running';
  const session = () => go({ name: 'session', machine: machine.id, project: p.project, session: s.session });
  // A tap selects it. On a desktop its agent opens beside the tree, or, with
  // none to open, its session; › (a phone) or a double click opens the session.
  const tap = () => {
    selected.value = me;
    if (!wide) return;
    if (s.agent) onAgent(s.agent);
    else session();
  };
  const name = sessionName(s);
  const dot = <span class={`agent-dot${waiting ? ' needs' : running ? ' good' : ''}`} data-needs-you={waiting ? 'true' : undefined}>{running ? '●' : '○'}</span>;
  const harness = (
    <span class={running ? 'agent-harness' : 'agent-harness agent-harness--off'}>
      {s.harness}
      {unready(p, s.harness) && ' ⚠'}
    </span>
  );
  const state = <span class={`agent-state${waiting ? ' needs' : ''}${!running && !wide ? ' agent-state--off' : ''}`}>{stateOf(s)}</span>;
  const title = <span class={`agent-title${s.title && (running || wide) ? '' : ' agent-title--none'}`}>{s.title ?? w('tree.no_ask')}</span>;
  const time = <span class="agent-at">{clock(s.at)}</span>;
  return (
    <div class="tree-row tree-row--agent" role="treeitem" aria-label={name} aria-selected={on} onClick={tap} onDblClick={session}>
      {wide ? (
        <>
          {dot}
          <span class="agent-lines">
            <span class="agent-top">{harness}{state}</span>
            {title}
          </span>
          {/* Ask sits on the selected agent while it runs (D11.1, D11.5). */}
          {on && running && <button class="row-act" type="button" aria-label={`${w('act.ask')} ${name}`} onClick={(e) => (e.stopPropagation(), askOn())}>{w('act.ask')}</button>}
          {time}
        </>
      ) : (
        <>
          <span class="agent-lines">
            <span class="agent-top">{dot}{harness}{state}{time}</span>
            {title}
          </span>
          <button class="tree-more" type="button" aria-label={`Details of ${name}`} onClick={(e) => (e.stopPropagation(), session())}>›</button>
        </>
      )}
    </div>
  );
}

/** WORK: an Eval being judged, Open, each Eval not sealed, then Sealed (M11.1, D11.1). */
function Work({ p, moves }: { p: m.Project; moves: Moves }) {
  const judging = p.work.evals.filter((r) => r.judging);
  const done = p.work.evals.filter((r) => !r.judging);
  const nothing = p.work.open.asks.length === 0 && p.work.evals.length === 0 && p.work.sealed.seals === 0;
  return (
    <>
      <div class="tree-section tree-section--work" role="none">
        <span class="tree-section-name">{w('tree.work')}</span>
        <span class="tree-section-aside">{w('tree.by_round')}</span>
      </div>
      {/* M2.5: nothing asked yet. A harness not set up says so by its ⚠ instead (M7.1). */}
      {nothing && !p.agents.rows.some((s) => unready(p, s.harness)) && <p class="tree-next">{w('web.tree.ask_for_something')}</p>}
      {judging.map((r) => <RoundRows key={r.eval} p={p} round={r} moves={moves} />)}
      {(p.work.open.asks.length > 0 || p.work.evals.length > 0) && <OpenRows p={p} moves={moves} />}
      {done.map((r) => <RoundRows key={r.eval} p={p} round={r} moves={moves} />)}
      {p.work.sealed.seals > 0 && <SealedRows p={p} moves={moves} />}
    </>
  );
}

/** A group's fold, its own press. */
function Fold({ open, name, onFold }: { open: boolean; name: string; onFold: () => void }) {
  return (
    <button class="tree-fold" type="button" aria-label={open ? `Fold ${name}` : `Unfold ${name}`} onClick={(e) => (e.stopPropagation(), onFold())}>
      {open ? '▾' : '▸'}
    </button>
  );
}

function OpenRows({ p, moves }: { p: m.Project; moves: Moves }) {
  const key = `${p.project}/open`;
  const open = isOpen(key);
  const me: Selected = { kind: 'open', project: p.project };
  const since = p.work.open.since;
  return (
    <>
      <div class="tree-row tree-row--group" role="treeitem" aria-label={w('tree.open')} aria-expanded={open} aria-selected={isSelected(me)} onClick={() => (selected.value = me)}>
        <Fold open={open} name={w('tree.open')} onFold={() => fold(key)} />
        <span class="group-name">
          <span class="group-title">{w('tree.open')}</span>
          {since !== null && <span class="group-aside">{` · ${fill('tree.since', { n: String(since) })}`}</span>}
        </span>
        {moves.wide && <button class="row-act" type="button" aria-label={`${w('act.eval')} ${w('tree.open')}`} onClick={(e) => (e.stopPropagation(), (selected.value = me), void evalOn())}>{w('act.eval')}</button>}
        <span class="group-count">{p.work.open.asks.length}</span>
      </div>
      {open && p.work.open.asks.map((a) => <AskRow key={a.unit} p={p} ask={a} moves={moves} />)}
    </>
  );
}

/** A verdict, in its colour: aligned teal, drifted amber. */
export function Verdict({ verdict }: { verdict: m.Round['verdict'] }) {
  if (!verdict) return null;
  return <span class={verdict === 'aligned' ? 'good' : 'needs'}>{w(`verdict.${verdict}`)}</span>;
}

function RoundRows({ p, round, moves }: { p: m.Project; round: m.Round; moves: Moves }) {
  const { machine, wide } = moves;
  const key = `${p.project}/${round.eval}`;
  const open = isOpen(key);
  const me: Selected = { kind: 'eval', project: p.project, eval: round.eval };
  const name = evalName(round.n);
  const details = () => go({ name: 'round', machine: machine.id, project: p.project, eval: round.eval });
  // A tap selects it; on a desktop it opens its Details too (D11.1).
  const tap = () => {
    selected.value = me;
    if (wide) details();
  };
  return (
    <>
      <div class="tree-row tree-row--group" role="treeitem" aria-label={name} aria-expanded={open} aria-selected={isSelected(me)} onClick={tap}>
        <Fold open={open} name={name} onFold={() => fold(key)} />
        <span class="group-name">
          <span class="group-title">{name}</span>
          {round.judging ? (
            <span class="group-aside">{` · ${w('tree.judging')}`}</span>
          ) : (
            <span class="group-aside">
              {' · '}
              <Verdict verdict={round.verdict} />
              {round.agreement && ` · ${round.agreement}`}
              {' · '}
              <span class={wide ? 'needs' : undefined}>{w('tree.not_sealed')}</span>
            </span>
          )}
        </span>
        {wide && !round.judging && <button class="row-act" type="button" aria-label={`${w('act.seal')} ${name}`} onClick={(e) => (e.stopPropagation(), (selected.value = me), void sealOn())}>{w('act.seal')}</button>}
        <span class="group-count">{round.asks.length}</span>
        {!wide && <button class="tree-more" type="button" aria-label={`Details of ${name}`} onClick={(e) => (e.stopPropagation(), (selected.value = me), details())}>›</button>}
      </div>
      {open && round.asks.map((a) => <AskRow key={a.unit} p={p} ask={a} moves={moves} />)}
    </>
  );
}

/** An Ask in a round: its title and harness, and ASKED or ASKING only under Open. */
function AskRow({ p, ask, moves }: { p: m.Project; ask: m.Ask; moves: Moves }) {
  const { machine } = moves;
  const me: Selected = { kind: 'ask', project: p.project, unit: ask.unit };
  const details = () => {
    selected.value = me;
    go({ name: 'detail', machine: machine.id, project: p.project, unit: ask.unit });
  };
  return (
    <div class="tree-row tree-row--work" role="treeitem" aria-label={ask.title} aria-selected={isSelected(me)} onClick={() => (selected.value = me)} onDblClick={details}>
      <span class="tree-name">{ask.title}</span>
      <span class="tree-aside">{ask.word ? `${ask.harness} · ${stateWord(ask.word)}` : ask.harness}</span>
      <button class="tree-more" type="button" aria-label={`Details of ${ask.title}`} onClick={(e) => (e.stopPropagation(), details())}>›</button>
    </div>
  );
}

/** Sealed, folded: unfolded, its Seals a page at a time from `read sealed`, the next page read as the last comes into view. */
function SealedRows({ p, moves }: { p: m.Project; moves: Moves }) {
  const key = `${p.project}/sealed`;
  const open = isOpen(key, false);
  const count = p.work.sealed.seals;
  const had = sealed.value[p.project];
  const reading = useRef(false);
  const more = async (after: string | null) => {
    if (reading.current) return;
    reading.current = true;
    const answer = await m.request({ type: 'read', what: 'sealed', project: p.project, ...(after ? { after } : {}) });
    reading.current = false;
    if (answer?.type !== 'ok') return;
    const page = answer.sealed as { seals: SealRow[]; next: string | null };
    const before = after ? sealed.value[p.project]?.rows ?? [] : [];
    sealed.value = { ...sealed.value, [p.project]: { rows: [...before, ...page.seals], next: page.next, count } };
  };
  // Read from the first page when it unfolds, and again when the count moves on.
  useEffect(() => {
    if (open && had?.count !== count) void more(null);
  }, [open, count]);
  const end = useRef<HTMLDivElement>(null);
  const next = had?.next ?? null;
  useEffect(() => {
    const el = end.current;
    if (!open || !el || !next) return;
    const seen = new IntersectionObserver((e) => e.some((x) => x.isIntersecting) && void more(next));
    seen.observe(el);
    return () => seen.disconnect();
  }, [open, next]);
  const name = w('tree.sealed');
  return (
    <>
      <div class="tree-row tree-row--group" role="treeitem" aria-label={name} aria-expanded={open} onClick={() => fold(key)}>
        <span class="tree-fold">{open ? '▾' : '▸'}</span>
        <span class="group-name">
          <span class="group-title">{name}</span>
          <span class="group-aside">{` · ${count === 1 ? w('tree.seals_one') : fill('tree.seals', { n: String(count) })}`}</span>
        </span>
        <span class="group-count">{p.work.sealed.asks}</span>
      </div>
      {open && had?.rows.map((s) => <SealRowView key={s.seal} p={p} seal={s} moves={moves} />)}
      {open && next && <div ref={end} class="tree-more-rows" aria-hidden="true" />}
    </>
  );
}

/** The Seal's own name: `Seal 4`. */
export const sealName = (n: number) => fill('tree.seal', { n: String(n) });

function SealRowView({ p, seal, moves }: { p: m.Project; seal: SealRow; moves: Moves }) {
  const { machine, wide } = moves;
  const me: Selected = { kind: 'seal', project: p.project, seal: seal.seal };
  const name = sealName(seal.n);
  const details = () => {
    selected.value = me;
    go({ name: 'seal', machine: machine.id, project: p.project, seal: seal.seal });
  };
  return (
    <div class="tree-row tree-row--seal" role="treeitem" aria-label={name} aria-selected={isSelected(me)} onClick={() => (wide ? details() : (selected.value = me))}>
      <span class="seal-lines">
        <span class="tree-name">{name}</span>
        <span class="tree-aside">{seal.eval === null ? seal.decision : `${seal.decision} · ${evalName(seal.eval)}`}</span>
      </span>
      <span class="group-count">{seal.asks}</span>
      <button class="tree-more" type="button" aria-label={`Details of ${name}`} onClick={(e) => (e.stopPropagation(), details())}>›</button>
    </div>
  );
}

/** The phone's tree: the bar on top, the tree under it. */
export function TreePage({ machine }: { machine: Machine }) {
  return (
    <div class="app">
      <div class="appbar">
        <Mark />
        <h1>{machine.name}</h1>
        <span class="spacer" />
        <HeaderPills machine={machine} />
        <button class="menu" type="button" aria-label="Menu" onClick={() => go({ name: 'settings' })}>☰</button>
      </div>
      <TreeList machine={machine} onAgent={(agent) => go({ name: 'agent', machine: machine.id, agent })} />
      <TreeBar machine={machine} wide={false} />
    </div>
  );
}
