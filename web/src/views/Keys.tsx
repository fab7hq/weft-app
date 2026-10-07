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

/** The rows the cards draw the keys in (M3.11): the modifiers with Esc and
 * Tab, the arrows with ⏎, then ^C PgUp PgDn. Where they stand is the CSS's:
 * one scrolling line on the keyboard (M3.10), two rows in the desktop's
 * popover (D3.11), three in the phone's sheet. */
const ROWS = [BAR.slice(0, 2), BAR.slice(2, 7), BAR.slice(7)];

export function KeyBar({ send }: { send: (bytes: number[]) => void }) {
  return (
    <div class="agent-keys" role="toolbar" aria-label={w('web.act.keys')}>
      {ROWS.map((row, i) => (
        <div key={i} class="key-row">
          {i === 0 &&
            MODIFIERS.map(([which, label]) => {
              const lit = mods.value[which];
              return (
                <button
                  key={which}
                  class={lit === 'off' ? 'agent-key' : 'agent-key key-lit'}
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
          {row.map(({ label, name }) => (
            <button key={name} class="agent-key" type="button" aria-label={name} onClick={() => press(name, send)}>
              {label}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
