// A notebook: its cells one under another, markdown drawn as a file's is,
// code highlighted with its run's number, then what it printed and drew. An
// HTML output runs in a frame of its own, as an HTML file does.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Markdown } from '../../views/Markdown';
import type { RendererProps } from '../factory';
import { langNamed, tokenizer, type TokenLine, type Tokenizer } from '../highlight';
import { parseNotebook, type Cell, type Output } from '../notebook';
import { decode } from '../text';
import { RICH } from './rich';

/** A page in a sandboxed frame as tall as it is: the frame's own script says its height. */
function Page({ html }: { html: string }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(40);
  useEffect(() => {
    const heard = (e: MessageEvent) => {
      if (e.source === frame.current?.contentWindow && typeof e.data?.height === 'number') setHeight(Math.min(4000, Math.ceil(e.data.height)));
    };
    addEventListener('message', heard);
    return () => removeEventListener('message', heard);
  }, []);
  const doc = `<!doctype html><meta charset="utf-8"><base target="_blank"><style>body{margin:0;padding:8px;font:13px/1.4 system-ui,sans-serif;color:#1d2433;background:#fff}table{border-collapse:collapse}td,th{border:1px solid #d3dae6;padding:3px 8px;text-align:right}</style>${html}<script>new ResizeObserver(function(){parent.postMessage({height:document.documentElement.scrollHeight},'*')}).observe(document.documentElement)</script>`;
  return <iframe ref={frame} class="viewer-nb-frame" sandbox="allow-scripts" srcdoc={doc} style={{ height: `${height}px` }} title="output" />;
}

function Out({ o }: { o: Output }) {
  if (o.kind === 'image') return <img class="viewer-nb-image" src={o.src} alt="" />;
  if (o.kind === 'html') return <Page html={o.html} />;
  return <div class={o.error ? 'viewer-nb-out viewer-nb-out--error' : 'viewer-nb-out'}>{o.text.replace(/\n$/, '')}</div>;
}

function Code({ source, tk }: { source: string; tk: Tokenizer | null }) {
  const lines = useMemo<TokenLine[] | null>(() => (tk ? tk.tokenize(source).lines : null), [source, tk]);
  if (!lines) return <div class="viewer-nb-code">{source}</div>;
  return (
    <div class="viewer-nb-code">
      {lines.map((l, i) => (
        <div key={i}>
          {l.length === 0 ? '​' : l.map((t, j) => (t.color || t.bold ? <span key={j} style={{ color: t.color, fontWeight: t.bold ? 600 : undefined }}>{t.text}</span> : t.text))}
        </div>
      ))}
    </div>
  );
}

function CellView({ cell, tk }: { cell: Cell; tk: Tokenizer | null }) {
  if (cell.kind === 'markdown') {
    return (
      <div class="viewer-nb-cell">
        <span class="viewer-nb-n" />
        <div class="viewer-nb-body convo-md viewer-nb-md"><Markdown text={cell.text} rich={RICH} /></div>
      </div>
    );
  }
  if (cell.kind === 'raw') {
    return (
      <div class="viewer-nb-cell">
        <span class="viewer-nb-n" />
        <div class="viewer-nb-body"><div class="viewer-nb-out">{cell.text}</div></div>
      </div>
    );
  }
  return (
    <div class="viewer-nb-cell">
      <span class="viewer-nb-n">{`[${cell.count ?? ' '}]`}</span>
      <div class="viewer-nb-body">
        <Code source={cell.source} tk={tk} />
        {cell.outputs.map((o, i) => <Out key={i} o={o} />)}
      </div>
    </div>
  );
}

export default function NotebookFile({ bytes, layout, ready }: RendererProps) {
  // Not a notebook: thrown, and the viewer says it can't be shown.
  const nb = useMemo(() => parseNotebook(decode(bytes ?? new Uint8Array(0))), [bytes]);
  const [tk, setTk] = useState<Tokenizer | null>(null);
  useEffect(() => {
    let gone = false;
    void tokenizer(langNamed(nb.lang)).then((t) => !gone && setTk(t), () => {});
    ready();
    return () => void (gone = true);
  }, [nb]);
  return (
    <div class="viewer-scroll">
      <div class={`viewer-nb viewer-nb--${layout}`}>{nb.cells.map((c, i) => <CellView key={i} cell={c} tk={tk} />)}</div>
    </div>
  );
}
