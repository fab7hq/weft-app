// Panes, as an editor lays out its tabs: a tree of them, each with its own
// tab bar. An agent is in exactly one pane, and a split moves it there; it is
// never shown twice. Panes share the space equally. Each function returns a
// new layout, or why it would not change one; nothing moves when it would not.

export type Axis = 'right' | 'down';
export type Side = 'left' | 'right' | 'up' | 'down';
export type Pane = { id: number; tabs: string[]; shown: number };
export type Node = { pane: Pane } | { axis: Axis; kids: Node[] };
export type Layout = { root: Node; active: number; next: number };
/** Where a dragged tab lands: its place on a pane's tab bar, a pane's outer fifth, or a pane's middle. */
export type Drop = { bar: number; at: number } | { edge: number; side: Side } | { middle: number };
/** Why a split did not happen. */
export type Refusal = 'why.split_needs_two' | 'web.why.four_panes' | 'why.no_room';
export type Room = { width: number; height: number };
type Rect = { id: number; x: number; y: number; width: number; height: number };

/** The least a pane may be, its tab bar and message row included. */
export const LEAST: Room = { width: 360, height: 200 };

export const fresh = (): Layout => ({ root: { pane: { id: 0, tabs: [], shown: 0 } }, active: 0, next: 1 });

function leaves(node: Node, out: Pane[] = []): Pane[] {
  if ('pane' in node) out.push(node.pane);
  else node.kids.forEach((k) => leaves(k, out));
  return out;
}

function place(node: Node, r: Omit<Rect, 'id'>, out: Rect[]): void {
  if ('pane' in node) {
    out.push({ id: node.pane.id, ...r });
    return;
  }
  const n = node.kids.length;
  node.kids.forEach((kid, i) =>
    place(kid, node.axis === 'right'
      ? { ...r, x: r.x + (r.width / n) * i, width: r.width / n }
      : { ...r, y: r.y + (r.height / n) * i, height: r.height / n }, out));
}

/** Where each pane is in a room, left to right, top to bottom. */
export function rects(layout: Layout, room: Room): Rect[] {
  const out: Rect[] = [];
  place(layout.root, { x: 0, y: 0, ...room }, out);
  return out.sort((a, b) => a.y - b.y || a.x - b.x);
}

/** Every pane, left to right, top to bottom. */
export function panes(layout: Layout): Pane[] {
  const all = leaves(layout.root);
  return rects(layout, { width: 1200, height: 1200 }).map((r) => all.find((p) => p.id === r.id)!);
}

export const count = (layout: Layout) => leaves(layout.root).length;
export const pane = (layout: Layout, id: number) => leaves(layout.root).find((p) => p.id === id);
export const active = (layout: Layout) => pane(layout, layout.active) ?? panes(layout)[0];
/** Every agent, pane by pane, in each pane's order: what the tabs count. */
export const order = (layout: Layout) => panes(layout).flatMap((p) => p.tabs);
export const paneOf = (layout: Layout, agent: string) => leaves(layout.root).find((p) => p.tabs.includes(agent))?.id;
export const showing = (p: Pane | undefined) => p?.tabs[p.shown];
/** Every pane is at least the least size in this room. */
export const fits = (layout: Layout, room: Room) =>
  rects(layout, room).every((r) => r.width >= LEAST.width && r.height >= LEAST.height);

const copy = (layout: Layout): Layout => structuredClone(layout);

/** Take a pane out; a split left with one becomes it, and one inside another going its way joins it. */
function close(node: Node, id: number): Node {
  if ('pane' in node) return node;
  const kids = node.kids
    .filter((k) => !('pane' in k && k.pane.id === id))
    .map((k) => close(k, id))
    .flatMap((k) => ('axis' in k && k.axis === node.axis ? k.kids : [k]));
  return kids.length === 1 ? kids[0] : { axis: node.axis, kids };
}

/** Take an agent out of its pane; a pane left empty closes, unless it is the last. */
function remove(l: Layout, agent: string): void {
  const p = leaves(l.root).find((x) => x.tabs.includes(agent));
  if (!p) return;
  const i = p.tabs.indexOf(agent);
  p.tabs.splice(i, 1);
  if (i < p.shown || p.shown >= p.tabs.length) p.shown = Math.max(0, p.shown - 1);
  if (p.tabs.length === 0 && count(l) > 1) {
    l.root = close(l.root, p.id);
    if (l.active === p.id) l.active = panes(l)[0].id;
  }
}

/** A new pane beside another, that way: among its siblings when they go that way, else in a split of its own. */
function beside(node: Node, target: number, axis: Axis, after: boolean, add: Node): Node {
  if ('pane' in node) return node.pane.id === target ? { axis, kids: after ? [node, add] : [add, node] } : node;
  const i = node.kids.findIndex((k) => 'pane' in k && k.pane.id === target);
  if (i >= 0 && node.axis === axis) {
    const kids = [...node.kids];
    kids.splice(after ? i + 1 : i, 0, add);
    return { axis, kids };
  }
  return { axis: node.axis, kids: node.kids.map((k) => beside(k, target, axis, after, add)) };
}

