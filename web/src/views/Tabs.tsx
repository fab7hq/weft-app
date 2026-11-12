// A pane's tabs (web-app.md, "Agents across projects"): its running agents,
// in the person's order, named `project · harness`. One that needs its
// person carries an amber ●; one whose harness is not set up for RingFrame
// carries ⚠. A click shows it; a drag moves it; its ✕ hides it, the agent
// running on. The tabs scroll sideways. The bar ends in the layout button,
// the web's form of the desktop app's layout bar.
import { useEffect, useRef, useState } from 'preact/hooks';
import * as L from '../layout';
import * as m from '../machine';
import { dropTab, held, hideTab, joinAll, most, nextPane, over, show, splitPane } from '../panes';
import { w } from '../words';
import { ViewSwitch } from './Conversation';

/** Whether the agent's harness is not set up for RingFrame in its project, as the tree says. */
export const notSetUp = (a: m.Agent) =>
  m.tree.value.some((p) => p.project === a.project && p.ask?.key === 'why.not_set_up' && p.ask.harness === a.harness);

/** A tab's name and marks. */
export function TabName({ a }: { a: m.Agent }) {
  return (
    <>
      {/* Every tab leads with its agent's status: ● running, ■ needs you, □ ended. */}
      <span class={a.turn === 'waiting' && a.running ? 'tab-shape needs' : a.running ? 'tab-shape good' : 'tab-shape'} aria-hidden="true">
        {a.turn === 'waiting' && a.running ? '■' : a.running ? '●' : '□'}
      </span>
      {`${a.project} · ${a.harness}${notSetUp(a) ? ' ⚠' : ''}`}
      {m.tree.value.some((p) => p.project === a.project && p.turbo) && <span class="tab-turbo"> ⚡</span>}
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
export function LayoutMenu({ machine, pane }: { machine: string; pane: number }) {
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
export function Tabs({ machine, pane, current, controls = true }: { machine: string; pane: L.Pane; current: boolean; controls?: boolean }) {
  const bar = over.value && 'bar' in over.value && over.value.bar === pane.id;
  // The tab in front is scrolled into view whenever another comes to the front.
  const strip = useRef<HTMLElement>(null);
  const front = pane.tabs[pane.shown];
  useEffect(() => {
    strip.current?.querySelector('[data-shown="true"]')?.closest('.tab')?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [front]);
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
      <nav ref={strip} class="tabs" aria-label="Tabs" onDragOver={along} onDrop={(e) => dropped(machine, e)}>
        {pane.tabs.map((id, i) => {
          const a = m.agents.value.find((x) => x.agent === id && x.running);
          if (!a) return null;
          const shown = i === pane.shown;
          return (
            // The tab and its ✕ are two buttons side by side: a control inside a button has no name of its own.
            <div
              key={id}
              draggable
              class={a.turn === 'waiting' ? 'tab tab--needs-you' : 'tab'}
              data-held={held.value === id ? 'true' : undefined}
              onDragStart={(e) => {
                e.dataTransfer?.setData('text/plain', id);
                held.value = id;
              }}
              onDragEnd={() => ((held.value = null), (over.value = null))}
            >
              <button
                type="button"
                class="tab-name"
                data-needs-you={a.turn === 'waiting' ? 'true' : undefined}
                data-shown={shown ? 'true' : undefined}
                aria-current={shown && current ? 'page' : undefined}
                onClick={() => show(machine, id)}
              >
                <TabName a={a} />
              </button>
              <button type="button" class="tab-close" aria-label={w('act.close')} onMouseDown={keepFocus} onClick={() => hideTab(machine, id)}>
                ✕
              </button>
            </div>
          );
        })}
      </nav>
      {/* Split, the view switch and the layout are once above the panes. */}
      {controls && <ViewSwitch wide />}
      {controls && <LayoutMenu machine={machine} pane={pane.id} />}
    </div>
  );
}
