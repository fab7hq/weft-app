// The bars: the tree's (Ask, Eval and Seal on the selected work) and, on a
// phone, the agent's sheet behind ⌃ (Ask and the keys).
import type { ComponentChildren } from 'preact';
import { signal } from '@preact/signals';
import { useEffect, useState } from 'preact/hooks';
import type { Machine } from '../api';
import * as m from '../machine';
import { go } from '../nav';
import { act } from './Asked';
import { selected } from './Tree';
import { fill, w } from '../words';

/** A bar label the way the TUI writes it: the key in brackets, the rest in capitals. */
export function Label({ act }: { act: string }) {
  const upper = w(act).toUpperCase();
  return <>{`[${upper[0]}]${upper.slice(1)}`}</>;
}

export interface BarActs {
  live: boolean;
  onAsk: () => void;
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

/** The pane has the keys: everything typed goes to the agent. */
export const paneHasKeys = signal(false);
/** Ask, from the tree's bar: the agent opened next puts the person in its message box. */
export const askHere = signal(false);

/** A why-not, in the web's words. */
const sentence = (why: m.Why, machine: Machine) => fill(why.key, { harness: why.harness ?? '', title: why.title ?? '', machine: machine.name });

/** The selected work, with the harness it was asked of. */
function selection() {
  for (const p of m.tree.value) for (const h of p.harnesses) for (const work of h.works) if (work.unit === selected.value) return { h, work };
  return null;
}

/** The tree's bar (M2.6, D2.6): Ask, and Eval and Seal on the selected work; where one cannot run, why. */
export function TreeBar({ machine, wide }: { machine: Machine; wide: boolean }) {
  const [said, setSaid] = useState<string | null>(null);
  const onWork = async (which: 'eval' | 'seal') => {
    setSaid(null);
    const at = selection();
    if (!at) return setSaid(w('why.nothing_to_work_on'));
    if (at.work[which]) return setSaid(sentence(at.work[which]!, machine));
    const refused = await act({ act: which, unit: at.work.unit });
    if (refused) setSaid(String(refused.message));
  };
  const onAsk = () => {
    setSaid(null);
    const running = m.tree.value.flatMap((p) => p.harnesses).filter((h) => h.agent);
    const agent = selection()?.h.agent ?? running[0]?.agent;
    if (!agent) return setSaid(fill('web.why.start_an_agent', { machine: machine.name }));
    askHere.value = true;
    go({ name: 'agent', machine: machine.id, agent });
  };
  return (
    <div class={wide ? 'tree-bar tree-bar--wide' : 'tree-bar'}>
      {said && <p class="tree-said" role="status">{said}</p>}
      <div class="tree-acts">
        <button class="tree-act" type="button" onClick={onAsk}>{w('act.ask')}</button>
        <button class="tree-act" type="button" onClick={() => void onWork('eval')}>{w('act.eval')}</button>
        <button class="tree-act" type="button" onClick={() => void onWork('seal')}>{w('act.seal')}</button>
        {wide && (
          <>
            <span class="spacer" />
            <button class="tree-act" type="button" onClick={() => go({ name: 'settings' })}>Weft ⌄</button>
          </>
        )}
      </div>
    </div>
  );
}
