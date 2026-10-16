// The key bar (web-app.md §6): two rows of generic keys. Row one is always
// there; Fn opens row two, whose keys light until the next key. Every key goes
// to the agent, never into the message box. What is lit is shared, so a
// character typed in the message box while Ctrl is lit is a key too.
import { signal } from '@preact/signals';
import { chord, held, NONE, ROW_ONE, ROW_TWO, sent, tap, type Mods } from '../keys';
import { w } from '../words';

export const mods = signal<Mods>(NONE);
const open = signal(false);

/** Send a key bar key with what is lit, then let go of it. */
export function press(name: string, send: (bytes: number[]) => void): void {
  send(chord(name, mods.value));
  mods.value = sent(mods.value);
}

export function KeyBar({ send }: { send: (bytes: number[]) => void }) {
  let release: (() => void) | null = null;
  const letGo = () => {
    release?.();
    release = null;
  };
  return (
    <div class="agent-keys" role="toolbar" aria-label={w('web.act.keys')}>
      <div class="key-row">
        {ROW_ONE.map(({ label, name }) => {
          if (name === 'Fn')
            return (
              <button
                key={name}
                class={open.value ? 'agent-key key-lit' : 'agent-key'}
                type="button"
                aria-label={label}
                aria-expanded={open.value}
                onClick={() => {
                  open.value = !open.value;
                  if (!open.value) mods.value = NONE;
                }}
              >
                {label}
              </button>
            );
          if (name === 'Backspace')
            // Held, it deletes again and again (§6).
            return (
              <button
                key={name}
                class="agent-key"
                type="button"
                aria-label={name}
                onPointerDown={() => {
                  letGo();
                  const m = mods.value;
                  mods.value = sent(m);
                  release = held(() => send(chord(name, m)));
                }}
                onPointerUp={letGo}
                onPointerLeave={letGo}
                onPointerCancel={letGo}
              >
                {label}
              </button>
            );
          return (
            <button key={name} class="agent-key" type="button" aria-label={name} onClick={() => press(name, send)}>
              {label}
            </button>
          );
        })}
      </div>
      {open.value && (
        <div class="key-row key-row--two">
          {ROW_TWO.map(({ label, mod }) => {
            const lit = mods.value[mod!];
            return (
              <button
                key={label}
                class={lit ? 'agent-key key-lit' : 'agent-key'}
                type="button"
                aria-label={label}
                aria-pressed={lit}
                onClick={() => {
                  const { mods: next, bytes } = tap(mods.value, mod!);
                  mods.value = next;
                  if (bytes) send(bytes);
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
