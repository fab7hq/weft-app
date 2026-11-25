// The desktop app's tree (M11.1, D11.1): each project's AGENTS, every
// session weftd holds, newest first, and its WORK as units of work, with the
// machine's words. Amber only for an agent that waits for you. A tap selects
// a row, and the bar's acts follow the selection; › opens its Details. The
// earlier sessions travel as a count and unfold in the tree a page at a time,
// the next page on "Show 50 more"; the earlier sealed units open Done in its place. One search at the top (M11.8, D11.8) narrows
// every project to what matches.
import { signal } from '@preact/signals';
import { useEffect, useState } from 'preact/hooks';
import type { Machine } from '../api';
import { agentTime, clock } from '../bar';
import { count, moreOf, pastAbout } from '../earlier';
import * as m from '../machine';
import { go, here } from '../nav';
import { agentAbout, fill, reportTone, reportWord, statusTone, statusWord, turnWord, w } from '../words';
import { TreeBar, askOn, evalOn, sealOn } from './Bar';
import { DoneList, doneOf } from './Done';
import { HeaderPills, Strips } from './Status';
import { failed, rowWord, why } from '../waits';
import { Asking, Coming } from './Wait';

/** What the bar's acts are on: a row of the tree, by what it is. */
export type Selected =
  | { kind: 'agent'; project: string; session: string }
  | { kind: 'work'; project: string; unit: string };

export const selected = signal<Selected | null>(null);

/** One of the earlier sessions (`read sessions`). */
interface Earlier {
  session: string;
  harness: string;
  title: string | null;
  asks: number;
  at: number;
}

/** What `read sessions` has answered per project: its rows so far, the `after` of the next, how many there are, and the search and earlier count it was read at. */
const past = signal<Record<string, { rows: Earlier[]; next: string | null; total: number; q: string; count: number; failed?: string }>>({});

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
  // Not sent, or lost with the connection: still to come, read again when asked again.
  if (!answer || answer.lost === true) return;
  // A read that failed says why, and is never taken for no sessions.
  if (answer.type !== 'ok') {
    past.value = { ...past.value, [project]: { q, count, rows: had?.q === q ? had.rows : [], next: had?.q === q ? had.next : null, total: had?.q === q ? had.total : 0, failed: why(answer) } };
    return;
  }
  const page = answer.sessions as { total: number; rows: Earlier[]; next: string | null };
  past.value = { ...past.value, [project]: { q, count, rows: after && had ? [...had.rows, ...page.rows] : page.rows, next: page.next, total: page.total } };
}

/** What a project's earlier sessions were read for `q`, else nothing yet. */
const pastOf = (project: string, q: string) => (past.value[project]?.q === q ? past.value[project] : null);

/** An earlier session as AGENTS lists a session. */
const asRow = (e: Earlier): m.Session => ({ session: e.session, harness: e.harness, state: 'ended', turn: null, title: e.title, at: e.at, asks: e.asks, agent: null, ask: null });

/** The selection, as the tree holds it now: none once its row has gone. */
export type Chosen =
  | { kind: 'agent'; p: m.Project; row: m.Session }
  | { kind: 'work'; p: m.Project; row: m.WorkRow };

export function chosen(): Chosen | null {
  const s = selected.value;
  const p = s && m.tree.value.find((x) => x.project === s.project);
  if (!s || !p) return null;
  switch (s.kind) {
    case 'agent': {
      const row = p.agents.rows.find((r) => rowKey(r) === s.session);
      return row ? { kind: 'agent', p, row } : null;
    }
    case 'work': {
      const row = p.work.units.find((r) => r.unit === s.unit);
      return row ? { kind: 'work', p, row } : null;
    }
  }
}

/** Why a harness cannot record, as its project's machine said: it is not set up for RingFrame (M7.1). */
export function unready(p: m.Project, harness: string): m.Why | null {
  return p.ask && p.ask.harness === harness && p.ask.key !== 'why.start_an_agent' ? p.ask : null;
}

/** What this browser has folded or unfolded: a project by name, and the earlier
 * sealed units, folded until unfolded, as `project/sealed`. */
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

/** Whether a row is open: as drawn first (the earlier sealed folded, the rest open), unless this browser turned it. */
const isOpen = (key: string, first = true) => first !== folded.value.includes(key);

/** Weft's banner: its woven mark and its name, as the desktop draws them. */
export function Mark() {
  return <img class="mark" src="/icons/weft-banner-dark.svg" alt="Weft" />;
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
    <button class="needs-pill" type="button" aria-label={`${w('title.needs_you').toUpperCase()} ${n}`} onClick={next}>
      {`■ ${w('title.needs_you').toUpperCase()} ${n}`}
    </button>
  );
}

