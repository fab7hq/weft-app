// The TUI's tree (M11.1, D11.1): each project's AGENTS, every
// session weftd holds, newest first, and its WORK by Eval round, with the
// machine's words. Amber only for an agent that waits for you. A tap selects
// a row, and the bar's acts follow the selection; › opens its Details. Sealed
// and the earlier sessions travel as counts: each unfolds in the tree a page at
// a time, read as it scrolls. One search at the top (M11.8, D11.8) narrows
// every project to what matches.
import { signal } from '@preact/signals';
import { useEffect, useRef } from 'preact/hooks';
import type { Machine } from '../api';
import { clock, stamp, weekday } from '../bar';
import * as m from '../machine';
import { go, here } from '../nav';
import { fill, stateWord, turnWord, w } from '../words';
import { TreeBar, askOn, evalOn, sealOn } from './Bar';
import { HeaderPills, Strips } from './Status';

/** What the bar's acts are on: a row of the tree, by what it is. */
export type Selected =
  | { kind: 'agent'; project: string; session: string }
  | { kind: 'open'; project: string }
  | { kind: 'eval'; project: string; eval: string }
  | { kind: 'ask'; project: string; unit: string }
  | { kind: 'seal'; project: string; seal: string };

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

/** One of the earlier sessions (`read sessions`). */
interface Earlier {
  session: string;
  harness: string;
  title: string | null;
  asks: number;
  at: number;
  group: 'today' | 'yesterday' | 'week' | 'earlier';
}

/** What `read sessions` has answered per project: its rows so far, the `after` of the next, how many there are, and the search and earlier count it was read at. */
const past = signal<Record<string, { rows: Earlier[]; next: string | null; total: number; q: string; count: number }>>({});

/** The earlier sessions unfolded, by project, for this visit. */
const pastOpen = signal<Record<string, boolean>>({});

/** The search: what is typed, and what the tree narrows to a moment later, so a read is not sent for each key. */
const typed = signal('');
const query = signal('');
let timer: ReturnType<typeof setTimeout> | undefined;

function type(text: string): void {
  typed.value = text;
  clearTimeout(timer);
  const q = text.trim();
  if (q) timer = setTimeout(() => (query.value = q), 200);
  else query.value = '';
}

/** The latest search each project was read for, so an answer to an earlier one is not shown. */
const asking: Record<string, string> = {};
const paging = new Set<string>();

/** A page of a project's earlier sessions matching `q` (all of them, for ''): the first, or the one after `after`. */
async function readPast(project: string, q: string, count: number, after: string | null): Promise<void> {
  if (after) {
    if (paging.has(project)) return;
    paging.add(project);
  } else asking[project] = q;
  const answer = await m.request({ type: 'read', what: 'sessions', project, ...(q ? { q } : {}), ...(after ? { after } : {}) });
  if (after) paging.delete(project);
  const had = past.value[project];
  if (asking[project] !== q || (after && had?.q !== q)) return;
  const page = answer?.type === 'ok' ? (answer.sessions as { total: number; rows: Earlier[]; next: string | null }) : { total: 0, rows: [], next: null };
  past.value = { ...past.value, [project]: { q, count, rows: after && had ? [...had.rows, ...page.rows] : page.rows, next: page.next, total: page.total } };
}

/** What a project's earlier sessions were read for `q`, else nothing yet. */
const pastOf = (project: string, q: string) => (past.value[project]?.q === q ? past.value[project] : null);

/** When an earlier session ended, as its group says it: a time today and yesterday, a weekday this week, else its day. */
const when = (e: Earlier) => (e.group === 'week' ? weekday(e.at) : e.group === 'earlier' ? stamp(e.at).slice(0, 10) : clock(e.at));

/** An earlier session as AGENTS lists a session. */
const asRow = (e: Earlier): m.Session => ({ session: e.session, harness: e.harness, state: 'ended', turn: null, title: e.title, at: e.at, asks: e.asks, agent: null, ask: null });

/** The selection, as the tree holds it now: none once its row has gone. */
export type Chosen =
  | { kind: 'agent'; p: m.Project; row: m.Session }
  | { kind: 'open'; p: m.Project }
  | { kind: 'eval'; p: m.Project; round: m.Round }
  | { kind: 'ask'; p: m.Project; ask: m.Ask; round: m.Round | null }
  | { kind: 'seal'; p: m.Project; seal: SealRow };

