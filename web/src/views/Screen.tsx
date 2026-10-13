// One agent's screen, drawn by xterm.js from the machine's frames
// (web-app.md §6): a whole frame resets it first, every frame is written as
// it is. Input from xterm.js itself is off; links are not opened.
import { Terminal } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';
import { useEffect, useRef, useState } from 'preact/hooks';
import { encode } from '../keys';
import * as m from '../machine';
import { paneActive } from './Bar';

/** The text size an agent is drawn at when it fits (§6). */
export const DRIVING_FONT = 13;
/** The smallest it is made to fit a wider agent; past that it scrolls sideways (M3.14). */
export const MIN_FONT = 9;
/** The cell xterm.js draws at the normal text size, in px: measured once a
 * terminal is open, since each browser rounds its font differently. */
let cell = { width: DRIVING_FONT * 0.6, height: DRIVING_FONT * 1.2 };
/** The terminal's family until the Atlas's mono has loaded. */
const MONO_FALLBACK = "ui-monospace, 'SF Mono', SFMono-Regular, Menlo, Consolas, monospace";

function bytes(b64: string): Uint8Array {
  const s = atob(b64);
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

/** Rows and columns this device fits at the normal text size. */
export function fit(el: HTMLElement): { rows: number; cols: number } {
  const r = el.getBoundingClientRect();
  return {
    cols: Math.max(20, Math.floor(r.width / cell.width)),
    rows: Math.max(8, Math.floor(r.height / cell.height)),
  };
}

export function Screen({ agent, current = true, bars = false, history, onHistory, onTop, onLive, onKey, box }: { agent: string; /** The side with the keys, of two side by side. */ current?: boolean; /** A phone's scroll bars (M3.3, M3.14). */ bars?: boolean; history: string | null; onHistory: () => void; onTop: () => void; onLive: () => void; onKey: (bytes: number[]) => void; box: { current: HTMLDivElement | null } }) {
  const host = useRef<HTMLDivElement>(null);
  const shown = useRef<HTMLPreElement>(null);
  // Where the screen and the history are scrolled to, for the bars.
  const [, redraw] = useState(0);
  const moved = () => redraw((n) => n + 1);
  const tapped = useRef(-Infinity);
  // Only the side with the keys takes them, scrolls, or is framed active.
  const isCurrent = useRef(current);
  isCurrent.current = current;
  const active = () => paneActive.value && isCurrent.current;
  // The history, inside the pane, starts at its newest line; one that fits
  // whole is already at the top of what Weft holds.
  useEffect(() => {
    const el = shown.current;
    if (history === null || !el) return;
    el.scrollTop = el.scrollHeight;
    if (el.scrollHeight <= el.clientHeight + 2) onTop();
  }, [history]);
  useEffect(() => {
    const el = host.current!;
    // The Atlas's mono from the start once it has loaded, so the first size
    // sent is measured in the cell the screen is drawn at.
    const mono = () => getComputedStyle(document.documentElement).getPropertyValue('--font-mono');
    const loaded = document.fonts?.check?.(`${DRIVING_FONT}px "JetBrains Mono"`) ?? false;
    let gone = false;
    const term = new Terminal({
      disableStdin: true,
      scrollback: 0,
      cursorBlink: false,
      fontFamily: loaded ? mono() : MONO_FALLBACK,
      fontSize: DRIVING_FONT,
      // The cards' rows: 18 px for a 12 px mono, a row a little taller than the font's own.
      lineHeight: 1.125,
      // The pane's own colour, as the cards draw the screen inside it.
      theme: { background: '#05080f', foreground: '#f1f3f7', cursor: '#f1f3f7', selectionBackground: '#2e4c76' },
      linkHandler: null,
    });
    term.open(el);
    const measure = () => {
      const opened = el.querySelector('.xterm-screen')?.getBoundingClientRect();
      if (opened?.width && opened.height && term.options.fontSize === DRIVING_FONT) cell = { width: opened.width / term.cols, height: opened.height / term.rows };
    };
    measure();
    // The Atlas's mono, once it has loaded: xterm.js measures its cell again
    // when the family changes, so it is set only then.
    // when the family changes, so it is set only then; the size `watch` gave
    // is given again in the new cell.
    if (!loaded)
      void document.fonts?.load(`${DRIVING_FONT}px "JetBrains Mono"`).then(() => {
        if (gone) return;
        term.options.fontFamily = mono();
        requestAnimationFrame(() => {
          if (gone) return;
          const before = fit(el);
          measure();
          const now = fit(el);
          if (now.rows !== before.rows || now.cols !== before.cols) m.watch(agent, frame, now);
        });
      });
    // A double tap or click makes the pane active (M3.3); it never selects text.
    el.addEventListener('mousedown', (e) => e.detail > 1 && (e.preventDefault(), e.stopPropagation()), { capture: true });
    let cols = 80;
    // Until nothing is cut off: shrink the font by what overflows, once
    // xterm.js has drawn at it (two frames), and look again.
    let settling = 0;
    const settle = () => {
      cancelAnimationFrame(settling);
      settling = requestAnimationFrame(() => (settling = requestAnimationFrame(() => {
        const { width, height } = el.getBoundingClientRect();
        const drawn = el.querySelector('.xterm-screen')?.getBoundingClientRect();
        const now = term.options.fontSize ?? DRIVING_FONT;
        if (!drawn?.width || !drawn.height || now <= MIN_FONT) return moved();
        const over = Math.min(width / drawn.width, height / drawn.height);
        if (over < 0.999) {
          term.options.fontSize = Math.max(MIN_FONT, Math.floor(now * over * 10) / 10);
          settle();
        } else moved();
      })));
    };
    // Weft owns the agent's size (ADR-0038): it is drawn at it, never
    // resized. A narrower one at the normal text size, the rest empty; a wider
    // one smaller to fit, down to MIN_FONT, and past that it scrolls sideways.
    const size = (rows: number, c: number) => {
      cols = c;
      if (term.rows !== rows || term.cols !== c) term.resize(c, rows);
      const { width, height } = el.getBoundingClientRect();
      const fits = DRIVING_FONT * Math.min(width / (cols * cell.width), height / (rows * cell.height));
      term.options.fontSize = Math.max(MIN_FONT, Math.min(DRIVING_FONT, Math.floor(fits * 10) / 10));
      settle();
    };
    // Whether the agent asked for SGR mouse reports (1006): xterm.js keeps
    // the tracking mode, not the encoding.
    let sgr = false;
    const has1006 = (params: (number | number[])[]) => params.some((p) => p === 1006);
    term.parser.registerCsiHandler({ prefix: '?', final: 'h' }, (p) => ((sgr ||= has1006(p)), false));
    term.parser.registerCsiHandler({ prefix: '?', final: 'l' }, (p) => ((sgr &&= !has1006(p)), false));
    const frame = (f: m.Frame) => {
      if (f.full) {
        term.reset();
        sgr = false;
        size(f.rows, f.cols);
      }
      term.write(bytes(f.bytes));
    };
    m.watch(agent, frame, fit(el));
    /** An agent that asked for mouse reports (as Codex does in its full
     * screen) scrolls itself: the wheel goes to it as a terminal sends it,
     * button 64 up, 65 down, at the cell under the pointer. */
    const wheelTo = (up: boolean, x: number, y: number): boolean => {
      if (term.modes.mouseTrackingMode === 'none') return false;
      const r = el.querySelector('.xterm-screen')?.getBoundingClientRect();
      const at = (v: number, from: number, size: number, n: number) => Math.min(n, Math.max(1, Math.floor(((v - from) / size) * n) + 1));
      const [col, row] = r?.width ? [at(x, r.left, r.width, term.cols), at(y, r.top, r.height, term.rows)] : [1, 1];
      const button = up ? 64 : 65;
      const report = sgr ? `\x1b[<${button};${col};${row}M` : `\x1b[M${String.fromCharCode(32 + button, 32 + Math.min(col, 223), 32 + Math.min(row, 223))}`;
      onKey(Array.from(report, (c) => c.charCodeAt(0)));
      return true;
    };
    // Only an active pane scrolls: until then, the app is for its buttons.
    let wheeled = 0;
    const wheel = (e: WheelEvent) => {
      if (!active()) return;
      if (term.modes.mouseTrackingMode !== 'none') {
        // A report for each notch's worth, so a trackpad does not flood it.
        wheeled += e.deltaY;
        while (Math.abs(wheeled) >= 40) {
          wheelTo(wheeled < 0, e.clientX, e.clientY);
          wheeled -= Math.sign(wheeled) * 40;
        }
        return;
      }
      if (e.deltaY < 0) onHistory();
    };
    // In the capture phase: xterm's own viewport handles the wheel and stops it.
    el.addEventListener('wheel', wheel, { passive: true, capture: true });
    // On a touch screen: a finger pulling the screen down, as a wheel scrolled up.
    let from: number | null = null;
    const start = (e: TouchEvent) => (from = e.touches[0]?.clientY ?? null);
    const move = (e: TouchEvent) => {
      const t = e.touches[0];
      const y = t?.clientY;
      // An agent that scrolls itself: a report for every 30 px the finger moves.
      if (active() && from !== null && y !== undefined && term.modes.mouseTrackingMode !== 'none') {
        while (Math.abs(y - from) >= 30) {
          wheelTo(y > from, t.clientX, y);
          from += Math.sign(y - from) * 30;
        }
        return;
      }
      if (active() && from !== null && y !== undefined && y - from > 40) {
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
      gone = true;
      m.unwatch(agent);
      cancelAnimationFrame(settling);
      term.dispose();
    };
  }, [agent]);
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
      data-active={active() ? 'true' : 'false'}
      onPointerUp={activate}
      // Anywhere else, and the pane is inactive again, at its newest line.
      onFocusOut={(e) => {
        if ((e.currentTarget as HTMLElement).contains(e.relatedTarget as Node | null)) return;
        paneActive.value = false;
        onLive();
      }}
      onKeyDownCapture={(e) => {
        if (!active()) return;
        const bytes = encode(e);
        if (!bytes) return;
        e.preventDefault();
        onKey(bytes);
      }}>
      <div ref={host} class="pane-screen" onScroll={moved} aria-label="The agent's screen" />
      {bars && <Bars screen={host} history={shown} live={history === null} onHistory={onHistory} onLive={onLive} />}
      {history !== null && (
        // The agent's earlier output, in the pane itself (§6).
        <div class="pane-history">
          <pre
            ref={shown}
            aria-label="History"
            onScroll={moved}
            onWheel={(e) => {
              if (e.deltaY > 0 && atBottom(e.currentTarget)) onLive();
              // Still going up at its oldest line: nothing older is here.
              if (e.deltaY < 0 && e.currentTarget.scrollTop <= 0) onTop();
            }}
            onTouchStart={(e) => (historyFrom = e.touches[0]?.clientY ?? null)}
            onTouchMove={(e) => {
              const y = e.touches[0]?.clientY;
              if (historyFrom !== null && y !== undefined && historyFrom - y > 60 && atBottom(e.currentTarget)) {
                historyFrom = null;
                onLive();
              }
              if (historyFrom !== null && y !== undefined && y - historyFrom > 40 && e.currentTarget.scrollTop <= 0) {
                historyFrom = null;
                onTop();
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

/**
 * A phone's scroll bars (M3.3, M3.14): up and down at the right, always,
 * for the history above the screen, its thumb at the bottom while the screen
 * is live; sideways at the bottom when the agent is wider than the pane. A
 * finger drags either; dragging the first up opens the history.
 */
function Bars({ screen, history, live, onHistory, onLive }: { screen: { current: HTMLDivElement | null }; history: { current: HTMLPreElement | null }; live: boolean; onHistory: () => void; onLive: () => void }) {
  const s = screen.current;
  const h = history.current;
  // Up and down: the history's place, or the bottom while live.
  const [vTop, vSize] = !live && h && h.scrollHeight > 0 ? [h.scrollTop / h.scrollHeight, Math.min(1, h.clientHeight / h.scrollHeight)] : [0.78, 0.22];
  const wide = s ? s.scrollWidth > s.clientWidth + 1 : false;
  const [hLeft, hSize] = s && wide ? [s.scrollLeft / s.scrollWidth, s.clientWidth / s.scrollWidth] : [0, 1];
  const wanted = useRef<number | null>(null);
  // Once the history has come, the place the finger asked for.
  useEffect(() => {
    if (!live && h && wanted.current !== null) {
      h.scrollTop = wanted.current * (h.scrollHeight - h.clientHeight);
      wanted.current = null;
    }
  });
  const drag = (along: (f: number) => void, vertical: boolean) => (e: PointerEvent) => {
    const track = e.currentTarget as HTMLElement;
    track.setPointerCapture(e.pointerId);
    const at = (ev: PointerEvent) => {
      const r = track.getBoundingClientRect();
      along(Math.min(1, Math.max(0, vertical ? (ev.clientY - r.top) / r.height : (ev.clientX - r.left) / r.width)));
    };
    at(e);
    const move = (ev: PointerEvent) => at(ev);
    const up = () => (track.removeEventListener('pointermove', move), track.removeEventListener('pointerup', up));
    track.addEventListener('pointermove', move);
    track.addEventListener('pointerup', up);
    e.stopPropagation();
  };
  const upDown = (f: number) => {
    if (live) {
      if (f < 0.9) (wanted.current = f), onHistory();
      return;
    }
    if (f >= 0.98) return onLive();
    if (h) h.scrollTop = f * (h.scrollHeight - h.clientHeight);
  };
  const sideways = (f: number) => s && (s.scrollLeft = f * (s.scrollWidth - s.clientWidth));
  return (
    <>
      <div class="pane-bar pane-bar--v" aria-hidden="true" onPointerDown={drag(upDown, true)}>
        <span style={{ top: `${vTop * 100}%`, height: `${vSize * 100}%` }} />
      </div>
      {wide && (
        <div class="pane-bar pane-bar--h" aria-hidden="true" onPointerDown={drag(sideways, false)}>
          <span style={{ left: `${hLeft * 100}%`, width: `${hSize * 100}%` }} />
        </div>
      )}
    </>
  );
}
