// The tree's bar: Ask, Eval and Seal, following the selection (Ask on an
// agent, Eval on the Open round, Seal on an Eval's). An act that does not
// apply says why in one line; none is ever drawn disabled.
import { effect, signal } from '@preact/signals';
import { useState } from 'preact/hooks';
import type { Machine } from '../api';
import * as m from '../machine';
import { here } from '../nav';
import { clock } from '../bar';
import { asking } from './Ask';
import { act } from './Asked';
import { KeyBar } from './Keys';
import { chosen, evalName, sealName, stateOf, unready, type Chosen } from './Tree';
import { fill, w } from '../words';

/** The pane is active: it has the keys, and a wheel or a finger scrolls its history. */
export const paneActive = signal(false);
/** Where the open agent's keys go, for the desktop bar's Keys. */
export const openKeys = signal<((bytes: number[]) => void) | null>(null);

/** The TUI's notices, one line at the foot of the tree (M10.3): an agent that
 * has ended, in the TUI's words. The next tap clears it. */
export const notice = signal<{ agent: string; text: string } | null>(null);
let running = new Set<string>();
effect(() => {
  const now = m.agents.value;
  for (const a of now) if (!a.running && running.has(a.agent)) notice.value = { agent: a.agent, text: fill('agent.ended', { harness: a.harness }) };
  running = new Set(now.filter((a) => a.running).map((a) => a.agent));
});
addEventListener('pointerdown', () => (notice.value = null), { capture: true });

/** Why an act did not apply, one line above the bar (M10.1, D10.1): the next press clears it. */
export const said = signal<string | null>(null);
addEventListener('pointerdown', () => (said.value = null), { capture: true });

/** A why-not, in the web's words; a harness not set up says where to set it up (M7.1). */
export function sentence(why: m.Why): string {
  const name = m.current.value?.name ?? '';
  const s = fill(why.key, { harness: why.harness ?? '', title: why.title ?? '', machine: name });
  return why.key === 'why.not_set_up' ? `${s} ${fill('web.why.set_up_on', { machine: name })}` : s;
}

/** The agent an Ask goes to first when no agent is selected: the open one, else one of the project's running. */
function fallback(project: string | undefined, harness?: string): string | undefined {
  const view = here();
  const open = view?.name === 'agent' ? m.agents.value.find((a) => a.agent === view.agent && a.running) : undefined;
  const mine = m.agents.value.filter((a) => a.running && (!project || a.project === project));
  return open?.agent ?? (mine.find((a) => a.harness === harness) ?? mine[0])?.agent;
}

/** Ask, on the selection: an agent takes it, or says why it cannot; a round says to select an agent. */
export function askOn(): void {
  const s = chosen();
  if (s?.kind === 'agent') {
    if (s.row.ask) return void (said.value = sentence(s.row.ask));
    if (!s.row.agent) return void (said.value = fill('why.elsewhere', { harness: s.row.harness }));
    asking.value = { agent: s.row.agent, project: s.p.project };
    return;
  }
  if (s && s.kind !== 'ask') return void (said.value = w('select.agent'));
  const project = s?.p.project;
  const agent = fallback(project, s?.kind === 'ask' ? s.ask.harness : undefined);
  if (!agent) return void (said.value = fill('web.why.start_an_agent', { machine: m.current.value?.name ?? '' }));
  // Its harness not set up for RingFrame, nothing it is asked is written down (M7.1).
  const of = m.agents.value.find((a) => a.agent === agent);
  const p = of && m.tree.value.find((x) => x.project === of.project);
  const why = p && unready(p, of.harness);
  if (why) return void (said.value = sentence(why));
  asking.value = { agent, project: project ?? of?.project };
}

/** Eval, on the Open round: on anything else, select Open. */
export async function evalOn(): Promise<void> {
  const s = chosen();
  if (!(s?.kind === 'open' || (s?.kind === 'ask' && !s.round))) return void (said.value = w('select.open'));
  if (s.p.work.open.eval) return void (said.value = sentence(s.p.work.open.eval));
  const refused = await act({ act: 'eval', project: s.p.project });
  if (refused) said.value = String(refused.message);
}

/** Seal, on an Eval's round: on anything else, select an Eval. */
export async function sealOn(): Promise<void> {
  const s = chosen();
  const round = s?.kind === 'eval' ? s.round : s?.kind === 'ask' ? s.round : null;
  if (!s || !round) return void (said.value = w('select.eval'));
  await sealRound(s.p.project, round.eval, round.seal);
}

/** Seal this Eval, unless the machine said why not (it stays drawn, and says so). */
export async function sealRound(project: string, eval_: string, why: m.Why | null): Promise<void> {
  if (why) return void (said.value = sentence(why));
  const refused = await act({ act: 'seal', project, eval: eval_ });
  if (refused) said.value = String(refused.message);
}

/** The selection as the desktop's bar names it: `claude · 11:29`, `fix login · Open round`, `Eval 3`. */
function named(s: Chosen): string {
  switch (s.kind) {
    case 'agent':
      return `${s.row.harness} · ${s.row.state === 'running' ? clock(s.row.at) : s.row.state === 'ended' ? `${w('state.ended')} ${clock(s.row.at)}` : stateOf(s.row)}`;
    case 'open':
      return w('web.bar.open_round');
    case 'eval':
      return evalName(s.round.n);
    case 'ask':
      return `${s.ask.title} · ${s.round ? evalName(s.round.n) : w('web.bar.open_round')}`;
    case 'seal':
      return sealName(s.seal.n);
  }
}

/** The tree's bar (M11.1, D11.1): Ask, Eval and Seal follow the selection; where one does not apply, why. */
export function TreeBar({ machine, wide }: { machine: Machine; wide: boolean }) {
  const [keys, setKeys] = useState(false);
  // In the active pane the bar is the agent's, as the TUI's is (D3.3): a press
  // on it keeps the pane's focus.
  const inPane = wide && paneActive.value && openKeys.value;
  if (!inPane && keys) setKeys(false);
  // A notice about the agent open beside the tree is said in its own view (D3.7).
  const view = here();
  const told = notice.value && !(view?.name === 'agent' && view.agent === notice.value.agent) ? notice.value.text : null;
  const s = wide ? chosen() : null;
  return (
    <div class={wide ? 'tree-bar tree-bar--wide' : 'tree-bar'}>
      {said.value ? <p class="tree-said" role="status">{said.value}</p> : told && <p class="tree-said" role="status">{told}</p>}
      {inPane && keys && (
        <div class="keys-pop" onPointerDown={(e) => e.preventDefault()}>
          <span class="label">{w('web.act.keys').toUpperCase()}</span>
          <KeyBar send={(b) => openKeys.value?.(b)} />
        </div>
      )}
      <div class="tree-acts" onPointerDown={(e) => inPane && e.preventDefault()}>
        <button class="tree-act" type="button" onClick={askOn}>{w('act.ask')}</button>
        {inPane ? (
          <button class="tree-act" type="button" aria-pressed={keys} onClick={() => setKeys(!keys)}>{w('web.act.keys')}</button>
        ) : (
          <>
            <button class="tree-act" type="button" onClick={() => void evalOn()}>{w('act.eval')}</button>
            <button class="tree-act" type="button" onClick={() => void sealOn()}>{w('act.seal')}</button>
          </>
        )}
        {s && (
          <>
            <span class="spacer" />
            <span class="tree-selected">{fill('web.bar.selected', { what: named(s) })}</span>
          </>
        )}
      </div>
    </div>
  );
}
