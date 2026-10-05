// The key bar (web-app.md §6): sticky Ctrl, Alt and ⇧, then the generic keys.
// The modifiers are shared, so the sheet and the bar on the keyboard light the
// same Ctrl.
import { signal } from '@preact/signals';
import { BAR, chord, NONE, sent, tap, type Mods } from '../keys';
import { w } from '../words';

export const mods = signal<Mods>(NONE);

/** Send a key bar key with what is lit, then let go of what was lit once. */
export function press(name: string, send: (bytes: number[]) => void): void {
  send(chord(name, mods.value));
  mods.value = sent(mods.value);
}

const MODIFIERS: [keyof Mods, string][] = [
  ['ctrl', 'Ctrl'],
  ['alt', 'Alt'],
  ['shift', '⇧'],
];

export function KeyBar({ send }: { send: (bytes: number[]) => void }) {
  return (
    <div class="fab7-keybar" role="toolbar" aria-label={w('web.act.keys')}>
      {MODIFIERS.map(([which, label]) => {
        const lit = mods.value[which];
        return (
          <button
            key={which}
            class={lit === 'off' ? 'fab7-key' : 'fab7-key key-lit'}
            type="button"
            aria-label={label}
            aria-pressed={lit !== 'off'}
            data-lit={lit}
            onClick={() => (mods.value = tap(mods.value, which))}
          >
            {label}
          </button>
        );
      })}
      {BAR.map(({ label, name }) => (
        <button key={name} class="fab7-key" type="button" aria-label={name} onClick={() => press(name, send)}>
          {label}
        </button>
      ))}
    </div>
  );
}