/** What the empty tree says. Nothing asked yet, its projects stay, each with its +. */
function Empty({ machine, onAgent, wide }: { machine: Machine; onAgent: (agent: string) => void; wide: boolean }) {
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
  const moves = { machine, wide, onAgent, searching: false };
  return (
    <>
      <div class="tree tree--bare" role="tree" aria-label="Work">
        {m.tree.value.map((p) => <ProjectRows key={p.project} p={p} moves={moves} />)}
      </div>
      <div class="tree-empty">
        <p class="tree-empty-said">{w('tree.nothing_asked')}</p>
      </div>
    </>
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
const bare = (p: m.Project) => p.agents.rows.length === 0 && p.work.units.length === 0 && p.work.earlier === 0;

/** What a session's row says after its harness: its turn, ended, or when it was last active. */
export function stateOf(s: m.Session): string {
  if (s.state === 'ended') return w('state.ended');
  if (s.state === 'quiet') return fill('state.last_active', { time: agentTime(s.at) });
  return s.turn ? turnWord(s.turn) : w('state.running');
}

/** A session's row as it is named: its harness and its latest Ask. */
/** A session row's key: its id, or, for a running agent whose harness has
 * named no session yet, its agent (sessions.md). */
export const rowKey = (s: m.Session) => s.session || s.agent || '';

/** Select the row of the agent `agent` runs, as a click on it would. */
export function selectAgent(agent: string): void {
  for (const p of m.tree.value) {
    const row = p.agents.rows.find((r) => r.agent === agent);
    if (row) {
      selected.value = { kind: 'agent', project: p.project, session: rowKey(row) };
      return;
    }
  }
}

export const sessionName = (s: m.Session) => `${s.harness} · ${s.title ?? w('tree.no_ask')}`;

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
  if (doneOf.value) return <DoneList machine={machine} project={doneOf.value} wide={wide} />;
  if (m.tree.value.every((p) => bare(p) && !p.setup)) return <Empty machine={machine} onAgent={onAgent} wide={wide} />;
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
  const units = p.work.units.filter((u) => has(u.title, u.harness, statusWord(u.status)));
  const found = pastOf(p.project, q);
  const n = rows.length + units.length + (found?.total ?? 0);
  if (n === 0) return null;
  const kept = { ...p, reopened: null, setup: null, agents: { ...p.agents, rows, earlier: found?.total ?? 0 }, work: { units, earlier: 0 } };
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
  // Nothing matches only once every earlier read has answered, and none failed.
  const failedRead = q ? projects.map((p) => pastOf(p.project, q)?.failed).find(Boolean) : undefined;
  const searching = q && projects.some((p) => p.agents.earlier > 0 && !pastOf(p.project, q));
  const none = q && !failedRead && kept.length === 0 && projects.every((p) => p.agents.earlier === 0 || pastOf(p.project, q));
  return (
    <>
      <Search />
      <div class="tree" role="tree" aria-label="Work">
        {q ? kept.map(({ p, n, past }) => <ProjectRows key={p.project} p={p} moves={moves} hit={{ n, past }} />) : projects.map((p) => <ProjectRows key={p.project} p={p} moves={moves} />)}
        {searching && <p class="tree-next"><Asking words={w('wait.checking')} /></p>}
        {failedRead && <p class="tree-next ask-hint" role="alert">{fill('wait.could_not_read', { why: failedRead })}</p>}
        {none && <p class="tree-next">{fill('tree.search_none', { q })}</p>}
      </div>
    </>
  );
}

/** A project Weft on the machine reopened after it ended uncleanly (M13.5):
 * when, that its agents ended, and Dismiss, which closes it there. */
function Reopened({ p, machine }: { p: m.Project; machine: Machine }) {
  // Its why not stays said in the tree's bar until the person acts again.
  const [busy, setBusy] = useState(false);
  const dismiss = async (e: Event) => {
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    const answer = await m.request({ type: 'act', act: 'dismiss', project: p.project });
    setBusy(false);
    if (!answer) failed.value = w('web.why.not_connected');
    else if (answer.type === 'error') failed.value = why(answer);
  };
  return (
    <div class="reopened" role="note">
      <p class="reopened-notice">{fill('web.reopened.notice', { machine: machine.name, time: clock(p.reopened ?? 0) })}</p>
      <button class="start-button reopened-dismiss" type="button" aria-busy={busy || undefined} onClick={(e) => void dismiss(e)}>{w('web.reopened.dismiss')}</button>
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
        {/* What a search found, or a project reopened (M13.5); folded, what waits in it. */}
        {(hit || p.reopened) && <span class="tree-aside">{hit ? fill('tree.match', { n: String(hit.n) }) : w('web.reopened')}</span>}
        {!open && !hit && !p.reopened && p.needs > 0 && (
          <span class="tree-aside needs" data-needs-you="true">{`■ ${p.needs}`}</span>
        )}
        {/* The project's own settings (M9.12): what differs from every project's. */}
        <button
          class="tree-plus"
          type="button"
          aria-label={fill('desktop.project.title', { project: p.project })}
          onClick={(e) => (e.stopPropagation(), go({ name: 'project', machine: machine.id, project: p.project }))}
        >
          ⋯
        </button>
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

/** `▸ Earlier sessions` and how many, a fold: unfolded, the sessions follow it newest first, a page at a
 * time, and `Show 50 more` reads the next. A search unfolds it with those that match, among all of them. */
function EarlierRows({ p, moves, found }: { p: m.Project; moves: Moves; found?: Earlier[] }) {
  const open = moves.searching || (pastOpen.value[p.project] ?? false);
  const had = pastOf(p.project, moves.searching ? query.value : '');
  const rows = found ?? had?.rows ?? [];
  const total = moves.searching ? (had?.total ?? 0) : p.agents.earlier;
  const more = open && had?.next ? moreOf(rows.length, had.total) : null;
  const title = w('tree.earlier_title');
  const turn = () => !moves.searching && (pastOpen.value = { ...pastOpen.value, [p.project]: !open });
  return (
    <>
      <div class="tree-row tree-row--earlier" role="treeitem" aria-label={title} aria-expanded={open} onClick={turn}>
        <span class="tree-name">{`${open ? '▾' : '▸'} ${title}`}</span>
        <span class="tree-aside">{count(total)}</span>
      </div>
      {open && rows.map((e) => <AgentRow key={e.session} p={p} s={asRow(e)} moves={moves} later={pastAbout(e)} />)}
      {/* Unfolded and not read yet: lines breathe where its sessions will be; failed, why. */}
      {open && !moves.searching && !had?.failed && !had && <div class="tree-row tree-row--earlier"><Coming lines={[60]} /></div>}
      {open && !moves.searching && had?.failed && <p class="tree-next ask-hint" role="alert">{fill('wait.could_not_read', { why: had.failed })}</p>}
      {more && (
        <div class="tree-row tree-row--show-more" role="treeitem" aria-label={more.more} onClick={() => void readPast(p.project, had!.q, had!.count, had!.next)}>
          <span class="tree-name">{more.more}</span>
          <span class="tree-aside">{more.shown}</span>
        </div>
      )}
    </>
  );
}

const isSelected = (s: Selected) => JSON.stringify(selected.value) === JSON.stringify(s);

/** One session (card 11.12): its status shape and name, the latest Ask's title or its first prompt, else its
 * harness; then its harness, state and time. */
/** `later`: an earlier session, what its second line says; a tap opens its Details. */
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
    if (later !== undefined) return session();
    selected.value = me;
    if (!wide) return;
    if (s.agent) onAgent(s.agent);
    else session();
  };
  const name = sessionName(s);
  // The status is a shape and a colour: a circle while it runs, a square while
  // it waits for you, a hollow square once it has ended.
  const shape = (
    <span class={`agent-dot${waiting ? ' needs' : running ? ' good' : ''}`} data-needs-you={waiting ? 'true' : undefined} aria-label={stateOf(s)}>
      {waiting ? '■' : running ? '●' : '□'}
    </span>
  );
  return (
    <div class={later !== undefined ? 'tree-row tree-row--agent tree-row--past' : 'tree-row tree-row--agent'} role="treeitem" aria-label={name} aria-selected={on} onClick={tap} onDblClick={session}>
      {shape}
      <span class="agent-text">
        <span class="agent-line">
          <span class={`agent-title${s.title ? '' : ' agent-title--unnamed'}${running ? '' : ' agent-title--off'}`}>
            {s.title ?? s.harness}
            {unready(p, s.harness) && ' ⚠'}
          </span>
          {running && p.turbo && <span class="agent-turbo">⚡</span>}
        </span>
        <span class="agent-about">{later ?? agentAbout(s, agentTime(s.at))}</span>
      </span>
      {!wide && <button class="tree-more" type="button" aria-label={`Details of ${name}`} onClick={(e) => (e.stopPropagation(), session())}>›</button>}
    </div>
  );
}

/** WORK: a row per unit of work, then `n sealed earlier`. */
function Work({ p, moves }: { p: m.Project; moves: Moves }) {
  const nothing = p.work.units.length === 0 && p.work.earlier === 0;
  // Searching, p holds only what matched.
  if (moves.searching && p.work.units.length === 0) return null;
  return (
    <>
      <div class="tree-section tree-section--work" role="none">
        <span class="tree-section-name">{w('tree.work')}</span>
      </div>
      {/* M2.5: nothing asked yet. A harness not set up says so by its ⚠ instead (M7.1). */}
      {nothing && !p.agents.rows.some((s) => unready(p, s.harness)) && <p class="tree-next">{w('web.tree.ask_for_something')}</p>}
      {p.work.units.map((u) => <WorkRowView key={u.unit} p={p} row={u} moves={moves} />)}
      {!moves.searching && p.work.earlier > 0 && <SealedEarlier p={p} />}
    </>
  );
}

/** What an Eval found, as counts, in its colour: teal when nothing, amber when something. */
export function ReportSaid({ report }: { report: m.Report | null }) {
  if (!report) return null;
  return <span class={reportTone(report)}>{reportWord(report)}</span>;
}

/** An Eval's name: `Eval 3`. */
export const evalName = (n: number) => fill('tree.eval', { n: String(n) });

/** A unit of work: its title and harness, and its one status. A tap selects it; on a desktop it opens its Details too. */
function WorkRowView({ p, row, moves }: { p: m.Project; row: m.WorkRow; moves: Moves }) {
  const { machine, wide } = moves;
  const me: Selected = { kind: 'work', project: p.project, unit: row.unit };
  const details = () => {
    selected.value = me;
    go({ name: 'work', machine: machine.id, project: p.project, unit: row.unit });
  };
  const tap = () => (wide ? details() : (selected.value = me));
  const working = rowWord(row.unit, p.project);
  return (
    <div class="tree-row tree-row--work" role="treeitem" aria-label={row.title} aria-selected={isSelected(me)} onClick={tap} onDblClick={details}>
      <span class="work-lines">
        <span class="work-first">
          <span class="work-line">
            <span class="work-title">{row.title}</span>
            <span class="agent-sep">·</span>
            <span class="work-harness">{row.harness}</span>
          </span>
          {/* While this device works on it, or its Eval opens, the row says so. */}
          {working ? <span class="work-status working">{working}</span> : <span class={`work-status ${statusTone(row.status)}`}>{statusWord(row.status)}</span>}
        </span>
        {row.open > 0 && row.status.state !== 'sealed' && (
          <span class="work-since">{row.open === 1 ? w('work.since_seal_one') : fill('work.since_seal', { n: String(row.open) })}</span>
        )}
      </span>
      {!wide && <button class="tree-more" type="button" aria-label={`Details of ${row.title}`} onClick={(e) => (e.stopPropagation(), details())}>›</button>}
    </div>
  );
}

/** `n sealed earlier ›`: opens Done in the tree's place (17.18). */
function SealedEarlier({ p }: { p: m.Project }) {
  const said = fill('tree.sealed_earlier', { n: String(p.work.earlier) });
  return (
    <div class="tree-row tree-row--earlier" role="treeitem" aria-label={said} onClick={() => (doneOf.value = p.project)}>
      <span class="tree-name">{`${said} ›`}</span>
    </div>
  );
}

/** A Seal's own name: `Seal 4`. */
export const sealName = (n: number) => fill('tree.seal', { n: String(n) });

/** The phone's tree: the bar on top, the tree under it. */
export function TreePage({ machine }: { machine: Machine }) {
  // Done (17.18) is a page of its own: its head in the bar's place.
  if (doneOf.value) return <div class="app done-page"><TreeList machine={machine} onAgent={(agent) => go({ name: 'agent', machine: machine.id, agent })} /></div>;
  return (
    <div class="app">
      <div class="appbar">
        <Mark />
        <span class="spacer" />
        <HeaderPills machine={machine} />
        <button class="menu" type="button" aria-label={w('menu')} onClick={() => go({ name: 'settings', machine: machine.id })}>☰</button>
      </div>
      <Strips machine={machine} />
      <TreeList machine={machine} onAgent={(agent) => go({ name: 'agent', machine: machine.id, agent })} />
      <TreeBar machine={machine} wide={false} />
    </div>
  );
}
