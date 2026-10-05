// One agent's screen, drawn by xterm.js from the machine's frames
// (web-app.md §6): a whole frame resets it first, every frame is written as
// it is. Input from xterm.js itself is off; links are not opened.
import { Terminal } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';
import { useEffect, useRef } from 'preact/hooks';
import { encode } from '../keys';
import * as m from '../machine';
import { paneActive } from './Bar';

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

export function Screen({ agent, driving, history, onHistory, onLive, onKey, box }: { agent: string; driving: boolean; history: string | null; onHistory: () => void; onLive: () => void; onKey: (bytes: number[]) => void; box: { current: HTMLDivElement | null } }) {
  const host = useRef<HTMLDivElement>(null);
  const shown = useRef<HTMLPreElement>(null);
  const tapped = useRef(-Infinity);
  // The history, inside the pane, starts at its newest line.
  useEffect(() => {
    if (history !== null && shown.current) shown.current.scrollTop = shown.current.scrollHeight;
  }, [history]);
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
    // Only an active pane scrolls: until then, the app is for its buttons.
    const wheel = (e: WheelEvent) => {
      if (paneActive.value && e.deltaY < 0) onHistory();
    };
    // In the capture phase: xterm's own viewport handles the wheel and stops it.
    el.addEventListener('wheel', wheel, { passive: true, capture: true });
    // On a touch screen: a finger pulling the screen down, as a wheel scrolled up.
    let from: number | null = null;
    const start = (e: TouchEvent) => (from = e.touches[0]?.clientY ?? null);
    const move = (e: TouchEvent) => {
      const y = e.touches[0]?.clientY;
      if (paneActive.value && from !== null && y !== undefined && y - from > 40) {
        from = null;
        onHistory();
      }
    };
    el.addEventListener('touchstart', start, { passive: true });
    el.addEventListener('touchmove', move, { passive: true });
    return () => {
      el.removeEventListener('wheel', wheel, { capture: true });
      el.removeEventListener('touchstart', start);
      el.removeEventListener('touchmove', move);
      m.watch(null, null);
      term.dispose();
    };
  }, [agent, driving]);
  /** In the history: scrolled to its newest line and still going down, back to live. */
  const atBottom = (el: HTMLElement) => el.scrollTop + el.clientHeight >= el.scrollHeight - 2;
  let historyFrom: number | null = null;
  /** A double tap on a touch screen, a click with a mouse: the pane is active. */
  const activate = (e: PointerEvent) => {
    if (e.pointerType === 'touch') {
      const twice = e.timeStamp - tapped.current < 400;
      tapped.current = twice ? -Infinity : e.timeStamp;
      if (!twice) return;
    }
    paneActive.value = true;
    (e.currentTarget as HTMLElement).focus();
  };
  return (
    <div
      ref={box}
      tabIndex={-1}
      aria-label="The agent"
      class="pane"
      data-active={paneActive.value ? 'true' : 'false'}
      onPointerUp={activate}
      // Anywhere else, and the pane is inactive again, at its newest line.
      onFocusOut={(e) => {
        if ((e.currentTarget as HTMLElement).contains(e.relatedTarget as Node | null)) return;
        paneActive.value = false;
        onLive();
      }}
      onKeyDownCapture={(e) => {
        if (!paneActive.value) return;
        const bytes = encode(e);
        if (!bytes) return;
        e.preventDefault();
        onKey(bytes);
      }}>
      <div ref={host} style={{ width: '100%', height: '100%' }} aria-label="The agent's screen" />
      {history !== null && (
        // The agent's earlier output, in the pane itself (§6).
        <div class="pane-history">
          <pre
            ref={shown}
            aria-label="History"
            onWheel={(e) => {
              if (e.deltaY > 0 && atBottom(e.currentTarget)) onLive();
            }}
            onTouchStart={(e) => (historyFrom = e.touches[0]?.clientY ?? null)}
            onTouchMove={(e) => {
              const y = e.touches[0]?.clientY;
              if (historyFrom !== null && y !== undefined && historyFrom - y > 60 && atBottom(e.currentTarget)) {
                historyFrom = null;
                onLive();
              }
            }}
          >
            {history}
          </pre>
        </div>
      )}
    </div>
  );
}
