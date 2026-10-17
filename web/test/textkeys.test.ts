// The web's text fields do what Weft's one key table says, the table the
// desktop's fields read too: Enter sends, Shift+Enter adds a line, Tab takes a
// suggestion, Escape drops it, and every other key is the browser field's own.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import kept from '../src/text-keys.json';
import { edit, own, system, type System } from '../src/textkeys';

const tables: Record<System, Record<string, string>> = kept;
const systems: System[] = ['macos', 'linux'];
const source = join(import.meta.dirname, '../../../weft/crates/weft-core/text_keys.json');

/** A key event as a browser sends it for a chord the table names. */
function press(chord: string) {
  const parts = chord.split('-');
  const key = parts.pop()!;
  const dom: Record<string, string> = { enter: 'Enter', escape: 'Escape', tab: 'Tab', left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown', home: 'Home', end: 'End', backspace: 'Backspace', delete: 'Delete' };
  return { key: dom[key] ?? key, ctrlKey: parts.includes('ctrl'), altKey: parts.includes('alt'), shiftKey: parts.includes('shift'), metaKey: parts.includes('cmd') };
}

describe('the text key table', () => {
  it('is the copy of weft-core\'s', () => {
    if (!existsSync(source)) return;
    expect(tables).toEqual(JSON.parse(readFileSync(source, 'utf8')));
  });

  it('names what each key does on each system, from the key as the browser sends it', () => {
    for (const on of systems) {
      for (const [chord, name] of Object.entries(tables[on])) expect(edit(press(chord), on), `${on} ${chord}`).toBe(name);
      expect(edit({ key: 'a', ctrlKey: false, altKey: false, shiftKey: false, metaKey: false }, on)).toBeNull();
    }
    // A letter is the same key with Shift held: the browser sends it upper case.
    expect(edit({ key: 'Z', ctrlKey: false, altKey: false, shiftKey: true, metaKey: true }, 'macos')).toBe('redo');
    expect(edit({ key: 'Z', ctrlKey: true, altKey: false, shiftKey: true, metaKey: false }, 'linux')).toBe('redo');
    expect(edit(press('cmd-c'), 'linux')).toBeNull();
  });

  it('takes the system from the browser', () => {
    expect(system('MacIntel')).toBe('macos');
    expect(system('iPhone')).toBe('macos');
    expect(system('Linux x86_64')).toBe('linux');
  });

  it('leaves every edit but sending and the suggestion to the browser field', () => {
    for (const on of systems) {
      const mine = Object.entries(tables[on]).filter(([chord]) => own(press(chord), on) !== null).map(([, name]) => name);
      expect(new Set(mine)).toEqual(new Set(['send', 'take', 'drop']));
      expect(own(press('shift-enter'), on)).toBeNull();
    }
  });
});
