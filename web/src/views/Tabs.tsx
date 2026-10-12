// A pane's tabs (web-app.md, "Agents across projects"): its running agents,
// in the person's order, named `project · harness`. One that needs its
// person carries an amber ●; one whose harness is not set up for RingFrame
// carries ⚠. A click shows it; a drag moves it. The bar ends in the
// layout button, the web's form of the TUI's layout bar.
import { useEffect, useState } from 'preact/hooks';
import * as L from '../layout';
import * as m from '../machine';
import { dropTab, held, joinAll, most, nextPane, over, show, splitPane } from '../panes';
import { w } from '../words';

/** Whether the agent's harness is not set up for RingFrame in its project, as the tree says. */
export const notSetUp = (a: m.Agent) =>
  m.tree.value.some((p) => p.project === a.project && p.ask?.key === 'why.not_set_up' && p.ask.harness === a.harness);

/** A tab's name and marks. */
export function TabName({ a }: { a: m.Agent }) {
  return (
    <>
      {`${a.project} · ${a.harness}${notSetUp(a) ? ' ⚠' : ''}`}
      {a.turn === 'waiting' && <span class="tab-needs"> ●</span>}
    </>
  );
}

/** A dragged tab let go where it would land. */
export function dropped(machine: string, e: DragEvent): void {
  e.preventDefault();
  e.stopPropagation();
  const [agent, to] = [held.value, over.value];
  held.value = null;
  over.value = null;
  if (agent && to) dropTab(machine, agent, to);
}

/** A press on the layout button or its menu leaves the keys where they were: in the pane you are in. */
const keepFocus = (e: MouseEvent) => e.preventDefault();

/** The four-pane icon. */
const Icon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true">
    <rect x="1.5" y="1.5" width="13" height="13" rx="2" />
    <line x1="8" y1="1.5" x2="8" y2="14.5" />
    <line x1="1.5" y1="8" x2="14.5" y2="8" />
  </svg>
);

/** The layout button and its menu: an item that cannot apply says why above the bar. */
function LayoutMenu({ machine, pane }: { machine: string; pane: number }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => !(e.target as Element).closest('.layout-at') && setOpen(false);
    addEventListener('pointerdown', close);
    return () => removeEventListener('pointerdown', close);
  }, [open]);
  if (most.value < 2) return null;
  const items: [string, () => void][] = [
    ['web.layout.split_right', () => splitPane(machine, pane, 'right')],
    ['web.layout.split_down', () => splitPane(machine, pane, 'down')],
    ['web.layout.next_pane', () => nextPane(machine, pane)],
    ['web.layout.join', () => joinAll(machine)],
  ];
  return (
    <div class="layout-at">
      <button class="layout-button" type="button" aria-label={w('act.layout')} aria-haspopup="menu" aria-expanded={open} onMouseDown={keepFocus} onClick={() => setOpen(!open)}>
        <Icon />
        <span class="layout-caret" aria-hidden="true">▾</span>
      </button>
      {open && (
        <div class="layout-menu" role="menu" aria-label={w('act.layout')}>
          {items.map(([word, act]) => (
            <button key={word} type="button" role="menuitem" onMouseDown={keepFocus} onClick={() => (setOpen(false), act())}>{w(word)}</button>
          ))}
        </div>
      )}
    </div>
  );
}

/** A pane's tab bar: its tabs, then the layout button. `current`: the pane you are in. */
export function Tabs({ machine, pane, current }: { machine: string; pane: L.Pane; current: boolean }) {
  const bar = over.value && 'bar' in over.value && over.value.bar === pane.id;
  // Where along the bar a held tab would go: before the first tab whose middle is past the pointer.
  const along = (e: DragEvent) => {
    if (!held.value) return;
    e.preventDefault();
    e.stopPropagation();
    const tabs = [...(e.currentTarget as Element).querySelectorAll('.tab')];
    const at = tabs.findIndex((t) => {
      const r = t.getBoundingClientRect();
      return r.left + r.width / 2 > e.clientX;
    });
    over.value = { bar: pane.id, at: at < 0 ? tabs.length : at };
  };
  return (
    <div class={bar ? 'tab-row tab-row--drop' : 'tab-row'}>
      <nav class="tabs" aria-label="Tabs" onDragOver={along} onDrop={(e) => dropped(machine, e)}>
        {pane.tabs.map((id, i) => {
          const a = m.agents.value.find((x) => x.agent === id && x.running);
          if (!a) return null;
          const shown = i === pane.shown;
          return (
            <button
              key={id}
              type="button"
              draggable
              class={a.turn === 'waiting' ? 'tab tab--needs-you' : 'tab'}
              data-needs-you={a.turn === 'waiting' ? 'true' : undefined}
              data-shown={shown ? 'true' : undefined}
              data-held={held.value === id ? 'true' : undefined}
              aria-current={shown && current ? 'page' : undefined}
              onClick={() => show(machine, id)}
              onDragStart={(e) => {
                e.dataTransfer?.setData('text/plain', id);
                held.value = id;
              }}
              onDragEnd={() => ((held.value = null), (over.value = null))}
            >
              <TabName a={a} />
            </button>
          );
        })}
      </nav>
      <LayoutMenu machine={machine} pane={pane.id} />
    </div>
  );
}
