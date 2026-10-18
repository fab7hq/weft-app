// An agent's message read as markdown: the same blocks the desktop app draws.
import { describe, expect, it } from 'vitest';
import { blocks, type Span } from '../src/markdown';

const plain = (spans: Span[]) => spans.map((s) => s.text).join('');

describe('markdown', () => {
  it('reads a message as its markdown', () => {
    const b = blocks('## Done\n\nAdded **/health** and `cargo test` passes.\n\n- one\n- two with *care*\n\n1. first\n2. second\n\n```rust\nfn main() {}\n```\n\n> quoted\n\n---\n\n| file | change |\n| --- | --- |\n| a.rs | new |\n');
    expect(b.map((x) => x.kind)).toEqual(['heading', 'paragraph', 'list', 'list', 'code', 'quote', 'rule', 'table']);
    expect(b[0]).toMatchObject({ kind: 'heading', level: 2 });
    const p = b[1] as Extract<(typeof b)[number], { kind: 'paragraph' }>;
    expect(plain(p.spans)).toBe('Added /health and cargo test passes.');
    expect(p.spans.find((s) => s.text === '/health')?.bold).toBe(true);
    expect(p.spans.find((s) => s.text === 'cargo test')?.code).toBe(true);
    const list = b[2] as Extract<(typeof b)[number], { kind: 'list' }>;
    expect(list.start).toBeNull();
    expect(list.items).toHaveLength(2);
    expect(JSON.stringify(list.items[1])).toContain('"italic":true');
    expect(b[3]).toMatchObject({ kind: 'list', start: 1 });
    expect(b[4]).toEqual({ kind: 'code', text: 'fn main() {}' });
    const table = b[7] as Extract<(typeof b)[number], { kind: 'table' }>;
    expect(table.head.map(plain)).toEqual(['file', 'change']);
    expect(table.rows[0].map(plain)).toEqual(['a.rs', 'new']);
  });

  it('reads plain text and HTML as written', () => {
    const b = blocks('first line\nsecond line\n\n<b>not bold</b> & `a < b`');
    expect(b[0]).toEqual({ kind: 'paragraph', spans: [{ text: 'first line\nsecond line' }] });
    expect(b.map((x) => (x.kind === 'paragraph' ? plain(x.spans) : '')).join('|')).toContain('<b>not bold</b> & a < b');
    expect(blocks('')).toEqual([]);
  });
});
