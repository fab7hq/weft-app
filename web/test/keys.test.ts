// web-app.md §6: generic keys in two rows. Weft names no harness's
// shortcuts; these are the terminal's own encodings.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { chord, encode, held, NONE, ROW_ONE, ROW_TWO, sent, tap, typed } from '../src/keys';

const hex = (bytes: number[] | null) => bytes && bytes.map((b) => b.toString(16).padStart(2, '0')).join(' ');
const lit = (over: Partial<typeof NONE>) => ({ ...NONE, ...over });

describe('the key bar', () => {
  it('holds two rows of generic keys and nothing of any harness', () => {
    expect(ROW_ONE.map((k) => k.label)).toEqual(['Esc', '↑', '↓', '←', '→', '⌫', '⏎', 'Fn']);
    expect(ROW_TWO.map((k) => k.label)).toEqual(['Ctrl', 'Alt', 'Tab']);
  });

  it('sends each key as the terminal encodes it', () => {
    const plain = (name: string) => hex(chord(name, NONE));
    expect(plain('Esc')).toBe('1b');
    expect(plain('Backspace')).toBe('7f');
    expect(plain('Left')).toBe('1b 5b 44');
    expect(plain('Up')).toBe('1b 5b 41');
    expect(plain('Down')).toBe('1b 5b 42');
    expect(plain('Right')).toBe('1b 5b 43');
    expect(plain('Enter')).toBe('0d');
    expect(plain('1')).toBe('31');
  });

  it('sends a row-two key, then a row-one key, as one combination', () => {
    expect(hex(chord('Left', lit({ ctrl: true })))).toBe('1b 5b 31 3b 35 44');
    expect(hex(chord('Up', lit({ alt: true })))).toBe('1b 5b 31 3b 33 41');
    expect(hex(chord('Right', lit({ ctrl: true, alt: true })))).toBe('1b 5b 31 3b 37 43');
    expect(hex(chord('Backspace', lit({ alt: true })))).toBe('1b 7f');
    expect(hex(chord('Esc', lit({ alt: true })))).toBe('1b 1b');
    expect(hex(chord('Right', lit({ tab: true })))).toBe('09 1b 5b 43');
    expect(hex(chord('Enter', lit({ tab: true, alt: true })))).toBe('09 1b 0d');
  });

  it('a row-two key lights on a tap and goes off on the next; a lit Tab tapped again is a Tab', () => {
    expect(tap(NONE, 'ctrl')).toEqual({ mods: lit({ ctrl: true }), bytes: null });
    expect(tap(lit({ ctrl: true }), 'ctrl')).toEqual({ mods: NONE, bytes: null });
    expect(tap(NONE, 'tab')).toEqual({ mods: lit({ tab: true }), bytes: null });
    expect(tap(lit({ tab: true, ctrl: true }), 'tab')).toEqual({ mods: NONE, bytes: [0x09] });
  });

  it('a key sent lets go of every row-two key', () => {
    expect(sent(lit({ ctrl: true, alt: true, tab: true }))).toEqual(NONE);
  });
});

describe('holding ⌫', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('deletes once, then again and again until it is let go', () => {
    const send = vi.fn();
    const release = held(send);
    expect(send).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(349);
    expect(send).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    expect(send).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(100);
    expect(send).toHaveBeenCalledTimes(4);
    release();
    vi.advanceTimersByTime(1000);
    expect(send).toHaveBeenCalledTimes(4);
  });
});

describe('a hardware keyboard', () => {
  const key = (key: string, mods: Partial<KeyboardEventInit> = {}) => encode({ key, metaKey: false, isComposing: false, shiftKey: false, altKey: false, ctrlKey: false, ...mods } as KeyboardEvent);

  it('keeps Shift, Alt and Ctrl on an arrow', () => {
    expect(hex(key('ArrowLeft'))).toBe('1b 5b 44');
    expect(hex(key('ArrowLeft', { shiftKey: true }))).toBe('1b 5b 31 3b 32 44');
    expect(hex(key('ArrowUp', { ctrlKey: true }))).toBe(hex(chord('Up', lit({ ctrl: true }))));
    expect(hex(key('ArrowRight', { altKey: true }))).toBe('1b 5b 31 3b 33 43');
    expect(hex(key('PageUp', { shiftKey: true }))).toBe('1b 5b 35 3b 32 7e');
    expect(hex(key('Tab', { shiftKey: true }))).toBe('1b 5b 5a');
  });
});

describe('a character typed while a row-two key is lit', () => {
  it('is a key, not text', () => {
    expect(hex(typed('r', lit({ ctrl: true })))).toBe('12');
    expect(hex(typed('R', lit({ ctrl: true })))).toBe('12');
    expect(hex(typed('c', lit({ ctrl: true })))).toBe('03');
    expect(hex(typed('[', lit({ ctrl: true })))).toBe('1b');
    expect(hex(typed('x', lit({ alt: true })))).toBe('1b 78');
    expect(hex(typed('x', lit({ alt: true, ctrl: true })))).toBe('1b 18');
    expect(hex(typed('x', lit({ tab: true })))).toBe('09 78');
  });

  it('is text when nothing is lit', () => {
    expect(typed('r', NONE)).toBeNull();
  });
});
