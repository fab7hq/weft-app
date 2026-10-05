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
  /** The Ask the agent's Eval and Seal act on, if one is on the board. */
  unit: { title: string; eval: unknown } | null | undefined;
  onAct: (which: 'ask' | 'eval' | 'seal') => void;
  onRecord: () => void;
  onList: (() => void) | null;
  onHistory: () => void;
  onWeft: () => void;
}

export function BarSheet({ acts, keys, onClose }: { acts: BarActs; keys: ComponentChildren; onClose: () => void }) {
  const { live, unit } = acts;
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
          <button class="fab7-button fab7-button--secondary" type="button" aria-label={w('act.ask')} disabled={!live} onClick={then(() => acts.onAct('ask'))}><Label act="act.ask" /></button>
          <button class="fab7-button fab7-button--secondary" type="button" aria-label={w('act.eval')} disabled={!live || !unit} onClick={then(() => acts.onAct('eval'))}><Label act="act.eval" /></button>
          <button class="fab7-button fab7-button--secondary" type="button" aria-label={w('act.seal')} disabled={!live || !unit} onClick={then(() => acts.onAct('seal'))}><Label act="act.seal" /></button>
        </div>
        {unit ? (
          <p class="note">{unit.title}</p>
        ) : (
          <p class="note">{w('why.nothing_to_work_on')}</p>
        )}
        {unit?.eval != null && (
          <button class="fab7-button fab7-button--secondary" type="button" aria-label={w('act.eval_view')} disabled={!live} onClick={then(acts.onRecord)}>[V] {w('act.eval_view').toUpperCase()}</button>
        )}
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
          <button class="bar-word" type="button" disabled={!acts?.live} onClick={() => acts?.onAct('ask')}><Label act="act.ask" /></button>
          <button class="bar-word" type="button" disabled={!acts?.live || !acts.unit} onClick={() => acts?.onAct('eval')}><Label act="act.eval" /></button>
          <button class="bar-word" type="button" disabled={!acts?.live || !acts.unit} onClick={() => acts?.onAct('seal')}><Label act="act.seal" /></button>
          <span class="spacer" />
          <button class="bar-word" type="button" onClick={() => acts?.onWeft()}>{'[W]EFT ⌄'}</button>
        </>
      )}
    </div>
  );
}
