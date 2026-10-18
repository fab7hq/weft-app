// An agent's message drawn from its markdown (markdown.ts): headings, lists,
// code, quotes and tables as blocks; bold, italic, code and links within a
// line. Drawn as elements, never as HTML.
import { blocks, type Block, type Span } from '../markdown';

function Line({ spans }: { spans: Span[] }) {
  return (
    <>
      {spans.map((s, n) => {
        let el: preact.ComponentChildren = s.text;
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

function Blocks({ blocks }: { blocks: Block[] }) {
  return (
    <>
      {blocks.map((b, n) => {
        switch (b.kind) {
          case 'heading':
            return <p key={n} class={`md-heading md-h${Math.min(b.level, 3)}`}><Line spans={b.spans} /></p>;
          case 'paragraph':
            return <p key={n} class="md-p"><Line spans={b.spans} /></p>;
          case 'list': {
            const items = b.items.map((item, i) => <li key={i}><Blocks blocks={item} /></li>);
            return b.start === null ? <ul key={n} class="md-list">{items}</ul> : <ol key={n} class="md-list" start={b.start}>{items}</ol>;
          }
          case 'code':
            return <pre key={n} class="md-code">{b.text}</pre>;
          case 'quote':
            return <blockquote key={n} class="md-quote"><Blocks blocks={b.blocks} /></blockquote>;
          case 'rule':
            return <hr key={n} class="md-rule" />;
          case 'table':
            return (
              <div key={n} class="md-table-wrap">
                <table class="md-table">
                  <thead><tr>{b.head.map((c, i) => <th key={i}><Line spans={c} /></th>)}</tr></thead>
                  <tbody>{b.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}><Line spans={c} /></td>)}</tr>)}</tbody>
                </table>
              </div>
            );
        }
      })}
    </>
  );
}

/** An agent's message, from its text. */
export function Markdown({ text }: { text: string }) {
  return <Blocks blocks={blocks(text)} />;
}
