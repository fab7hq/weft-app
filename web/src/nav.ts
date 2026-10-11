// Where the person is. One address, `/`, always (web-app.md §4): the views
// are the app's own state, and the back gesture moves through them.
import { signal } from '@preact/signals';

export type View =
  | { name: 'signin' }
  | { name: 'add' }
  | { name: 'machines' }
  | { name: 'tree'; machine: string }
  | { name: 'agent'; machine: string; agent: string }
  /** A work's Details (M11.2): its Ask only. */
  | { name: 'detail'; machine: string; project: string; unit: string }
  /** An Eval's Details (M11.3), a Seal's (M11.4), a session's (M11.5). */
  | { name: 'round'; machine: string; project: string; eval: string }
  | { name: 'seal'; machine: string; project: string; seal: string }
  | { name: 'session'; machine: string; project: string; session: string }
  /** The Eval view of an Eval (M6.x), at one of its pages. */
  | { name: 'eval'; machine: string; project: string; eval: string; at?: string; files?: boolean }
  | { name: 'start'; machine: string; from: string; harness?: string; project?: string }
  | { name: 'settings' };

export const stack = signal<View[]>([]);

export const here = () => stack.value[stack.value.length - 1];

/** Start over at this view, with nothing to go back to. */
export function reset(view: View): void {
  stack.value = [view];
  history.replaceState({ depth: 0 }, '', '/');
}

export function go(view: View): void {
  stack.value = [...stack.value, view];
  history.pushState({ depth: stack.value.length - 1 }, '', '/');
}

/** Put this view in place of the one shown: no new step for the back gesture. */
export function swap(view: View): void {
  stack.value = [...stack.value.slice(0, -1), view];
}

export function back(): void {
  history.back();
}

/** Go back past every view on top named here. */
export function leave(names: View['name'][]): void {
  let n = 0;
  for (let i = stack.value.length - 1; i > 0 && names.includes(stack.value[i].name); i--) n++;
  if (n) history.go(-n);
}

addEventListener('popstate', (e) => {
  const depth = (e.state as { depth?: number } | null)?.depth ?? 0;
  stack.value = stack.value.slice(0, depth + 1);
});