export function chosen(): Chosen | null {
  const s = selected.value;
  const p = s && m.tree.value.find((x) => x.project === s.project);
  if (!s || !p) return null;
  switch (s.kind) {
    case 'agent': {
      const row = p.agents.rows.find((r) => rowKey(r) === s.session);
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

/** What a session's row says after its harness: its turn, ended, or when it was last active. */
export function stateOf(s: m.Session): string {
  if (s.state === 'ended') return w('state.ended');
  if (s.state === 'quiet') return fill('state.last_active', { time: clock(s.at) });
  return s.turn ? turnWord(s.turn) : w('state.running');
}

/** A session's row as it is named: its harness and its latest Ask. */
/** A session row's key: its id, or, for a running agent whose harness has
 * named no session yet, its agent (sessions.md). */
export const rowKey = (s: m.Session) => s.session || s.agent || '';

export const sessionName = (s: m.Session) => `${s.harness} · ${s.title ?? w('tree.no_ask')}`;

/** A round's name: `Eval 3`. */
export const evalName = (n: number) => fill('tree.eval', { n: String(n) });

/** How the tree opens a view: the person goes there, and back comes here. */
interface Moves {
  machine: Machine;
  wide: boolean;
  onAgent: (agent: string) => void;
  /** A search is on: every fold is open, and only what matches is drawn. */
  searching: boolean;
}

export function TreeList({ machine, onAgent, wide = false }: { machine: Machine; onAgent: (agent: string) => void; wide?: boolean }) {
  if (!m.welcomed.value) return <Skeleton />;
  if (m.tree.value.every((p) => bare(p) && !p.setup)) return <Empty machine={machine} />;
  return <Searched machine={machine} onAgent={onAgent} wide={wide} />;
}

/** The search box (M11.8, D11.8): ✕ clears it. */
function Search() {
  const text = typed.value;
  return (
    <div class={text ? 'tree-search tree-search--on' : 'tree-search'}>
      <span class="tree-glass" aria-hidden="true">⌕</span>
      <input
        class="tree-field"
        type="search"
        aria-label={w('tree.search_placeholder')}
        placeholder={w('tree.search_placeholder')}
        autocomplete="off"
        value={text}
        onInput={(e) => type((e.target as HTMLInputElement).value)}
      />
      {text && <button class="tree-clear" type="button" aria-label={w('web.search.clear')} onClick={() => type('')}>✕</button>}
    </div>
  );
}

/** What a search keeps of a project: the rows that match, and how many. */
function narrowed(p: m.Project, q: string): { p: m.Project; n: number; past: Earlier[] } | null {
  const l = q.toLowerCase();
  const has = (...t: (string | null | undefined)[]) => t.some((x) => x?.toLowerCase().includes(l));
  const rows = p.agents.rows.filter((s) => has(s.harness, s.title, s.session));
  const asks = (all: m.Ask[]) => all.filter((a) => has(a.title, a.word && stateWord(a.word)));
  const open = asks(p.work.open.asks);
  const evals = p.work.evals.map((r) => ({ ...r, asks: asks(r.asks) })).filter((r) => r.asks.length > 0);
  const found = pastOf(p.project, q);
  const n = rows.length + open.length + evals.reduce((sum, r) => sum + r.asks.length, 0) + (found?.total ?? 0);
  if (n === 0) return null;
  const kept = { ...p, reopened: null, setup: null, agents: { ...p.agents, rows, earlier: found?.total ?? 0 }, work: { ...p.work, open: { ...p.work.open, asks: open }, evals } };
  return { p: kept, n, past: found?.rows ?? [] };
}

/** The search, and the tree it narrows. */
function Searched({ machine, onAgent, wide }: { machine: Machine; onAgent: (agent: string) => void; wide: boolean }) {
  const projects = m.tree.value;
  const q = query.value;
  const moves = { machine, wide, onAgent, searching: q !== '' };
  // Read the earlier sessions a search or an unfolded group needs, again when the search or a count moves on.
  const wanted = projects.filter((p) => p.agents.earlier > 0 && (q || pastOpen.value[p.project]));
  useEffect(() => {
    for (const p of wanted) {
      const had = past.value[p.project];
      if (had?.q !== q || had.count !== p.agents.earlier) void readPast(p.project, q, p.agents.earlier, null);
    }
  }, [q, wanted.map((p) => `${p.project}/${p.agents.earlier}`).join()]);
  const kept = q ? projects.flatMap((p) => narrowed(p, q) ?? []) : [];
  // Nothing matches only once every earlier read has answered.
  const none = q && kept.length === 0 && projects.every((p) => p.agents.earlier === 0 || pastOf(p.project, q));
  return (
    <>
      <Search />
      <div class="tree" role="tree" aria-label="Work">
        {q ? kept.map(({ p, n, past }) => <ProjectRows key={p.project} p={p} moves={moves} hit={{ n, past }} />) : projects.map((p) => <ProjectRows key={p.project} p={p} moves={moves} />)}
        {none && <p class="tree-next">{fill('tree.search_none', { q })}</p>}
      </div>
    </>
  );
}

/** A project Weft on the machine reopened after it ended uncleanly (M13.5):
 * when, that its agents ended, and Dismiss, which closes it there. */
function Reopened({ p, machine }: { p: m.Project; machine: Machine }) {
  const dismiss = (e: Event) => {
    e.stopPropagation();
    void m.request({ type: 'act', act: 'dismiss', project: p.project });
  };
  return (
    <div class="reopened" role="note">
      <p class="reopened-notice">{fill('web.reopened.notice', { machine: machine.name, time: clock(p.reopened ?? 0) })}</p>
      <button class="start-button reopened-dismiss" type="button" onClick={dismiss}>{w('web.reopened.dismiss')}</button>
    </div>
  );
}

/** A project's rows. Searching, `p` is what matched and `hit` has its count and earlier sessions. */
function ProjectRows({ p, moves, hit }: { p: m.Project; moves: Moves; hit?: { n: number; past: Earlier[] } }) {
  const open = moves.searching || isOpen(p.project);
  const { machine } = moves;
  return (
    <div role="none">
      <div class="tree-row tree-row--project" role="treeitem" aria-label={p.project} aria-expanded={open} onClick={() => !moves.searching && fold(p.project)}>
        <span class="tree-fold">{open ? '▾' : '▸'}</span>
        <span class="tree-name">{p.project}</span>
        {/* Its Open Asks and the agents that need you; reopened, in their place (M13.5). */}
        <span class="tree-aside">
          {hit ? fill('tree.match', { n: String(hit.n) }) : p.reopened ? w('web.reopened') : `${p.open} ${w('title.open')}`}
          {!p.reopened && p.needs > 0 && (
            <>
              {' · '}
              <span class="needs" data-needs-you="true">{`${p.needs} ●`}</span>
            </>
          )}
        </span>
        {/* Start an agent in this project (M9.8): the project is already chosen. */}
        <button
          class="tree-plus"
          type="button"
          aria-label={fill('web.start.in', { project: p.project })}
          onClick={(e) => (e.stopPropagation(), go({ name: 'start', machine: machine.id, from: p.project, project: p.project }))}
        >
          +
        </button>
      </div>
      {open && p.reopened && <Reopened p={p} machine={machine} />}
      {open && p.setup && <Checklist needs={p.setup} />}
      {open && (hit || !bare(p)) && (
        <>
          {(!hit || p.agents.rows.length > 0 || p.agents.earlier > 0) && (
            <div class="tree-section" role="none">
              <span class="tree-section-name">{w('tree.agents')}</span>
              {!hit && <span class="tree-section-aside">{fill('tree.counts', { n: String(p.agents.running), m: String(p.agents.ended) })}</span>}
            </div>
          )}
          {p.agents.rows.map((s) => <AgentRow key={rowKey(s)} p={p} s={s} moves={moves} />)}
          {p.agents.earlier > 0 && <EarlierRows p={p} moves={moves} found={hit?.past} />}
          <Work p={p} moves={moves} />
        </>
      )}
    </div>
  );
}

const earlierSaid = (n: number) => (n === 1 ? w('tree.earlier_one') : fill('tree.earlier', { n: String(n) }));

/** `n earlier sessions`, a fold: unfolded, the sessions follow it newest first, a page at a time as it scrolls. A search unfolds it with those that match. */
function EarlierRows({ p, moves, found }: { p: m.Project; moves: Moves; found?: Earlier[] }) {
  const open = moves.searching || (pastOpen.value[p.project] ?? false);
  const had = pastOf(p.project, moves.searching ? query.value : '');
  const rows = found ?? had?.rows ?? [];
  const next = had?.next ?? null;
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = end.current;
    if (!open || !el || !next) return;
    const seen = new IntersectionObserver((e) => e.some((x) => x.isIntersecting) && void readPast(p.project, had!.q, had!.count, next));
    seen.observe(el);
    return () => seen.disconnect();
  }, [open, next]);
  const said = earlierSaid(p.agents.earlier);
  return (
    <>
      <div class="tree-row tree-row--earlier" role="treeitem" aria-label={said} aria-expanded={open} onClick={() => (pastOpen.value = { ...pastOpen.value, [p.project]: !pastOpen.value[p.project] })}>
        <span class="tree-fold">{open ? '▾' : '▸'}</span>
        <span class="tree-name">{said}</span>
      </div>
      {open && rows.map((e) => <AgentRow key={e.session} p={p} s={asRow(e)} moves={moves} later={when(e)} />)}
      {open && next && <div ref={end} class="tree-more-rows" aria-hidden="true" />}
    </>
  );
}

const isSelected = (s: Selected) => JSON.stringify(selected.value) === JSON.stringify(s);

/** One session (M11.1: two lines; D11.1: one row, its title under its harness, the time at the end). */
/** `later`: an earlier session, its time as its group says it; a tap opens its Details. */
function AgentRow({ p, s, moves, later }: { p: m.Project; s: m.Session; moves: Moves; later?: string }) {
  const { machine, wide, onAgent } = moves;
  const me: Selected = { kind: 'agent', project: p.project, session: rowKey(s) };
  const on = isSelected(me);
  const waiting = s.state === 'running' && s.turn === 'waiting';
  const running = s.state === 'running';
  // One with no session yet has no Details: it opens its agent.
  const session = () => (s.session ? go({ name: 'session', machine: machine.id, project: p.project, session: s.session }) : s.agent && onAgent(s.agent));
  // A tap selects it. On a desktop its agent opens beside the tree, or, with
  // none to open, its session; › (a phone) or a double click opens the session.
  const tap = () => {
    if (later) return session();
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
  const time = <span class="agent-at">{later ?? clock(s.at)}</span>;
  return (
    <div class={later ? 'tree-row tree-row--agent tree-row--past' : 'tree-row tree-row--agent'} role="treeitem" aria-label={name} aria-selected={on} onClick={tap} onDblClick={session}>
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
  // Searching, p holds only what matched, and Sealed holds no Ask to match.
  const { searching } = moves;
  if (searching && p.work.open.asks.length === 0 && p.work.evals.length === 0) return null;
  return (
    <>
      <div class="tree-section tree-section--work" role="none">
        <span class="tree-section-name">{w('tree.work')}</span>
        {!searching && <span class="tree-section-aside">{w('tree.by_round')}</span>}
      </div>
      {/* M2.5: nothing asked yet. A harness not set up says so by its ⚠ instead (M7.1). */}
      {nothing && !p.agents.rows.some((s) => unready(p, s.harness)) && <p class="tree-next">{w('web.tree.ask_for_something')}</p>}
      {judging.map((r) => <RoundRows key={r.eval} p={p} round={r} moves={moves} />)}
      {(searching ? p.work.open.asks.length > 0 : p.work.open.asks.length > 0 || p.work.evals.length > 0) && <OpenRows p={p} moves={moves} />}
      {done.map((r) => <RoundRows key={r.eval} p={p} round={r} moves={moves} />)}
      {!searching && p.work.sealed.seals > 0 && <SealedRows p={p} moves={moves} />}
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
  const open = moves.searching || isOpen(key);
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
  const open = moves.searching || isOpen(key);
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
      <Strips machine={machine} />
      <TreeList machine={machine} onAgent={(agent) => go({ name: 'agent', machine: machine.id, agent })} />
      <TreeBar machine={machine} wide={false} />
    </div>
  );
}
