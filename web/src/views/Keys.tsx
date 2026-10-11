// The key bar (web-app.md §6): the generic keys and sticky Ctrl, Alt and ⇧,
// the most used first. Every key goes to the agent, never into the message box.
// The modifiers are shared, so the bar under the message row and the
// desktop's Keys light the same Ctrl.
import { signal } from '@preact/signals';
import { BAR, chord, NONE, sent, tap, type Mods } from '../keys';
import { w } from '../words';

export const mods = signal<Mods>(NONE);

/** Send a key bar key with what is lit, then let go of what was lit once. */
export function press(name: string, send: (bytes: number[]) => void): void {
  send(chord(name, mods.value));
  mods.value = sent(mods.value);
}

/** The rows the desktop's popover draws the keys in (D3.11): the most used,
 * then the rest. On a phone or a tablet they are one line that scrolls
 * (M3.10, M3.11). Where they stand is the CSS's. */
const ROWS = [BAR.slice(0, 7), BAR.slice(7)];

export function KeyBar({ send }: { send: (bytes: number[]) => void }) {
  return (
    <div class="agent-keys" role="toolbar" aria-label={w('web.act.keys')}>
      {ROWS.map((row, i) => (
        <div key={i} class="key-row">
          {row.map(({ label, name, mod }) => {
            if (!mod) {
              return (
                <button key={name} class="agent-key" type="button" aria-label={name} onClick={() => press(name, send)}>
                  {label}
                </button>
              );
            }
            const lit = mods.value[mod];
            return (
              <button
                key={name}
                class={lit === 'off' ? 'agent-key' : 'agent-key key-lit'}
                type="button"
                aria-label={label}
                aria-pressed={lit !== 'off'}
                data-lit={lit}
                onClick={() => (mods.value = tap(mods.value, mod))}
              >
                {label}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
