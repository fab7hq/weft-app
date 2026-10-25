// Done (17.18): the tree's place, showing every sealed unit of one project,
// parked first, with one search over title, verdict, decision and reason. A
// row opens its unit of work as any unit does; ‹ goes back to the tree.
import { signal } from '@preact/signals';
import { useEffect, useRef } from 'preact/hooks';
import type { Machine } from '../api';
import { stamp } from '../bar';
import { type Done, doneRead } from '../done';
import * as m from '../machine';
import { go } from '../nav';
import { fill, w } from '../words';

/** The project whose Done list stands in the tree's place, if any. */
export const doneOf = signal<string | null>(null);

/** What was read: the rows so far, the `after` of the next page, and the search they answer. */
const read = signal<{ rows: Done[]; next: string | null; q: string } | null>(null);
const typed = signal('');

async function load(project: string, q: string, after: string | null): Promise<void> {
  const answer = await m.request(doneRead(project, q, after));
  if (answer?.type !== 'ok' || doneOf.value !== project || typed.value.trim() !== q.trim()) return;
  const page = answer.done as { rows: Done[]; next: string | null };
  const before = after ? read.value?.rows ?? [] : [];
  read.value = { rows: [...before, ...page.rows], next: page.next, q };
}

/** Back to the tree. */
export function leaveDone(): void {
  doneOf.value = null;
  read.value = null;
  typed.value = '';
}

export function DoneList({ machine, project, wide }: { machine: Machine; project: string; wide: boolean }) {
  const q = typed.value;
  useEffect(() => {
    const t = setTimeout(() => void load(project, q, null), q ? 200 : 0);
    return () => clearTimeout(t);
  }, [project, q]);
  const end = useRef<HTMLDivElement>(null);
  const next = read.value?.next ?? null;
  useEffect(() => {
    const el = end.current;
    if (!el || !next) return;
    const seen = new IntersectionObserver((e) => e.some((x) => x.isIntersecting) && void load(project, q, next));
    seen.observe(el);
    return () => seen.disconnect();
  }, [next]);
  const rows = read.value?.rows ?? [];
  const name = m.tree.value.find((p) => p.project === project)?.project.split('/').pop() ?? project;
  const open = (d: Done) => go({ name: 'work', machine: machine.id, project, unit: d.unit });
  const section = (key: string) => (
    <div class="tree-section" role="none"><span class="tree-section-name">{w(key)}</span></div>
  );
  const parked = rows.filter((d) => d.parked);
  const sealed = rows.filter((d) => !d.parked);
  return (
    <div class="tree done" role="tree" aria-label={w('done.title')}>
      <div class="done-head">
        <button class="done-back" type="button" onClick={leaveDone}>{`‹ ${name}`}</button>
        <span class="done-title">{w('done.title')}</span>
      </div>
      <div class={q ? 'tree-search tree-search--on' : 'tree-search'}>
        <span class="tree-glass" aria-hidden="true">⌕</span>
        <input class="tree-field" type="search" aria-label={w('done.search')} placeholder={w('done.search')} autocomplete="off"
          value={q} onInput={(e) => (typed.value = (e.target as HTMLInputElement).value)} />
        {q && <button class="tree-clear" type="button" aria-label={w('web.search.clear')} onClick={() => (typed.value = '')}>✕</button>}
      </div>
      {parked.length > 0 && section('done.parked')}
      {parked.map((d) => <DoneRow key={d.unit} d={d} wide={wide} onOpen={open} />)}
      {sealed.length > 0 && section('done.sealed')}
      {sealed.map((d) => <DoneRow key={d.unit} d={d} wide={wide} onOpen={open} />)}
      {read.value && rows.length === 0 && q && <p class="tree-next">{fill('done.none', { q })}</p>}
      {next && <div ref={end} class="tree-more-rows" aria-hidden="true" />}
    </div>
  );
}

function DoneRow({ d, wide, onOpen }: { d: Done; wide: boolean; onOpen: (d: Done) => void }) {
  const verdict = d.verdict === 'aligned' ? 'good' : d.verdict === 'drifted' ? 'needs' : '';
  return (
    <div class="tree-row done-row" role="treeitem" aria-label={d.title} onClick={() => onOpen(d)}>
      <span class="done-lines">
        <span class="work-line">
          <span class="work-title">{d.title}</span>
          <span class="agent-sep">·</span>
          <span class="work-harness">{d.harness}</span>
        </span>
        <span class="done-said">
          <span class={d.parked ? 'needs' : ''}>{[d.decision, d.reason].filter(Boolean).join(' · ')}</span>
          {d.verdict && <span class="agent-sep">·</span>}
          {d.verdict && <span class={verdict}>{d.verdict}</span>}
        </span>
      </span>
      <span class="agent-at">{stamp(Date.parse(d.at)).slice(0, 10)}</span>
      {!wide && <span class="tree-more" aria-hidden="true">›</span>}
    </div>
  );
}
