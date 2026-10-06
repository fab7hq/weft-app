// The TUI's tree (spec/atlas.md §4): projects, their harnesses, and the works
// asked of each, with the machine's words. Amber only for an agent that needs
// you. A tap selects a work, › opens its Details, a harness opens its agent.
import { signal } from '@preact/signals';
import type { Machine } from '../api';
import * as m from '../machine';
import { go, here } from '../nav';
import { fill, stateWord, turnWord, w } from '../words';
import { offerResume } from './Asked';
import { TreeBar } from './Bar';
import { LinkPill } from './Status';

/** The work the bar's acts are on, by its Ask id. */
export const selected = signal<string | null>(null);

/** What this browser has folded: a project by name, a harness as `project/harness`. */
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

/** A turn, as the web says it. */
const turnSaid = (t: m.Agent['turn']) => (t === 'waiting' ? w('web.turn.waiting') : turnWord(t));

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
  const lines =
    why && why.key !== 'why.start_an_agent'
      ? [fill(why.key, { harness: why.harness ?? '' }), w('tree.runs_either_way'), fill('web.why.set_up_on', { machine: machine.name })]
      : [w('tree.nothing_asked')];
  return (
    <div class="tree-empty">
      {lines.map((l) => (
        <p key={l} class="note">{l}</p>
      ))}
      {!why || why.key === 'why.start_an_agent' ? <span class="phone-only"><StartButton machine={machine} /></span> : null}
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
      <p class="note">{w('tree.not_set_up')}</p>
      <ul aria-label={w('tree.not_set_up')}>
        {NEEDS.map(([fact, said, how]) => {
          const held = needs[fact];
          return (
            <li key={fact} data-held={String(held)}>
              <span class="checklist-mark">{held === null ? '?' : held ? '✓' : '✗'}</span>
              <span>{w(said)}</span>
              <span class="checklist-how">{held === false ? w(how) : ''}</span>
            </li>
          );
        })}
      </ul>
      <p class="note">{w('tree.sets_it_up')}</p>
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

export function TreeList({ machine, onAgent }: { machine: Machine; onAgent: (agent: string) => void }) {
  if (!m.welcomed.value) return <Skeleton />;
  const projects = m.tree.value;
  if (projects.every((p) => p.harnesses.length === 0 && !p.setup)) return <Empty machine={machine} />;
  const fold_ = folded.value;
  return (
    <div class="tree" role="tree" aria-label="Work">
      {projects.map((p) => {
        const closed = fold_.includes(p.project);
        return (
          <div key={p.project} role="none">
            <div class="tree-row tree-row--project" role="treeitem" aria-label={p.project} aria-expanded={!closed} onClick={() => fold(p.project)}>
              <span class="tree-fold">{closed ? '▸' : '▾'}</span>
              <span class="tree-name">{p.project}</span>
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
            {!closed && p.harnesses.map((h) => <HarnessRows key={h.harness} project={p} harness={h} onAgent={onAgent} machine={machine} />)}
            {!closed && p.setup && <Checklist needs={p.setup} />}
            {!closed && !p.setup && p.harnesses.length > 0 && p.harnesses.every((h) => h.works.length === 0) && (
              <p class="note tree-next">{p.ask && p.ask.key !== 'why.start_an_agent' ? fill(p.ask.key, { harness: p.ask.harness ?? '' }) : w('web.tree.ask_for_something')}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function HarnessRows({ project, harness: h, onAgent, machine }: { project: m.Project; harness: m.Harness; onAgent: (agent: string) => void; machine: Machine }) {
  const key = `${project.project}/${h.harness}`;
  const closed = folded.value.includes(key);
  const waiting = h.turn === 'waiting';
  return (
    <>
      <div
        class="tree-row tree-row--harness"
        role="treeitem"
        aria-label={h.harness}
        aria-expanded={!closed}
        // Its agent, or, when it runs none, what resuming it would pick up.
        onClick={() => (h.agent ? onAgent(h.agent) : !h.running ? offerResume(project.project, h.harness, h.session ?? null) : fold(key))}
      >
        <button
          class="tree-fold"
          type="button"
          aria-label={closed ? `Unfold ${h.harness}` : `Fold ${h.harness}`}
          onClick={(e) => {
            e.stopPropagation();
            fold(key);
          }}
        >
          {closed ? '▸' : '▾'}
        </button>
        <span class="tree-name">
          {h.harness}
          {h.turbo && ' ⚡'}
          {!h.running && <span class="tree-aside">{` · ${w('tree.not_running')}`}</span>}
        </span>
        {waiting && <span class="tree-aside needs" data-needs-you="true">{w('web.tree.needs_you')}</span>}
      </div>
      {!closed &&
        h.works.map((work) => (
          <div
            key={work.unit}
            class="tree-row tree-row--work"
            role="treeitem"
            aria-label={work.title}
            aria-selected={selected.value === work.unit}
            onClick={() => (selected.value = work.unit)}
            onDblClick={() => go({ name: 'detail', machine: machine.id, unit: work.unit })}
          >
            <span class="tree-name">{work.title}</span>
            <span class="tree-aside">
              {work.turn && (
                <>
                  <span class={work.turn === 'waiting' ? 'needs' : undefined} data-needs-you={work.turn === 'waiting' ? 'true' : undefined}>
                    {turnSaid(work.turn)}
                  </span>
                  {' · '}
                </>
              )}
              {stateWord(work.word)}
            </span>
            <button
              class="tree-more"
              type="button"
              aria-label={`Details of ${work.title}`}
              onClick={(e) => {
                e.stopPropagation();
                selected.value = work.unit;
                go({ name: 'detail', machine: machine.id, unit: work.unit });
              }}
            >
              ›
            </button>
          </div>
        ))}
    </>
  );
}

/** The phone's tree: the bar on top, the tree under it. */
export function TreePage({ machine }: { machine: Machine }) {
  return (
    <div class="app">
      <div class="appbar">
        <Mark />
        <h1>{machine.name}</h1>
        {m.link.value !== 'connected' && <LinkPill />}
        <span class="spacer" />
        <NeedsYouPill machine={machine} />
        <button class="menu" type="button" aria-label="Menu" onClick={() => go({ name: 'settings' })}>☰</button>
      </div>
      <TreeList machine={machine} onAgent={(agent) => go({ name: 'agent', machine: machine.id, agent })} />
      <TreeBar machine={machine} wide={false} />
    </div>
  );
}
