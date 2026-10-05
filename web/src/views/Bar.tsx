// The TUI's bar (web-app.md §7): [A]SK [E]VAL [S]EAL and the keys. On a
// phone it is a sheet behind ⌃.
import type { ComponentChildren } from 'preact';
import { signal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { w } from '../words';

/** A bar label the way the TUI writes it: the key in brackets, the rest in capitals. */
export function Label({ act }: { act: string }) {
  const upper = w(act).toUpperCase();
  return <>{`[${upper[0]}]${upper.slice(1)}`}</>;
}

export interface BarActs {
  live: boolean;
  onAsk: () => void;
  onList: (() => void) | null;
  onHistory: () => void;
  onWeft: () => void;
}

export function BarSheet({ acts, keys, onClose }: { acts: BarActs; keys: ComponentChildren; onClose: () => void }) {
  const { live } = acts;
  // Escape closes it, as it closes the TUI's own views.
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', esc);
    return () => removeEventListener('keydown', esc);
  }, [onClose]);
  const then = (f: () => void) => () => {
    onClose();
    f();
  };
  return (
    <div class="sheet-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class="fab7-sheet bar-sheet" role="dialog" aria-label="Weft">
        <div class="bar-row">
          <button class="fab7-button fab7-button--secondary" type="button" aria-label={w('act.ask')} disabled={!live} onClick={then(acts.onAsk)}><Label act="act.ask" /></button>
        </div>
        {keys}
      </div>
    </div>
  );
}

/** The open agent's acts, for the bar a wide layout draws under the list and the pane. */
export const wideActs = signal<BarActs | null>(null);
/** The pane has the keys: everything typed goes to the agent, as in the TUI. */
export const paneHasKeys = signal(false);

/** The TUI's bar, one line under the list and the pane (web-app.md §4, §7). */
export function WideBar() {
  const acts = wideActs.value;
  return (
    <div class="wide-bar" role="toolbar" aria-label="Weft">
      {paneHasKeys.value ? (
        <span class="wide-bar-hint">{'Ctrl+]  BACK TO WEFT'}</span>
      ) : (
        <>
          <button class="bar-word" type="button" disabled={!acts?.live} onClick={() => acts?.onAsk()}><Label act="act.ask" /></button>
          <span class="spacer" />
          <button class="bar-word" type="button" onClick={() => acts?.onWeft()}>{'[W]EFT ⌄'}</button>
        </>
      )}
    </div>
  );
}
