// A text file with its line numbers, highlighted when its grammar is known.
// Only the lines in sight are drawn. On a phone a long line wraps, on the
// desktop it scrolls sideways, its number staying at the left.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Layout, RendererProps } from '../factory';
import { langOf, tokenizer, type State, type TokenLine, type Tokenizer } from '../highlight';
import { decode, linesOf } from '../text';
import { rowsOf, spanOf, widthsOf } from './window';

/** Each line's height, as the stylesheet sets it for each layout. */
const LINE: Record<Layout, number> = { phone: 19, desktop: 21 };

/** Lines tokenized together, each block going on from where the one before ended. */
const BLOCK = 400;

/** Blocks of tokens kept around the view; the rest are made again when scrolled back to. */
const KEPT = 24;

/** The highlighted lines of `first`..`last`, made as they come into sight; a line not made yet is drawn plain. */
function useTokens(lines: string[], lang: string | null, first: number, last: number): (n: number) => TokenLine | undefined {
  const [tk, setTk] = useState<Tokenizer | null>(null);
  const [, setMade] = useState(0);
  const memo = useRef({ states: [undefined] as State[], blocks: new Map<number, TokenLine[]>() });
  useEffect(() => {
    let gone = false;
    memo.current = { states: [undefined], blocks: new Map() };
    setTk(null);
    // A grammar that fails to load leaves the text plain.
    void tokenizer(lang).then((t) => !gone && setTk(t), () => {});
    return () => void (gone = true);
  }, [lines, lang]);
  useEffect(() => {
    if (!tk || lines.length === 0) return;
    const { states, blocks } = memo.current;
    const from = Math.floor(first / BLOCK);
    const to = Math.floor(Math.max(first, last - 1) / BLOCK);
    let timer = 0;
    const step = () => {
      const start = performance.now();
      let changed = false;
      for (let b = from; b <= to && performance.now() - start < 12; b++) {
        if (blocks.has(b)) continue;
        // Go on from the last state known up to this block, keeping only the states on the way.
        while (states.length <= b && performance.now() - start < 12) {
          const k = states.length - 1;
          const r = tk.tokenize(lines.slice(k * BLOCK, (k + 1) * BLOCK).join('\n'), states[k]);
          states.push(r.state);
          if (k >= from && k <= to) blocks.set(k, r.lines);
        }
        if (states.length <= b) break;
        if (!blocks.has(b)) blocks.set(b, tk.tokenize(lines.slice(b * BLOCK, (b + 1) * BLOCK).join('\n'), states[b]).lines);
        changed = true;
      }
      for (const b of blocks.keys()) if (b < from - KEPT / 2 || b > to + KEPT / 2) blocks.delete(b);
      if (changed) setMade((n) => n + 1);
      let done = true;
      for (let b = from; b <= to; b++) done &&= blocks.has(b);
      if (!done) timer = window.setTimeout(step, 0);
    };
    timer = window.setTimeout(step, 0);
    return () => clearTimeout(timer);
  }, [tk, lines, first, last]);
  return (n) => memo.current.blocks.get(Math.floor(n / BLOCK))?.[n % BLOCK];
}

function Line({ text, tokens }: { text: string; tokens: TokenLine | undefined }) {
  if (!tokens) return <>{text}</>;
  return (
    <>
      {tokens.map((t, i) =>
        t.color || t.bold || t.italic ? (
          <span key={i} style={{ color: t.color, fontWeight: t.bold ? 600 : undefined, fontStyle: t.italic ? 'italic' : undefined }}>{t.text}</span>
        ) : (
          t.text
        ),
      )}
    </>
  );
}

/** Lines of text, numbered; `lang` names the grammar they are highlighted with. */
export function TextLines({ text, lang, layout }: { text: string; lang: string | null; layout: Layout }) {
  const wrap = layout === 'phone';
  const height = LINE[layout];
  const lines = useMemo(() => linesOf(text), [text]);
  const widths = useMemo(() => widthsOf(lines), [lines]);
  const longest = useMemo(() => widths.reduce((n, w) => Math.max(n, w), 0), [widths]);
  const box = useRef<HTMLDivElement>(null);
  const probe = useRef<HTMLSpanElement>(null);
  const [view, setView] = useState({ top: 0, height: 800, columns: 0 });
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const look = () => {
      const p = probe.current;
      // How many characters a wrapped line holds: its text's width over one character's.
      const columns = p && p.parentElement ? Math.max(8, Math.floor(p.parentElement.clientWidth / (p.getBoundingClientRect().width / 10 || 7))) : 0;
      setView({ top: el.scrollTop, height: el.clientHeight, columns });
    };
    look();
    el.addEventListener('scroll', look, { passive: true });
    const seen = new ResizeObserver(look);
    seen.observe(el);
    return () => {
      el.removeEventListener('scroll', look);
      seen.disconnect();
    };
  }, []);
  const rows = useMemo(() => (wrap && view.columns > 0 ? rowsOf(widths, view.columns) : null), [wrap, widths, view.columns]);
  const { first, last, before, total } = spanOf(rows, lines.length, Math.max(0, view.top - 10), view.height, height);
  const tokens = useTokens(lines, lang, first, last);
  const digits = String(lines.length).length;
  const shown: preact.JSX.Element[] = [];
  for (let n = first; n < last; n++) {
    shown.push(
      <div key={n} class="viewer-line">
        <span class="viewer-line-n">{n + 1}</span>
        <span class="viewer-line-text"><Line text={lines[n]} tokens={tokens(n)} /></span>
      </div>,
    );
  }
  return (
    <div class={`viewer-text viewer-text--${layout}`} ref={box} style={{ '--digits': `${digits}ch`, '--line': `${height}px` }}>
      <div class="viewer-text-lines" style={{ height: `${total * height + 20}px`, minWidth: wrap ? undefined : `calc(${digits + longest}ch + 96px)` }}>
        <div class="viewer-line viewer-line--probe" aria-hidden="true">
          <span class="viewer-line-n" />
          <span class="viewer-line-text"><span ref={probe}>0000000000</span></span>
        </div>
        <div style={{ transform: `translateY(${before * height}px)` }}>{shown}</div>
      </div>
    </div>
  );
}

export default function TextFile({ file, bytes, layout, ready }: RendererProps) {
  // A text larger than this device can hold throws here, and the viewer says it can't be shown.
  const text = useMemo(() => decode(bytes ?? new Uint8Array(0)), [bytes]);
  useEffect(ready, []);
  return <TextLines text={text} lang={langOf(file.path)} layout={layout} />;
}
