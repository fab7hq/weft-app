// Where the person is. One address, `/`, always (web-app.md §4): the views
// are the app's own state, and the back gesture moves through them.
import { signal } from '@preact/signals';
import type { Ref } from './viewer/kinds';

export type View =
  | { name: 'signin' }
  | { name: 'add' }
  | { name: 'machines' }
  | { name: 'tree'; machine: string }
  | { name: 'agent'; machine: string; agent: string }
  /** A unit of work's Details: its workflow and its acts. */
  | { name: 'work'; machine: string; project: string; unit: string }
  /** An Ask's Details (M11.2). */
  | { name: 'detail'; machine: string; project: string; unit: string }
  /** An Eval's Details (M11.3), a Seal's (M11.4), a session's (M11.5). */
  | { name: 'round'; machine: string; project: string; eval: string }
  | { name: 'seal'; machine: string; project: string; seal: string }
  | { name: 'session'; machine: string; project: string; session: string }
  /** The Eval view of an Eval (M6.x), at one of its pages. */
  | { name: 'eval'; machine: string; project: string; eval: string; at?: string }
  | { name: 'start'; machine: string; from: string; harness?: string; project?: string }
  | { name: 'settings' }
  /** A machine's own settings, on one of its tabs. */
  | { name: 'machine'; machine: string; tab?: 'general' | 'workflow' | 'ringframe' | 'harnesses' }
  /** A project's own settings: what differs from every project's. */
  | { name: 'project'; machine: string; project: string }
  /** A file an agent pointed at, over the view it was opened from. */
  | { name: 'file'; machine: string; agent: string; ref: Ref };

export const stack = signal<View[]>([]);

export const here = () => stack.value[stack.value.length - 1];

/** The view shown under the sheets on top: a file is opened over the view it came from. */
export function under(): View | undefined {
  for (let i = stack.value.length - 1; i >= 0; i--) if (stack.value[i].name !== 'file') return stack.value[i];
  return undefined;
}

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
