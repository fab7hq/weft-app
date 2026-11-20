// The Eval view as the machine sends it: items to look at, then settled; one
// shape and colour per kind, on its mark and dots only; the item chosen; where
// an item stands among the others; and a running Eval's ring of reads.
import { describe, expect, it } from 'vitest';
import { COLOUR, MARK, aside, chosen, pageOf, place, sections, toItem, toLines, windowsOf, type Item, type Kind, type Payload } from '../src/evalview';
import { evalLines } from '../src/jobs';
import { arcs } from '../src/progress';

const item = (key: string, kind: Kind, more: Partial<Item> = {}): Item => ({
  key, kind, text: key, count: 1, dots: [], again: false, head: '', big: '', why: [], sure: '', said: null, check: null, windows: [], reads: [], ...more,
});

// The items the fixture record gives, in the machine's order.
const ITEMS: Item[] = [
  item('c|sel_1/d2', 'before', { windows: ['w_sess'] }),
  item('w|w_sess', 'look', { dots: [true, true], windows: ['w_sess'] }),
  item('w|w_log', 'look', { dots: [true, true] }),
  item('r|ask_2/f0', 'look', { dots: [true] }),
  item('r|ask_1/f0', 'unsettled', { dots: [false, false, false], windows: ['w_form'] }),
  item('r|ask_1/f1', 'settled', { dots: [true] }),
  item('settled|explained', 'settled', { count: 3 }),
];

describe('the Eval view', () => {
  it('lists what to look at first, then what is settled, each in the order sent', () => {
    const { look, settled } = sections(ITEMS);
    expect(look.map((i) => i.key)).toEqual(['c|sel_1/d2', 'w|w_sess', 'w|w_log', 'r|ask_2/f0', 'r|ask_1/f0']);
    expect(settled.map((i) => i.key)).toEqual(['r|ask_1/f1', 'settled|explained']);
  });

  it('gives each kind one mark and one colour', () => {
    expect(MARK).toEqual({ before: '↺', look: '■', unsettled: '◆', settled: '●' });
    expect(COLOUR).toEqual({ before: 'teal', look: 'amber', unsettled: 'accent', settled: 'muted' });
  });

  it('chooses the item asked for, else the first', () => {
    expect(chosen(ITEMS, 'w|w_log')?.key).toBe('w|w_log');
    expect(chosen(ITEMS)?.key).toBe('c|sel_1/d2');
    expect(chosen(ITEMS, 'gone')?.key).toBe('c|sel_1/d2');
    expect(chosen([])).toBeNull();
  });

  it('places an item to look at among those to look at, a settled one among all', () => {
    expect(place(ITEMS, ITEMS[0])).toEqual({ k: 1, n: 5 });
    expect(place(ITEMS, ITEMS[2])).toEqual({ k: 3, n: 5 });
    expect(place(ITEMS, ITEMS[4])).toEqual({ k: 5, n: 5 });
    expect(place(ITEMS, ITEMS[6])).toEqual({ k: 7, n: 7 });
  });

  it('shows the dots, or says it is being read again, or nothing', () => {
    expect(aside(ITEMS[1])).toEqual({ dots: [true, true] });
    expect(aside({ ...ITEMS[1], again: true })).toEqual({ again: true });
    expect(aside(ITEMS[0])).toBeNull();
  });

  it('opens an item, and its lines, by its key', () => {
    expect(pageOf(undefined)).toEqual({ name: 'list' });
    expect(pageOf(toItem('w|w_log'))).toEqual({ name: 'item', key: 'w|w_log' });
    expect(pageOf(toLines('r|ask_1/f0'))).toEqual({ name: 'lines', key: 'r|ask_1/f0' });
  });

  it('shows the lines of each change an item points at that the machine sent', () => {
    const v = { lines: { w_sess: { path: 'src/auth/session.ts', lines: [{ n: 10, text: ' export', lit: false }] } } } as unknown as Payload;
    expect(windowsOf(v, ITEMS[1]).map((l) => l.path)).toEqual(['src/auth/session.ts']);
    expect(windowsOf(v, ITEMS[4])).toEqual([]);
  });
});

describe('a running Eval', () => {
  it('draws an arc per read: accent once in, breathing while read, the line colour still to come', () => {
    expect(arcs(['done', 'now', 'next'])).toEqual([
      { offset: 0, stroke: 'accent', breathes: false },
      { offset: -134, stroke: 'accent', breathes: true },
      { offset: -268, stroke: 'line', breathes: false },
    ]);
    expect(arcs(['now', 'next', 'next', 'next'])).toHaveLength(3);
  });

  it('says its steps as the machine names them, each done, under way or to come, with no time before its readers\' job is heard', () => {
    const lines = evalLines([{ name: 'What you asked', light: 'done' }, { name: 'Reading again where unsure', light: 'now' }, { name: 'Questions for your Seal', light: 'next' }], null, 0);
    expect(lines.map((l) => [l.state, l.words, l.time, l.count])).toEqual([
      ['done', 'What you asked', null, null], ['now', 'Reading again where unsure', null, null], ['next', 'Questions for your Seal', null, null],
    ]);
  });
});
