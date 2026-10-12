// Two agents side by side on a desktop (web-app.md, "Agents across
// projects"): the open agent, and the one shown beside it, never more. The
// open agent is the side with the keys; a click in the other side makes it so.
import { computed, effect, signal } from '@preact/signals';
import * as m from './machine';
import { here, swap } from './nav';
import { said } from './views/Bar';
import { w } from './words';

/** The agent beside the open one, and whether it is on the left; null: one pane. */
export const beside = signal<{ agent: string; left: boolean } | null>(null);
/** The agent looked at before the open one. */
const looked = signal<string | null>(null);

/** A window this wide or wider shows two agents; a narrower one shows one. */
const roomQuery = matchMedia('(min-width: 1100px)');
const room = signal(roomQuery.matches);
roomQuery.addEventListener('change', (e) => (room.value = e.matches));

/** Split is offered: a machine that shows two, in a window with room for them. */
export const offered = computed(() => m.canSplit.value && room.value);

const running = (agent: string) => m.agents.value.some((a) => a.agent === agent && a.running);

/** The running agents in the tree's order: its projects in turn, each one's in the order the machine lists them. */
export const tabbed = computed(() => {
  const order = m.tree.value.map((p) => p.project);
  const at = (project: string) => (order.includes(project) ? order.indexOf(project) : order.length);
  return m.agents.value.filter((a) => a.running).sort((a, b) => at(a.project) - at(b.project));
});

let open: string | null = null;
effect(() => {
  const v = here();
  if (v?.name !== 'agent' || v.agent === open) return;
  if (open) looked.value = open;
  open = v.agent;
});

/** The agent beside `agent` while two are shown, else null. */
export function besideOf(agent: string | null): { agent: string; left: boolean } | null {
  const b = beside.value;
  return b && agent && offered.value && b.agent !== agent && running(b.agent) ? b : null;
}

/** Show the agent looked at last beside the open one, which takes the right side. */
export function split(agent: string): void {
  const other = [looked.value, ...tabbed.value.map((a) => a.agent)].find((a) => a && a !== agent && running(a));
  if (!other) {
    said.value = w('why.split_needs_two');
    return;
  }
  beside.value = { agent: other, left: true };
}

export function onePane(): void {
  beside.value = null;
}

/** Open an agent: in the side with the keys, or, if it is the other side's, by moving to that side. */
export function show(machine: string, agent: string): void {
  const v = here();
  const now = v?.name === 'agent' ? v.agent : null;
  const b = besideOf(now);
  if (b && b.agent === agent && now) beside.value = { agent: now, left: !b.left };
  if (agent !== now) swap({ name: 'agent', machine, agent });
}