/** Keep the tabs to the agents running: one that ended goes, a pane left empty closes, and a new one opens as the last tab of the pane with the keys. */
export function sync(layout: Layout, running: string[]): Layout {
  const l = copy(layout);
  for (const a of order(l)) if (!running.includes(a)) remove(l, a);
  const known = order(l);
  const p = active(l);
  for (const a of running) if (!known.includes(a)) p.tabs.push(a);
  return l;
}

/** Show an agent in the pane that holds it, and give that pane the keys. */
export function show(layout: Layout, agent: string): Layout {
  const l = copy(layout);
  const p = leaves(l.root).find((x) => x.tabs.includes(agent));
  if (!p) return layout;
  p.shown = p.tabs.indexOf(agent);
  l.active = p.id;
  return l;
}

export function focus(layout: Layout, id: number): Layout {
  return pane(layout, id) ? { ...copy(layout), active: id } : layout;
}

/** The tab with the keys into a new pane that way, which gets the keys. */
export function split(layout: Layout, axis: Axis, room: Room, most: number): Layout | Refusal {
  const agent = showing(active(layout));
  if (!agent) return 'why.split_needs_two';
  return drop(layout, agent, { edge: active(layout).id, side: axis === 'right' ? 'right' : 'down' }, room, most);
}

/** The tab with the keys into the next pane, as its last tab; one pane has no next. */
export function moveNext(layout: Layout): Layout {
  const all = panes(layout);
  const agent = showing(active(layout));
  if (all.length < 2 || !agent) return layout;
  const next = all[(all.findIndex((p) => p.id === active(layout).id) + 1) % all.length];
  const done = drop(layout, agent, { bar: next.id, at: next.tabs.length }, { width: Infinity, height: Infinity }, Infinity);
  return typeof done === 'string' ? layout : done;
}

/** One pane again, every tab in it in the order they were numbered. */
export function join(layout: Layout): Layout {
  const tabs = order(layout);
  const shown = showing(active(layout));
  const id = layout.next;
  return { root: { pane: { id, tabs, shown: Math.max(0, tabs.indexOf(shown ?? '')) } }, active: id, next: id + 1 };
}

/** A dragged tab, dropped. A split this way is refused as `split` is. */
export function drop(layout: Layout, agent: string, to: Drop, room: Room, most: number): Layout | Refusal {
  const from = paneOf(layout, agent);
  if (from === undefined) return layout;
  const l = copy(layout);
  if ('bar' in to) {
    const target = pane(l, to.bar);
    if (!target) return layout;
    let at = to.at;
    if (to.bar === from && target.tabs.indexOf(agent) < at) at -= 1;
    remove(l, agent);
    const p = pane(l, to.bar)!;
    at = Math.min(at, p.tabs.length);
    p.tabs.splice(at, 0, agent);
    p.shown = at;
    l.active = to.bar;
    return l;
  }
  if ('middle' in to) {
    if (to.middle === from || !pane(l, to.middle)) return layout;
    remove(l, agent);
    const p = pane(l, to.middle)!;
    p.tabs.push(agent);
    p.shown = p.tabs.length - 1;
    l.active = to.middle;
    return l;
  }
  const target = pane(l, to.edge);
  if (!target) return layout;
  if (to.edge === from && target.tabs.length < 2) return 'why.split_needs_two';
  remove(l, agent);
  // A machine that shows fewer than four has no room for another.
  if (count(l) >= most) return most >= 4 ? 'web.why.four_panes' : 'why.no_room';
  const id = l.next++;
  const axis: Axis = to.side === 'left' || to.side === 'right' ? 'right' : 'down';
  l.root = beside(l.root, to.edge, axis, to.side === 'right' || to.side === 'down', { pane: { id, tabs: [agent], shown: 0 } });
  l.active = id;
  return fits(l, room) ? l : 'why.no_room';
}

/** Where a point in a pane lands: its outer fifth splits that way, its middle joins it. */
export function zone(id: number, fx: number, fy: number): Drop {
  const edges: [number, Side][] = [[fx, 'left'], [1 - fx, 'right'], [fy, 'up'], [1 - fy, 'down']];
  const [near, side] = edges.reduce((a, b) => (b[0] < a[0] ? b : a));
  return near < 0.2 ? { edge: id, side } : { middle: id };
}

/** A layout read back from storage, if it is one. */
export function readLayout(v: unknown): Layout | null {
  const ok = (n: unknown): boolean => {
    if (!n || typeof n !== 'object') return false;
    if ('pane' in n) {
      const p = (n as { pane: Pane }).pane;
      return Number.isInteger(p?.id) && Array.isArray(p.tabs) && p.tabs.every((t) => typeof t === 'string') && Number.isInteger(p.shown);
    }
    const s = n as { axis: unknown; kids: unknown };
    return (s.axis === 'right' || s.axis === 'down') && Array.isArray(s.kids) && s.kids.length > 0 && s.kids.every(ok);
  };
  const l = v as Layout;
  return l && ok(l.root) && Number.isInteger(l.active) && Number.isInteger(l.next) ? l : null;
}
