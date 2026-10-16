// A hardware keyboard on a tablet or a desktop, into the open agent
// (web-app.md §6): the key bar's encodings plus printable characters. Cmd
// shortcuts stay the browser's.
const NAMED: Record<string, number[]> = {
  Escape: [0x1b],
  Tab: [0x09],
  Enter: [0x0d],
  Backspace: [0x7f],
  ArrowUp: [0x1b, 0x5b, 0x41],
  ArrowDown: [0x1b, 0x5b, 0x42],
  ArrowRight: [0x1b, 0x5b, 0x43],
  ArrowLeft: [0x1b, 0x5b, 0x44],
};

// The keys that carry Shift, Alt and Ctrl as xterm's modifier parameter, as
// the key bar's do: Shift+Left is ESC [1;2D, never a plain Left.
const MODIFIED: Record<string, string> = { ArrowUp: 'Up', ArrowDown: 'Down', ArrowRight: 'Right', ArrowLeft: 'Left', PageUp: 'PgUp', PageDown: 'PgDn', Tab: 'Tab' };

/** The bytes a key sends, or nothing for a key that is the browser's. */
export function encode(e: KeyboardEvent): number[] | null {
  if (e.metaKey || e.isComposing) return null;
  if (MODIFIED[e.key] && (e.shiftKey || e.altKey || e.ctrlKey)) return modified(MODIFIED[e.key], e.shiftKey, e.altKey, e.ctrlKey);
  if (NAMED[e.key]) return NAMED[e.key];
  if (e.ctrlKey && !e.altKey && /^[a-z]$/i.test(e.key)) return [e.key.toUpperCase().charCodeAt(0) - 64];
  if (e.key.length >= 1 && [...e.key].length === 1 && !e.ctrlKey) return [...new TextEncoder().encode(e.key)];
  return null;
}

// --- The key bar (web-app.md §6): generic keys in two rows. Weft names no
// harness's shortcuts; a person composes them from these. Row two's keys light
// until the next key: a row-two key, then a row-one key, is one combination.

export interface Mods {
  ctrl: boolean;
  alt: boolean;
  tab: boolean;
}
export const NONE: Mods = { ctrl: false, alt: false, tab: false };

interface Key {
  label: string;
  name: string;
  mod?: keyof Mods;
}

/** Row one, always shown: arrows, delete, Esc, Enter, and Fn, which opens row two. */
export const ROW_ONE: Key[] = [
  { label: 'Esc', name: 'Esc' },
  { label: '↑', name: 'Up' },
  { label: '↓', name: 'Down' },
  { label: '←', name: 'Left' },
  { label: '→', name: 'Right' },
  { label: '⌫', name: 'Backspace' },
  { label: '⏎', name: 'Enter' },
  { label: 'Fn', name: 'Fn' },
];

/** Row two, opened by Fn. */
export const ROW_TWO: Key[] = [
  { label: 'Ctrl', name: 'Ctrl', mod: 'ctrl' },
  { label: 'Alt', name: 'Alt', mod: 'alt' },
  { label: 'Tab', name: 'Tab', mod: 'tab' },
];

const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));
const CSI = [0x1b, 0x5b];
const ARROWS: Record<string, string> = { Up: 'A', Down: 'B', Right: 'C', Left: 'D' };
const PAGES: Record<string, string> = { PgUp: '5', PgDn: '6' };

/** An arrow, a page key or Tab with Shift, Alt and Ctrl, as xterm encodes
 * them: the modifier parameter is 1 + Shift 1 + Alt 2 + Ctrl 4. */
function modified(name: string, shift: boolean, alt: boolean, ctrl: boolean): number[] {
  const p = 1 + (shift ? 1 : 0) + (alt ? 2 : 0) + (ctrl ? 4 : 0);
  if (ARROWS[name]) return p === 1 ? [...CSI, ...ascii(ARROWS[name])] : [...CSI, ...ascii(`1;${p}${ARROWS[name]}`)];
  if (PAGES[name]) return [...CSI, ...ascii(p === 1 ? `${PAGES[name]}~` : `${PAGES[name]};${p}~`)];
  if (shift) return [...CSI, 0x5a];
  const tab = [0x09];
  return alt ? [0x1b, ...tab] : tab;
}

/** The bytes a key bar key sends with what row two has lit. */
export function chord(name: string, m: Mods): number[] {
  let bytes: number[];
  if (ARROWS[name]) bytes = modified(name, false, m.alt, m.ctrl);
  else {
    const plain: Record<string, number[]> = { Esc: [0x1b], Tab: [0x09], Backspace: [0x7f], Enter: [0x0d] };
    bytes = plain[name] ?? ascii(name);
    if (m.alt) bytes = [0x1b, ...bytes];
  }
  return m.tab ? [0x09, ...bytes] : bytes;
}

/** A character typed while row two has a key lit is a key; otherwise it is text (null). */
export function typed(c: string, m: Mods): number[] | null {
  if (!m.ctrl && !m.alt && !m.tab) return null;
  let bytes = [...new TextEncoder().encode(c)];
  if (m.ctrl && c.length === 1) {
    const code = c.toUpperCase().charCodeAt(0);
    if (code >= 0x40 && code <= 0x5f) bytes = [code - 0x40];
    else if (c === ' ') bytes = [0];
    else if (c === '?') bytes = [0x7f];
  }
  if (m.alt) bytes = [0x1b, ...bytes];
  return m.tab ? [0x09, ...bytes] : bytes;
}

/** A tap on a row-two key: it lights, or goes off again. A lit Tab tapped
 * again is sent on its own, so the bar can send a plain Tab. */
export function tap(m: Mods, which: keyof Mods): { mods: Mods; bytes: number[] | null } {
  if (which === 'tab' && m.tab) return { mods: NONE, bytes: [0x09] };
  return { mods: { ...m, [which]: !m[which] }, bytes: null };
}

/** After a key is sent, nothing stays lit. */
export function sent(_m: Mods): Mods {
  return NONE;
}

/** A key held down: sent at once, then, after 350 ms, every 50 ms until let go. */
export function held(send: () => void): () => void {
  send();
  let every: ReturnType<typeof setInterval> | undefined;
  const wait = setTimeout(() => {
    send();
    every = setInterval(send, 50);
  }, 350);
  return () => {
    clearTimeout(wait);
    if (every !== undefined) clearInterval(every);
  };
}
