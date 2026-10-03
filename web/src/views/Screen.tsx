// One agent's screen, drawn by xterm.js from the machine's frames
// (web-app.md §6): a whole frame resets it first, every frame is written as
// it is. Input from xterm.js itself is off; links are not opened.
import { Terminal } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';
import { useEffect, useRef } from 'preact/hooks';
import { encode } from '../keys';
import * as m from '../machine';
import { paneHasKeys } from './Bar';

const CELL_WIDTH = 0.6;
const LINE_HEIGHT = 1.2;
/** The size a device drives at (§6). */
export const DRIVING_FONT = 13;

function bytes(b64: string): Uint8Array {
  const s = atob(b64);
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

/** Rows and columns this device fits at the driving size. */
export function fit(el: HTMLElement): { rows: number; cols: number } {
  const r = el.getBoundingClientRect();
  return {
    cols: Math.max(20, Math.floor(r.width / (DRIVING_FONT * CELL_WIDTH))),
    rows: Math.max(8, Math.floor(r.height / (DRIVING_FONT * LINE_HEIGHT))),
  };
}

export function Screen({ agent, driving, onHistory, onKey, box }: { agent: string; driving: boolean; onHistory: () => void; onKey: (bytes: number[]) => void; box: { current: HTMLDivElement | null } }) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = host.current!;
    const term = new Terminal({
      disableStdin: true,
      scrollback: 0,
      cursorBlink: false,
      fontFamily: getComputedStyle(document.documentElement).getPropertyValue('--font-mono'),
      fontSize: DRIVING_FONT,
      lineHeight: 1,
      theme: { background: '#090d16', foreground: '#f1f3f7', cursor: '#f1f3f7', selectionBackground: '#2e4c76' },
      linkHandler: null,
    });
    term.open(el);
    let cols = 80;
    const size = (rows: number, c: number) => {
      cols = c;
      if (term.rows !== rows || term.cols !== c) term.resize(c, rows);
      // Watching: the machine's columns fit the width; driving: the driving size.
      const width = el.getBoundingClientRect().width;
      term.options.fontSize = driving ? DRIVING_FONT : Math.max(5, Math.min(DRIVING_FONT, Math.floor(width / (cols * CELL_WIDTH) * 10) / 10));
    };
    m.watch(agent, (f) => {
      if (f.full) {
        term.reset();
        size(f.rows, f.cols);
      }
      term.write(bytes(f.bytes));
    });
    const wheel = (e: WheelEvent) => {
      if (e.deltaY < 0) onHistory();
    };
    el.addEventListener('wheel', wheel, { passive: true });
    return () => {
      el.removeEventListener('wheel', wheel);
      m.watch(null, null);
      term.dispose();
    };
  }, [agent, driving]);
  return (
    <div
      ref={box}
      tabIndex={0}
      // xterm's own text area takes the focus inside it; focusin and focusout bubble.
      onFocusIn={() => (paneHasKeys.value = true)}
      onFocusOut={(e) => {
        if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node | null)) paneHasKeys.value = false;
      }}
      onKeyDownCapture={(e) => {
        // The TUI's own escape: Ctrl+] gives the keys back to Weft.
        if (e.ctrlKey && (e.key === ']' || e.code === 'BracketRight')) {
          e.preventDefault();
          (document.activeElement as HTMLElement | null)?.blur();
          return;
        }
        const bytes = encode(e);
        if (!bytes) return;
        e.preventDefault();
        onKey(bytes);
      }}
      style={{ flex: 1, minHeight: 0, margin: '0 8px', border: `1px solid ${driving ? 'var(--fab7-teal)' : 'var(--fab7-line)'}`, borderRadius: 'var(--fab7-radius-lg)', padding: '8px', overflow: 'hidden' }}>
      <div ref={host} style={{ width: '100%', height: '100%' }} aria-label="The agent's screen" />
    </div>
  );
}
