// An agent's message drawn from its markdown (markdown.ts): headings, lists,
// code, quotes and tables as blocks; bold, italic, code and links within a
// line. Drawn as elements, never as HTML.
import { Fragment, type VNode } from 'preact';
import { blocks, type Block, type Span } from '../markdown';
import type { Token } from 'marked';

/** What a viewer draws richer than a message: a fenced block by its language (a diagram), and math. */
export interface Rich {
  lex?: (text: string) => Token[];
  code?: (text: string, lang: string | undefined) => VNode | null;
  math?: (tex: string, display: boolean) => VNode;
}

function Line({ spans, rich }: { spans: Span[]; rich?: Rich }) {
  return (
    <>
      {spans.map((s, n) => {
        let el: preact.ComponentChildren = s.math && rich?.math ? rich.math(s.text, false) : s.text;
        if (s.code) el = <code class="convo-code">{el}</code>;
        if (s.bold) el = <strong>{el}</strong>;
        if (s.italic) el = <em>{el}</em>;
        if (s.strike) el = <s>{el}</s>;
        if (s.link) el = <a href={s.link} target="_blank" rel="noreferrer noopener">{el}</a>;
        return <span key={n}>{el}</span>;
      })}
    </>
  );
}

function Blocks({ blocks, rich }: { blocks: Block[]; rich?: Rich }) {
  return (
    <>
      {blocks.map((b, n) => {
        switch (b.kind) {
          case 'heading':
            return <p key={n} class={`md-heading md-h${Math.min(b.level, 3)}`}><Line rich={rich} spans={b.spans} /></p>;
          case 'paragraph':
            return <p key={n} class="md-p"><Line rich={rich} spans={b.spans} /></p>;
          case 'list': {
            const items = b.items.map((item, i) => <li key={i}><Blocks blocks={item} rich={rich} /></li>);
            return b.start === null ? <ul key={n} class="md-list">{items}</ul> : <ol key={n} class="md-list" start={b.start}>{items}</ol>;
          }
          case 'code':
          {
            const drawn = rich?.code?.(b.text, b.lang);
            return drawn ? <Fragment key={n}>{drawn}</Fragment> : <pre key={n} class="md-code">{b.text}</pre>;
          }
          case 'math':
            return rich?.math ? <div key={n} class="md-math">{rich.math(b.tex, true)}</div> : <pre key={n} class="md-code">{b.tex}</pre>;
          case 'quote':
            return <blockquote key={n} class="md-quote"><Blocks blocks={b.blocks} rich={rich} /></blockquote>;
          case 'rule':
            return <hr key={n} class="md-rule" />;
          case 'table':
            return (
              <div key={n} class="md-table-wrap">
                <table class="md-table">
                  <thead><tr>{b.head.map((c, i) => <th key={i}><Line rich={rich} spans={c} /></th>)}</tr></thead>
                  <tbody>{b.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}><Line rich={rich} spans={c} /></td>)}</tr>)}</tbody>
                </table>
              </div>
            );
        }
      })}
    </>
  );
}

/** An agent's message, from its text; a viewer's file drawn `rich`er. */
export function Markdown({ text, rich }: { text: string; rich?: Rich }) {
  return <Blocks blocks={blocks(text, rich?.lex)} rich={rich} />;
}
