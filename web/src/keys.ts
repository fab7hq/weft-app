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

/** The bytes a key sends, or nothing for a key that is the browser's. */
export function encode(e: KeyboardEvent): number[] | null {
  if (e.metaKey || e.isComposing) return null;
  if (NAMED[e.key]) return NAMED[e.key];
  if (e.ctrlKey && !e.altKey && /^[a-z]$/i.test(e.key)) return [e.key.toUpperCase().charCodeAt(0) - 64];
  if (e.key.length >= 1 && [...e.key].length === 1 && !e.ctrlKey) return [...new TextEncoder().encode(e.key)];
  return null;
}

// --- The key bar (web-app.md §6): generic keys and sticky modifiers. Weft
// names no harness's shortcuts; a person composes them from these.

export type Lit = 'off' | 'once' | 'locked';
export interface Mods {
  ctrl: Lit;
  alt: Lit;
  shift: Lit;
}
export const NONE: Mods = { ctrl: 'off', alt: 'off', shift: 'off' };

/** The key bar, in order: what each shows and its name. */
export const BAR: { label: string; name: string }[] = [
  { label: 'Esc', name: 'Esc' },
  { label: 'Tab', name: 'Tab' },
  { label: '←', name: 'Left' },
  { label: '↑', name: 'Up' },
  { label: '↓', name: 'Down' },
  { label: '→', name: 'Right' },
  { label: '⏎', name: 'Enter' },
  { label: '^C', name: 'Control-C' },
  { label: 'PgUp', name: 'PgUp' },
  { label: 'PgDn', name: 'PgDn' },
  { label: '1', name: '1' },
  { label: '2', name: '2' },
  { label: '3', name: '3' },
];

const on = (l: Lit) => l !== 'off';
/** xterm's modifier parameter: 1 + Shift 1 + Alt 2 + Ctrl 4. */
const param = (m: Mods) => 1 + (on(m.shift) ? 1 : 0) + (on(m.alt) ? 2 : 0) + (on(m.ctrl) ? 4 : 0);
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));
const CSI = [0x1b, 0x5b];
const ARROWS: Record<string, string> = { Up: 'A', Down: 'B', Right: 'C', Left: 'D' };
const PAGES: Record<string, string> = { PgUp: '5', PgDn: '6' };

/** The bytes a key bar key sends with the modifiers lit. */
export function chord(name: string, m: Mods): number[] {
  const p = param(m);
  if (ARROWS[name]) return p === 1 ? [...CSI, ...ascii(ARROWS[name])] : [...CSI, ...ascii(`1;${p}${ARROWS[name]}`)];
  if (PAGES[name]) return [...CSI, ...ascii(p === 1 ? `${PAGES[name]}~` : `${PAGES[name]};${p}~`)];
  if (name === 'Tab' && on(m.shift)) return [...CSI, 0x5a];
  const plain: Record<string, number[]> = { Esc: [0x1b], Tab: [0x09], Enter: [0x0d], 'Control-C': [0x03] };
  const bytes = plain[name] ?? ascii(name);
  return on(m.alt) ? [0x1b, ...bytes] : bytes;
}

/** A character typed while Ctrl or Alt is lit is a key; otherwise it is text (null). */
export function typed(c: string, m: Mods): number[] | null {
  if (!on(m.ctrl) && !on(m.alt)) return null;
  let bytes = [...new TextEncoder().encode(c)];
  if (on(m.ctrl) && c.length === 1) {
    const code = c.toUpperCase().charCodeAt(0);
    if (code >= 0x40 && code <= 0x5f) bytes = [code - 0x40];
    else if (c === ' ') bytes = [0];
    else if (c === '?') bytes = [0x7f];
  }
  return on(m.alt) ? [0x1b, ...bytes] : bytes;
}

/** A tap on a modifier: off → once → locked → off. */
export function tap(m: Mods, which: keyof Mods): Mods {
  const next: Record<Lit, Lit> = { off: 'once', once: 'locked', locked: 'off' };
  return { ...m, [which]: next[m[which]] };
}

/** After a key is sent: what was lit once goes off; what is locked stays. */
export function sent(m: Mods): Mods {
  const keep = (l: Lit): Lit => (l === 'locked' ? 'locked' : 'off');
  return { ctrl: keep(m.ctrl), alt: keep(m.alt), shift: keep(m.shift) };
}

/** The answer strip while an agent waits: the keys most questions take (§6). */
export const ANSWER = ['1', '2', '3', 'Esc', 'Enter'].map((name) => BAR.find((k) => k.name === name)!);
