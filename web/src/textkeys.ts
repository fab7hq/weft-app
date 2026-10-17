// What a key does in a text field: Weft's one table (text-keys.json, a copy of
// weft-core's), which the desktop's fields read too, with each system's keys:
// the Mac's ⌘ and ⌥, or Ctrl elsewhere.
import table from './text-keys.json';

export type System = 'macos' | 'linux';

/** The system the browser runs on, as the table names it. */
export function system(platform: string = globalThis.navigator?.platform ?? ''): System {
  return /mac|iphone|ipad/i.test(platform) ? 'macos' : 'linux';
}

const tables: Record<System, Record<string, string>> = table;

/** The keys of a key event that matter here. */
export interface Press {
  key: string;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
}

const names: Record<string, string> = { Enter: 'enter', Escape: 'escape', Tab: 'tab', ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', Home: 'home', End: 'end', Backspace: 'backspace', Delete: 'delete' };

/** The key as the table names it: `ctrl-alt-shift-cmd-key`. */
function chord(e: Press): string {
  const mods = [e.ctrlKey && 'ctrl', e.altKey && 'alt', e.shiftKey && 'shift', e.metaKey && 'cmd'].filter(Boolean);
  return [...mods, names[e.key] ?? e.key.toLowerCase()].join('-');
}

/** What the key does on `on`, if it is a text key. */
export function edit(e: Press, on: System = system()): string | null {
  return tables[on][chord(e)] ?? null;
}

/** The app's part of a text key: sending and the suggestion. The browser's own field does the rest. */
export function own(e: Press, on: System = system()): 'send' | 'take' | 'drop' | null {
  const d = edit(e, on);
  return d === 'send' || d === 'take' || d === 'drop' ? d : null;
}
