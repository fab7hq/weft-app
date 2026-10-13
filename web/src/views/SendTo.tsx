// SEND TO (M4.3, M4.4, M4.6, D4.3, D4.4, D4.6): where an Ask or a prompt
// goes. A list in two parts: the project's running agents, named and ordered
// as their tabs, the one that wrote it first; then START AN AGENT, a new agent
// of each harness the project starts. Closed, the picked one and ▾; open, the
// list in its place, the picked one ✓. A button that opens a listbox, as a
// select is read: arrows move, Enter or Space picks, Escape or Tab closes.
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import * as m from '../machine';
import { tabbed } from '../panes';
import { fill, w } from '../words';

/** Where it goes: a running agent, or a new one of a harness. */
export type Dest = { agent: string } | { start: string };

interface Row {
  key: string;
  label: string;
  /** The agent that wrote it. */
  wrote: boolean;
  dest: Dest;
}

export const keyOf = (d: Dest) => ('agent' in d ? d.agent : `start:${d.start}`);

/** The rows, in order: the agent that wrote it, the project's other agents as their tabs, then the new ones. */
export function destinations(project: string | undefined, wrote?: string): Row[] {
  const here = (p: string) => !project || p === project;
  const agents = tabbed.value.filter((a) => a.running && here(a.project));
  const first = agents.filter((a) => a.agent === wrote);
  const rows: Row[] = [...first, ...agents.filter((a) => a.agent !== wrote)].map((a) => ({
    key: a.agent,
    label: `${a.project} · ${a.harness}`,
    wrote: a.agent === wrote,
    dest: { agent: a.agent },
  }));
  for (const s of m.harnesses.value.filter((s) => here(s.project))) {
    rows.push({ key: `start:${s.harness}`, label: fill('start.fresh', { harness: s.harness }), wrote: false, dest: { start: s.harness } });
  }
  return rows;
}

export function SendTo({ rows, to, onPick }: { rows: Row[]; to: string; onPick: (d: Dest) => void }) {
  const [open, setOpen] = useState(false);
  const at = Math.max(0, rows.findIndex((r) => r.key === to));
  const [active, setActive] = useState(at);
  const list = useRef<HTMLUListElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const back = useRef(false);
  // The focus moves with the list as soon as it is drawn.
  useLayoutEffect(() => {
    if (open) list.current?.focus();
    else if (back.current) {
      back.current = false;
      button.current?.focus();
    }
  }, [open]);
  const show = (i = at) => {
    setActive(i);
    setOpen(true);
  };
  const shut = (focus: boolean) => {
    back.current = focus;
    setOpen(false);
  };
  const pick = (i: number) => {
    const r = rows[i];
    if (r) onPick(r.dest);
    shut(true);
  };
  if (!open) {
    const picked = rows[at];
    return (
      <button
        ref={button}
        type="button"
        class="ask-to"
        aria-haspopup="listbox"
        aria-expanded="false"
        aria-labelledby={picked?.wrote ? 'ask-to-label ask-to-value ask-to-wrote' : 'ask-to-label ask-to-value'}
        onClick={() => show()}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            show();
          }
        }}
      >
        <span id="ask-to-value" class="ask-to-name">{picked?.label ?? ''}</span>
        {picked?.wrote && (
          <span id="ask-to-wrote" class="ask-to-wrote">
            {w('send.wrote_it')}
          </span>
        )}
        <span class="ask-to-arrow" aria-hidden="true">▾</span>
      </button>
    );
  }
  const firstNew = rows.findIndex((r) => 'start' in r.dest);
  return (
    <ul
      ref={list}
      class="ask-to ask-to--open"
      role="listbox"
      tabIndex={-1}
      aria-labelledby="ask-to-label"
      aria-activedescendant={`ask-to-${active}`}
      // Leaving the list closes it; a pick or Escape, closing it already, takes the focus back.
      onBlur={(e) => !back.current && !list.current?.contains(e.relatedTarget as Node | null) && shut(false)}
      onKeyDown={(e) => {
        const last = rows.length - 1;
        const keys: Record<string, () => void> = {
          ArrowDown: () => setActive(Math.min(last, active + 1)),
          ArrowUp: () => setActive(Math.max(0, active - 1)),
          Home: () => setActive(0),
          End: () => setActive(last),
          Enter: () => pick(active),
          ' ': () => pick(active),
          Escape: () => shut(true),
        };
        const go = keys[e.key];
        if (e.key === 'Tab') return shut(false);
        if (!go) return;
        e.preventDefault();
        // Escape closes the list, not the sheet around it.
        e.stopPropagation();
        go();
      }}
    >
      {rows.map((r, i) => [
        i === firstNew && (
          <li key="new" role="presentation" class="ask-to-heading">
            {w('start.title').toUpperCase()}
          </li>
        ),
        <li
          key={r.key}
          id={`ask-to-${i}`}
          role="option"
          aria-selected={r.key === to}
          class={i === active ? 'ask-to-option ask-to-option--active' : 'ask-to-option'}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => pick(i)}
        >
          <span class="ask-to-name">{r.label}</span>
          {r.wrote && <span class="ask-to-wrote">{w('send.wrote_it')}</span>}
        </li>,
      ])}
    </ul>
  );
}
