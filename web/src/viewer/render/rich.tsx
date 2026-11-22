// What a file's markdown draws beyond a message: mermaid diagrams and TeX
// math, each library loaded the first time a file holds one.
import { useEffect, useState } from 'preact/hooks';
import type { Rich } from '../../views/Markdown';
import { lexMath } from '../mathmd';

type Katex = typeof import('katex').default;
type Mermaid = typeof import('mermaid').default;

let katex: Promise<Katex> | null = null;
let mermaid: Promise<Mermaid> | null = null;

const loadKatex = () => (katex ??= Promise.all([import('katex'), import('katex/dist/katex.min.css')]).then(([k]) => k.default));

const loadMermaid = () =>
  (mermaid ??= import('mermaid').then(({ default: m }) => {
    m.initialize({ startOnLoad: false, theme: 'dark', securityLevel: 'strict', suppressErrorRendering: true, fontFamily: 'Sora, sans-serif' });
    return m;
  }));

/** TeX as math; its source until KaTeX has loaded. KaTeX says a mistake in red where it is. */
export function TeX({ tex, display }: { tex: string; display: boolean }) {
  const [html, setHtml] = useState<string | null>(null);
  useEffect(() => {
    let gone = false;
    void loadKatex().then(
      (k) => !gone && setHtml(k.renderToString(tex, { displayMode: display, throwOnError: false, output: 'htmlAndMathml' })),
      () => {},
    );
    return () => void (gone = true);
  }, [tex, display]);
  if (html === null) return <code class="convo-code">{tex}</code>;
  return <span class={display ? 'viewer-math viewer-math--block' : 'viewer-math'} dangerouslySetInnerHTML={{ __html: html }} />;
}

let made = 0;

/** A mermaid diagram, drawn as its SVG; its source while it loads, or when it is not one mermaid reads. */
export function Diagram({ text }: { text: string }) {
  const [svg, setSvg] = useState<string | null>(null);
  useEffect(() => {
    let gone = false;
    setSvg(null);
    void loadMermaid()
      .then((m) => m.render(`viewer-diagram-${++made}`, text))
      .then(
        (r) => !gone && setSvg(r.svg),
        () => {},
      );
    return () => void (gone = true);
  }, [text]);
  if (svg === null) return <pre class="md-code">{text}</pre>;
  return <div class="viewer-diagram" dangerouslySetInnerHTML={{ __html: svg }} />;
}

/** Markdown read as a viewer reads it: math known, mermaid blocks drawn. */
export const RICH: Rich = {
  lex: lexMath,
  code: (text, lang) => (lang === 'mermaid' ? <Diagram text={text} /> : null),
  math: (tex, display) => <TeX tex={tex} display={display} />,
};
