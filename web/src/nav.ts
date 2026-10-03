// Where the person is. One address, `/`, always (web-app.md §4): the views
// are the app's own state, and the back gesture moves through them.
import { signal } from '@preact/signals';

export type View =
  | { name: 'signin' }
  | { name: 'add' }
  | { name: 'machines' }
  | { name: 'agents'; machine: string }
  | { name: 'agent'; machine: string; agent: string }
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

export function back(): void {
  history.back();
}

addEventListener('popstate', (e) => {
  const depth = (e.state as { depth?: number } | null)?.depth ?? 0;
  stack.value = stack.value.slice(0, depth + 1);
});
