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
