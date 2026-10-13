// web-app.md §6: generic keys and sticky modifiers. Weft names no harness's
// shortcuts; these are the terminal's own encodings.
import { describe, expect, it } from 'vitest';
import { BAR, chord, encode, NONE, sent, tap, typed } from '../src/keys';

const hex = (bytes: number[] | null) => bytes && bytes.map((b) => b.toString(16).padStart(2, '0')).join(' ');
const lit = (over: Partial<typeof NONE>) => ({ ...NONE, ...over });

describe('the key bar', () => {
  it('holds the generic keys, the most used first, and nothing of any harness', () => {
    expect(BAR.map((k) => k.label)).toEqual(['Esc', '↑', '↓', '⏎', '⇧', 'Tab', '⌫', '^C', '←', '→', 'Ctrl', 'Alt', 'PgUp', 'PgDn']);
  });

  it('sends each key as the terminal encodes it', () => {
    const plain = (name: string) => hex(chord(name, NONE));
    expect(plain('Esc')).toBe('1b');
    expect(plain('Tab')).toBe('09');
    expect(plain('Backspace')).toBe('7f');
    expect(plain('Left')).toBe('1b 5b 44');
    expect(plain('Up')).toBe('1b 5b 41');
    expect(plain('Down')).toBe('1b 5b 42');
    expect(plain('Right')).toBe('1b 5b 43');
    expect(plain('Enter')).toBe('0d');
    expect(plain('Control-C')).toBe('03');
    expect(plain('PgUp')).toBe('1b 5b 35 7e');
    expect(plain('PgDn')).toBe('1b 5b 36 7e');
    expect(plain('1')).toBe('31');
  });

  it('adds a lit modifier to a key', () => {
    expect(hex(chord('Tab', lit({ shift: 'once' })))).toBe('1b 5b 5a');
    expect(hex(chord('Up', lit({ shift: 'once' })))).toBe('1b 5b 31 3b 32 41');
    expect(hex(chord('Left', lit({ ctrl: 'once' })))).toBe('1b 5b 31 3b 35 44');
    expect(hex(chord('PgDn', lit({ alt: 'once' })))).toBe('1b 5b 36 3b 33 7e');
    expect(hex(chord('Esc', lit({ alt: 'once' })))).toBe('1b 1b');
    expect(hex(chord('1', lit({ alt: 'once' })))).toBe('1b 31');
  });
});

describe('a hardware keyboard', () => {
  const key = (key: string, mods: Partial<KeyboardEventInit> = {}) => encode({ key, metaKey: false, isComposing: false, shiftKey: false, altKey: false, ctrlKey: false, ...mods } as KeyboardEvent);

  it('keeps Shift, Alt and Ctrl on an arrow, as the key bar does', () => {
    expect(hex(key('ArrowLeft'))).toBe('1b 5b 44');
    expect(hex(key('ArrowLeft', { shiftKey: true }))).toBe(hex(chord('Left', lit({ shift: 'once' }))));
    expect(hex(key('ArrowLeft', { shiftKey: true }))).toBe('1b 5b 31 3b 32 44');
    expect(hex(key('ArrowUp', { ctrlKey: true }))).toBe('1b 5b 31 3b 35 41');
    expect(hex(key('ArrowRight', { altKey: true }))).toBe('1b 5b 31 3b 33 43');
    expect(hex(key('PageUp', { shiftKey: true }))).toBe('1b 5b 35 3b 32 7e');
    expect(hex(key('Tab', { shiftKey: true }))).toBe('1b 5b 5a');
  });
});

describe('a character typed while Ctrl or Alt is lit', () => {
  it('is a key, not text', () => {
    expect(hex(typed('r', lit({ ctrl: 'once' })))).toBe('12');
    expect(hex(typed('R', lit({ ctrl: 'once' })))).toBe('12');
    expect(hex(typed('a', lit({ ctrl: 'once' })))).toBe('01');
    expect(hex(typed('z', lit({ ctrl: 'locked' })))).toBe('1a');
    expect(hex(typed('[', lit({ ctrl: 'once' })))).toBe('1b');
    expect(hex(typed('x', lit({ alt: 'once' })))).toBe('1b 78');
    expect(hex(typed('x', lit({ alt: 'once', ctrl: 'once' })))).toBe('1b 18');
  });

  it('is text when only ⇧, or nothing, is lit', () => {
    expect(typed('r', NONE)).toBeNull();
    expect(typed('r', lit({ shift: 'once' }))).toBeNull();
  });
});

describe('sticky modifiers', () => {
  it('light for one key on a tap, lock on a second, and go off on a third', () => {
    expect(tap(NONE, 'ctrl').ctrl).toBe('once');
    expect(tap(tap(NONE, 'ctrl'), 'ctrl').ctrl).toBe('locked');
    expect(tap(tap(tap(NONE, 'ctrl'), 'ctrl'), 'ctrl').ctrl).toBe('off');
  });

  it('a key clears what was lit once and keeps what is locked', () => {
    expect(sent(lit({ ctrl: 'once', alt: 'locked', shift: 'once' }))).toEqual(lit({ alt: 'locked' }));
  });
});
