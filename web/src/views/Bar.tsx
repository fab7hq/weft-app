// The bars: the tree's (Ask, Eval and Seal on the selected work) and, on a
// phone, the agent's sheet behind ⌃ (Ask and the keys).
import type { ComponentChildren } from 'preact';
import { signal } from '@preact/signals';
import { useEffect, useState } from 'preact/hooks';
import type { Machine } from '../api';
import * as m from '../machine';
import { go, here } from '../nav';
import { asking } from './Ask';
import { act } from './Asked';
import { KeyBar } from './Keys';
import { selected, selectedHarness, unready } from './Tree';
import { fill, w } from '../words';

export interface BarActs {
  /** The agent's harness, which the sheet is about. */
  harness: string;
  onAsk: () => void;
}

/** ⌃ (M3.11): Ask into this agent, and the keys. Eval and Seal are the tree's. */
export function BarSheet({ acts, keys, onClose }: { acts: BarActs; keys: ComponentChildren; onClose: () => void }) {
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
    <div class="sheet-backdrop bar-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class="fab7-sheet bar-sheet" role="dialog" aria-label="Weft">
        <span class="sheet-label">{acts.harness.toUpperCase()}</span>
        <button class="tree-act" type="button" onClick={then(acts.onAsk)}>{w('act.ask')}</button>
        <span class="sheet-label">{w('web.act.keys').toUpperCase()}</span>
        {keys}
      </div>
    </div>
  );
}

/** The pane is active: it has the keys, and a wheel or a finger scrolls its history. */
export const paneActive = signal(false);
/** Where the open agent's keys go, for the desktop bar's Keys. */
export const openKeys = signal<((bytes: number[]) => void) | null>(null);

/** A why-not, in the web's words. */
const sentence = (why: m.Why, machine: Machine) => fill(why.key, { harness: why.harness ?? '', title: why.title ?? '', machine: machine.name });

/** The selected work, with the harness it was asked of. */
function selection() {
  for (const p of m.tree.value) for (const h of p.harnesses) for (const work of h.works) if (work.unit === selected.value) return { p, h, work };
  return null;
}

/** The selected harness (M2.5, M7.1), with its project. */
function harnessSelection() {
  for (const p of m.tree.value) for (const h of p.harnesses) if (`${p.project}/${h.harness}` === selectedHarness.value) return { p, h };
  return null;
}

/** A harness not set up (M7.1): what it is, and where to set it up. */
const notReady = (why: m.Why, machine: Machine) => `${sentence(why, machine)} ${fill('web.why.set_up_on', { machine: machine.name })}`;

/** The tree's bar (M2.6, D2.6): Ask, and Eval and Seal on the selected work; where one cannot run, why. */
export function TreeBar({ machine, wide }: { machine: Machine; wide: boolean }) {
  const [said, setSaid] = useState<string | null>(null);
  const [keys, setKeys] = useState(false);
  // In the active pane the bar is the agent's, as the TUI's is (D3.3): a press
  // on it keeps the pane's focus.
  const inPane = wide && paneActive.value && openKeys.value;
  if (!inPane && keys) setKeys(false);
  const onWork = async (which: 'eval' | 'seal') => {
    setSaid(null);
    const at = selection();
    if (!at) {
      const on = harnessSelection();
      const why = on && unready(on.p, on.h.harness);
      return setSaid(why ? notReady(why, machine) : w('why.nothing_to_work_on'));
    }
    if (at.work[which]) return setSaid(sentence(at.work[which]!, machine));
    const refused = await act({ act: which, unit: at.work.unit });
    if (refused) setSaid(String(refused.message));
  };
  /** Ask, of the selected work's project: its agent first, else the open one, else the first running. */
  const onAsk = () => {
    setSaid(null);
    const at = selection() ?? harnessSelection();
    const view = here();
    const open = view?.name === 'agent' ? m.agents.value.find((a) => a.agent === view.agent && a.running) : undefined;
    const first = m.agents.value.find((a) => a.running);
    const agent = at?.h.agent ?? open?.agent ?? first?.agent;
    if (!agent) return setSaid(fill('web.why.start_an_agent', { machine: machine.name }));
    // Its harness not set up for RingFrame, nothing it is asked is written down (M7.1).
    const of = m.agents.value.find((a) => a.agent === agent);
    const project = of && m.tree.value.find((p) => p.project === of.project);
    const why = project && unready(project, of.harness);
    if (why) return setSaid(notReady(why, machine));
    asking.value = { agent, project: m.agents.value.find((a) => a.agent === agent)?.project };
  };
  return (
    <div class={wide ? 'tree-bar tree-bar--wide' : 'tree-bar'}>
      {said && <p class="tree-said" role="status">{said}</p>}
      {inPane && keys && (
        <div class="keys-pop" onPointerDown={(e) => e.preventDefault()}>
          <span class="label">{w('web.act.keys').toUpperCase()}</span>
          <KeyBar send={(b) => openKeys.value?.(b)} />
        </div>
      )}
      <div class="tree-acts" onPointerDown={(e) => inPane && e.preventDefault()}>
        <button class="tree-act" type="button" onClick={onAsk}>{w('act.ask')}</button>
        {inPane ? (
          <button class="tree-act" type="button" aria-pressed={keys} onClick={() => setKeys(!keys)}>{w('web.act.keys')}</button>
        ) : (
          <>
            <button class="tree-act" type="button" onClick={() => void onWork('eval')}>{w('act.eval')}</button>
            <button class="tree-act" type="button" onClick={() => void onWork('seal')}>{w('act.seal')}</button>
          </>
        )}
      </div>
    </div>
  );
}
