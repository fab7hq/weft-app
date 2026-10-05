// The TUI's tree (spec/atlas.md §4): projects, their harnesses, and the works
// asked of each, with the machine's words. Amber only for an agent that needs
// you. A tap selects a work, › opens its Details, a harness opens its agent.
import { signal } from '@preact/signals';
import type { Machine } from '../api';
import * as m from '../machine';
import { go } from '../nav';
import { fill, stateWord, turnWord, w } from '../words';

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

/** NEEDS YOU and how many: only while an agent asks for input. */
export function NeedsYouPill() {
  const n = m.needsYou.value;
  if (n === 0) return null;
  return <span class="needs-pill">{`${w('title.needs_you').toUpperCase()} ${n}`}</span>;
}

/** A turn, as the web says it. */
const turnSaid = (t: m.Agent['turn']) => (t === 'waiting' ? w('web.turn.waiting') : turnWord(t));

/** What the empty tree says, as the TUI's empty list does. */
function Empty({ machine }: { machine: Machine }) {
  const why = m.tree.value.find((p) => p.ask)?.ask;
  const lines =
    why?.key === 'why.no_ringframe'
      ? [w('tree.no_ringframe'), w('tree.install_ringframe')]
      : why && why.key !== 'why.start_an_agent'
        ? [fill(why.key, { harness: why.harness ?? '' }), w('tree.runs_either_way'), fill('web.why.set_up_on', { machine: machine.name })]
        : [w('tree.nothing_asked')];
  return (
    <div class="tree-empty">
      {lines.map((l) => (
        <p key={l} class="note">{l}</p>
      ))}
    </div>
  );
}

export function TreeList({ machine, onAgent }: { machine: Machine; onAgent: (agent: string) => void }) {
  const projects = m.tree.value;
  if (projects.every((p) => p.harnesses.length === 0)) return <Empty machine={machine} />;
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
            {!closed && p.harnesses.length > 0 && p.harnesses.every((h) => h.works.length === 0) && (
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
        onClick={() => (h.agent ? onAgent(h.agent) : fold(key))}
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
        <span class="spacer" />
        <NeedsYouPill />
        <button class="menu" type="button" aria-label="Menu" onClick={() => go({ name: 'settings' })}>☰</button>
      </div>
      <TreeList machine={machine} onAgent={(agent) => go({ name: 'agent', machine: machine.id, agent })} />
    </div>
  );
}
