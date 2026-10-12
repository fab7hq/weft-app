// This browser's panes (web-app.md, "Agents across projects"): a tree of
// them, each with its own tab bar, as many as the machine shows a device at
// once, four at most. The open agent is the one the pane you are in shows.
// The layout and the tab order are this browser's, kept in localStorage by
// machine; another device lays out the same agents its own way.
import { batch, computed, effect, signal } from '@preact/signals';
import * as L from './layout';
import * as m from './machine';
import { here, swap } from './nav';
import { said } from './views/Bar';
import { w } from './words';

const KEPT = 'weft.layout';

function kept(machine: string): L.Layout {
  try {
    return L.readLayout(JSON.parse(localStorage.getItem(KEPT) ?? '{}')[machine]) ?? L.fresh();
  } catch {
    return L.fresh();
  }
}

function keep(machine: string, layout: L.Layout): void {
  try {
    const all = JSON.parse(localStorage.getItem(KEPT) ?? '{}');
    localStorage.setItem(KEPT, JSON.stringify({ ...all, [machine]: layout }));
  } catch {
    // Storage refused: the layout lasts as long as the page.
  }
}

export const layout = signal<L.Layout>(L.fresh());
/** Where the panes are drawn: what a split must leave room in. */
export const room = signal<L.Room>({ width: 0, height: 0 });
/** The most panes: what the machine shows a device, four at most. */
export const most = computed(() => Math.min(4, m.panes.value));

/** The running agents in the tree's order: its projects in turn, each one's in the order the machine lists them. */
const inTree = computed(() => {
  const order = m.tree.value.map((p) => p.project);
  const at = (project: string) => (order.includes(project) ? order.indexOf(project) : order.length);
  return m.agents.value.filter((a) => a.running).sort((a, b) => at(a.project) - at(b.project));
});

/** The running agents in this device's tab order: pane by pane, each pane's tabs in the person's order. */
export const tabbed = computed(() => {
  const order = L.order(layout.value);
  const known = order.flatMap((id) => inTree.value.filter((a) => a.agent === id));
  return [...known, ...inTree.value.filter((a) => !order.includes(a.agent))];
});

const same = (a: L.Layout, b: L.Layout) => JSON.stringify(a) === JSON.stringify(b);
let of: string | null = null;

// The machine's layout, as this browser kept it.
effect(() => {
  const machine = m.current.value?.id ?? null;
  if (machine === of) return;
  of = machine;
  layout.value = machine ? kept(machine) : L.fresh();
});

// Its tabs, the agents running; known only once the machine has said.
effect(() => {
  const running = inTree.value.map((a) => a.agent);
  if (!m.welcomed.value) return;
  const next = L.sync(layout.peek(), running);
  if (!same(next, layout.peek())) layout.value = next;
});

// The open agent, shown in the pane that holds it, which gets the keys.
effect(() => {
  const v = here();
  const l = layout.value;
  if (v?.name !== 'agent' || L.showing(L.active(l)) === v.agent || L.paneOf(l, v.agent) === undefined) return;
  layout.value = L.show(l, v.agent);
});

effect(() => {
  const l = layout.value;
  if (of) keep(of, l);
});

/** A change to the layout; one refused says why above the bar, and nothing moves. */
function change(machine: string, how: (l: L.Layout) => L.Layout | L.Refusal): void {
  const next = how(layout.peek());
  if (typeof next === 'string') {
    said.value = w(next);
    return;
  }
  const agent = L.showing(L.active(next));
  batch(() => {
    layout.value = next;
    if (agent) swap({ name: 'agent', machine, agent });
  });
}

export const splitPane = (machine: string, pane: number, axis: L.Axis) =>
  change(machine, (l) => L.split(L.focus(l, pane), axis, room.value, most.value));
export const nextPane = (machine: string, pane: number) => change(machine, (l) => L.moveNext(L.focus(l, pane)));
export const joinAll = (machine: string) => change(machine, L.join);
export const focusPane = (machine: string, pane: number) => change(machine, (l) => L.focus(l, pane));
export const dropTab = (machine: string, agent: string, to: L.Drop) =>
  change(machine, (l) => L.drop(l, agent, to, room.value, most.value));

/** Open an agent, in the pane that holds it. */
export function show(machine: string, agent: string): void {
  const v = here();
  if (v?.name !== 'agent' || v.agent !== agent) swap({ name: 'agent', machine, agent });
}

/** The tab held by the mouse, and where it would land. */
export const held = signal<string | null>(null);
export const over = signal<L.Drop | null>(null);
