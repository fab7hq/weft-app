// What an agent said, as blocks the page draws: its markdown read the way a
// terminal shows it, the same blocks Weft's desktop app draws. Read with
// marked's lexer only: no HTML is ever made from it, so HTML in a message is
// text.
import { marked, type Token, type Tokens } from 'marked';

/** A run of text in one style. */
export interface Span {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
  strike?: boolean;
  link?: string;
}

export type Block =
  | { kind: 'heading'; level: number; spans: Span[] }
  | { kind: 'paragraph'; spans: Span[] }
  /** `start` is an ordered list's first number; null for bullets. */
  | { kind: 'list'; start: number | null; items: Block[][] }
  | { kind: 'code'; text: string }
  | { kind: 'quote'; blocks: Block[] }
  | { kind: 'rule' }
  | { kind: 'table'; head: Span[][]; rows: Span[][][] };

/** The lexer gives some text as HTML would carry it. */
const unescape = (t: string) =>
  t.replace(/&(amp|lt|gt|quot|#39);/g, (_, e: string) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" })[e] ?? '');

// A link goes only to the web or an address: any other scheme
// (`javascript:`, `data:`) in an agent's message would run on a click.
function safe(href: string): string | undefined {
  return /^(https?|mailto):/i.test(href) ? href : undefined;
}

/** A message's text as blocks. */
export function blocks(text: string): Block[] {
  return read(marked.lexer(text, { gfm: true }));
}

function read(tokens: Token[]): Block[] {
  const out: Block[] = [];
  for (const t of tokens) {
    switch (t.type) {
      case 'heading':
        out.push({ kind: 'heading', level: (t as Tokens.Heading).depth, spans: spans((t as Tokens.Heading).tokens) });
        break;
      case 'paragraph':
        out.push({ kind: 'paragraph', spans: spans((t as Tokens.Paragraph).tokens) });
        break;
      case 'text': {
        // A tight list item's text: a paragraph of its own.
        const x = t as Tokens.Text;
        out.push({ kind: 'paragraph', spans: x.tokens ? spans(x.tokens) : [{ text: unescape(x.text) }] });
        break;
      }
      case 'list': {
        const l = t as Tokens.List;
        out.push({ kind: 'list', start: l.ordered ? Number(l.start || 1) : null, items: l.items.map((i) => read(i.tokens)) });
        break;
      }
      case 'code':
        out.push({ kind: 'code', text: (t as Tokens.Code).text });
        break;
      case 'blockquote':
        out.push({ kind: 'quote', blocks: read((t as Tokens.Blockquote).tokens) });
        break;
      case 'hr':
        out.push({ kind: 'rule' });
        break;
      case 'table': {
        const x = t as Tokens.Table;
        out.push({ kind: 'table', head: x.header.map((c) => spans(c.tokens)), rows: x.rows.map((r) => r.map((c) => spans(c.tokens))) });
        break;
      }
      case 'html':
        out.push({ kind: 'paragraph', spans: [{ text: (t as Tokens.HTML).text.trimEnd() }] });
        break;
      case 'space':
        break;
      default:
        if ('text' in t && typeof t.text === 'string') out.push({ kind: 'paragraph', spans: [{ text: unescape(t.text) }] });
    }
  }
  return out;
}

/** Inline tokens as spans, styles nested as written; neighbours in one style joined. */
function spans(tokens: Token[] | undefined, style: Omit<Span, 'text'> = {}): Span[] {
  const out: Span[] = [];
  const push = (text: string, s: Omit<Span, 'text'>) => {
    if (!text) return;
    const last = out[out.length - 1];
    if (last && JSON.stringify({ ...last, text: '' }) === JSON.stringify({ ...s, text: '' })) last.text += text;
    else out.push({ ...s, text });
  };
  // Inner tokens in this style and theirs.
  const nest = (inner: Token[] | undefined, s: Omit<Span, 'text'>) => {
    for (const { text, ...rest } of spans(inner, s)) push(text, rest);
  };
  for (const t of tokens ?? []) {
    switch (t.type) {
      case 'strong':
        nest((t as Tokens.Strong).tokens, { ...style, bold: true });
        break;
      case 'em':
        nest((t as Tokens.Em).tokens, { ...style, italic: true });
        break;
      case 'del':
        nest((t as Tokens.Del).tokens, { ...style, strike: true });
        break;
      case 'link':
        nest((t as Tokens.Link).tokens, { ...style, link: safe((t as Tokens.Link).href) });
        break;
      case 'codespan':
        push(unescape((t as Tokens.Codespan).text), { ...style, code: true });
        break;
      case 'br':
        push('\n', style);
        break;
      case 'text': {
        const x = t as Tokens.Text;
        if (x.tokens?.length) nest(x.tokens, style);
        else push(unescape(x.text), style);
        break;
      }
      default:
        if ('text' in t && typeof t.text === 'string') push(unescape(t.text), style);
    }
  }
  // Only the styles a span has.
  return out.map((s) => Object.fromEntries(Object.entries(s).filter(([, v]) => v !== undefined && v !== false)) as unknown as Span);
}
