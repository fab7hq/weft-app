import { describe, expect, it } from 'vitest';
import { Held, type Item, gone, placeOf, rows, scrollFor, spans } from '../src/conversation';

const say = (id: string, kind: 'person' | 'agent', text: string): Item => ({ id, kind, at: 1, text });
const step = (id: string, tool: string, arg: string, extra: Partial<Item> = {}): Item => ({ id, kind: 'step', at: 1, tool, arg, call: id, ...extra });
const outcome = (call: string, failed: boolean): Item => ({ id: `${call}.o`, kind: 'outcome', at: 1, call, failed });

describe('a conversation', () => {
  it('groups the steps between two messages, each settled by its outcome or still running', () => {
    const items = [
      say('0', 'person', 'fix it'),
      step('1', 'Read', 'a.rs'),
      step('2', 'Bash', 'cargo test'),
      outcome('1', false),
      outcome('2', true),
      step('3', 'Ran', 'ls', { call: undefined, failed: false }),
      step('4', 'Bash', 'sleep 30'),
      say('5', 'agent', 'done'),
    ];
    expect(rows(items)).toEqual([
      { kind: 'person', id: '0', text: 'fix it', at: 1 },
      {
        kind: 'steps',
        id: '1',
        steps: [
          { tool: 'Read', arg: 'a.rs', state: 'done' },
          { tool: 'Bash', arg: 'cargo test', state: 'failed' },
          { tool: 'Ran', arg: 'ls', state: 'done' },
          { tool: 'Bash', arg: 'sleep 30', state: 'running' },
        ],
      },
      { kind: 'agent', id: '5', text: 'done', at: 1 },
    ]);
  });

  it('an outcome on a newer page settles a step on an older one', () => {
    const held = new Held();
    held.after([outcome('1', false), say('9', 'agent', 'ok')]);
    held.before([say('0', 'person', 'go'), step('1', 'Read', 'a.rs')]);
    expect(rows(held.all())[1]).toEqual({ kind: 'steps', id: '1', steps: [{ tool: 'Read', arg: 'a.rs', state: 'done' }] });
  });

  it('a message in parts is held whole once every part is in, in part order', () => {
    const held = new Held();
    held.after([{ ...say('7', 'agent', 'world'), part: 2, parts: 2 }]);
    expect(held.all()).toEqual([]);
    held.after([{ ...say('7', 'agent', 'hello '), part: 1, parts: 2 }]);
    expect(held.all()).toEqual([say('7', 'agent', 'hello world')]);
  });

  it('an item with an id already held replaces it', () => {
    const held = new Held();
    held.after([say('1', 'agent', 'a')]);
    held.after([say('1', 'agent', 'b')]);
    expect(held.all()).toEqual([say('1', 'agent', 'b')]);
  });

  it('code spans are told apart', () => {
    expect(spans("I'll update `src/login.rs` now")).toEqual([
      { code: false, text: "I'll update " },
      { code: true, text: 'src/login.rs' },
      { code: false, text: ' now' },
    ]);
  });
});

describe('where a conversation was left', () => {
  const laid = [
    { id: 'a', top: 0, bottom: 100 },
    { id: 'b', top: 116, bottom: 200 },
    { id: 'c', top: 216, bottom: 400 },
  ];

  it('is the first message still in sight, and how far into it the view was', () => {
    expect(placeOf(laid, 150, false)).toEqual({ id: 'b', dy: -34 });
    expect(placeOf(laid, 0, false)).toEqual({ id: 'a', dy: 0 });
    // Between two messages: the next one, a little below the top.
    expect(placeOf(laid, 105, false)).toEqual({ id: 'b', dy: 11 });
  });

  it('is its end while it was at its end, whatever came since', () => {
    expect(placeOf(laid, 300, true)).toBeNull();
  });

  it('comes back to the same message where it now is, or not until it is read', () => {
    const now = laid.map((r) => ({ ...r, top: r.top + 500, bottom: r.bottom + 500 }));
    expect(scrollFor({ id: 'b', dy: -34 }, now)).toBe(650);
    expect(scrollFor({ id: 'z', dy: 0 }, now)).toBeUndefined();
  });
});

describe('a place whose message is gone', () => {
  it('is gone once a message from before it is read and it is not', () => {
    expect(gone({ id: '500.0', dy: 0 }, ['600.0', '700.0'])).toBe(false);
    expect(gone({ id: '500.0', dy: 0 }, ['400.0', '600.0'])).toBe(true);
    // Its line read, its part not.
    expect(gone({ id: '500.1', dy: 0 }, ['500.0', '600.0'])).toBe(true);
    expect(gone({ id: '500.1', dy: 0 }, ['500.1', '600.0'])).toBe(false);
  });

  it('is gone at once when all that is read is older than the newest it held: the file was replaced', () => {
    expect(gone({ id: '500.0', dy: 0, last: '900.0' }, ['600.0', '700.0'])).toBe(true);
    expect(gone({ id: '500.0', dy: 0, last: '900.0' }, ['600.0', '900.0', '950.0'])).toBe(false);
    expect(gone({ id: '500.0', dy: 0, last: '900.0' }, [])).toBe(false);
  });
});
