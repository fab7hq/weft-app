// The tree's bar: Ask, Eval and Seal, following the selection (Ask on an
// agent, Eval and Seal on a unit of work). An act that does not
// apply says why in one line; none is ever drawn disabled.
import { effect, signal } from '@preact/signals';
import type { Machine } from '../api';
import * as m from '../machine';
import { here } from '../nav';
import { clock } from '../bar';
import { asking } from './Ask';
import { act, acting } from './Asked';
import { chosen, stateOf, unready, type Chosen } from './Tree';
import { fill, w } from '../words';

/** The pane is active: it has the keys, and a wheel or a finger scrolls its history. */
export const paneActive = signal(false);
/** Where the open agent's keys go, for the desktop bar's Keys. */
export const openKeys = signal<((bytes: number[]) => void) | null>(null);

/** The desktop app's notices, one line at the foot of the tree (M10.3): an agent that
 * has ended, in the desktop app's words. The next tap clears it. */
export const notice = signal<{ agent: string; text: string } | null>(null);
let running = new Set<string>();
effect(() => {
  const now = m.agents.value;
  for (const a of now) if (!a.running && running.has(a.agent)) notice.value = { agent: a.agent, text: fill('agent.ended', { harness: a.harness }) };
  running = new Set(now.filter((a) => a.running).map((a) => a.agent));
});
addEventListener('pointerdown', () => (notice.value = null), { capture: true });

/** Why an act did not apply, one line above the bar (M10.1, D10.1): the next press clears it,
 *  and so does time, so a line about how things were never stays. */
export const said = signal<string | null>(null);
addEventListener('pointerdown', () => (said.value = null), { capture: true });
const SAID_FOR = 6000;
let saying: ReturnType<typeof setTimeout> | undefined;
effect(() => {
  const now = said.value;
  clearTimeout(saying);
  if (now) saying = setTimeout(() => said.value === now && (said.value = null), SAID_FOR);
});

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

/** Ask, on the selection: an agent takes it, or says why it cannot; on a unit of work, an agent of its harness. */
export function askOn(): void {
  const s = chosen();
  if (s?.kind === 'agent') {
    if (s.row.ask) return void (said.value = sentence(s.row.ask));
    if (!s.row.agent) return void (said.value = fill('why.elsewhere', { harness: s.row.harness }));
    asking.value = { agent: s.row.agent, project: s.p.project };
    return;
  }
  const project = s?.p.project;
  const agent = fallback(project, s?.row.harness);
  if (!agent) return void (said.value = fill('web.why.start_an_agent', { machine: m.current.value?.name ?? '' }));
  // Its harness not set up for RingFrame, nothing it is asked is written down (M7.1).
  const of = m.agents.value.find((a) => a.agent === agent);
  const p = of && m.tree.value.find((x) => x.project === of.project);
  const why = p && unready(p, of.harness);
  if (why) return void (said.value = sentence(why));
  asking.value = { agent, project: project ?? of?.project };
}

/** Eval, on a unit of work: on anything else, select one. */
export async function evalOn(): Promise<void> {
  const s = chosen();
  if (s?.kind !== 'work') return void (said.value = w('select.work_eval'));
  await evalWork(s.p.project, s.row.unit, s.row.eval);
}

/** Seal, on a unit of work: on anything else, select one. */
export async function sealOn(): Promise<void> {
  const s = chosen();
  if (s?.kind !== 'work') return void (said.value = w('select.work_seal'));
  await sealWork(s.p.project, s.row.unit, s.row.seal);
}

/** Eval this unit of work, unless the machine said why not. */
export async function evalWork(project: string, unit: string, why: m.Why | null): Promise<void> {
  if (why) return void (said.value = sentence(why));
  const refused = await act({ act: 'eval', project, unit });
  if (refused) said.value = String(refused.message);
}

/** Seal this unit of work, unless the machine said why not. */
export async function sealWork(project: string, unit: string, why: m.Why | null): Promise<void> {
  if (why) return void (said.value = sentence(why));
  const refused = await act({ act: 'seal', project, unit });
  if (refused) said.value = String(refused.message);
}

/** Seal this Eval, unless the machine said why not (it stays drawn, and says so). */
export async function sealRound(project: string, eval_: string, why: m.Why | null): Promise<void> {
  if (why) return void (said.value = sentence(why));
  const refused = await act({ act: 'seal', project, eval: eval_ });
  if (refused) said.value = String(refused.message);
}

/** The selection as the desktop's bar names it: `claude · 11:29`, `health endpoint`. */
function named(s: Chosen): string {
  switch (s.kind) {
    case 'agent':
      return `${s.row.harness} · ${s.row.state === 'running' ? clock(s.row.at) : s.row.state === 'ended' ? `${w('state.ended')} ${clock(s.row.at)}` : stateOf(s.row)}`;
    case 'work':
      return s.row.title;
  }
}

/** The tree's bar (M11.1, D11.1): Ask, Eval and Seal follow the selection; where one does not apply, why. */
export function TreeBar({ machine, wide }: { machine: Machine; wide: boolean }) {
  // A press on the bar keeps the active pane's focus.
  const inPane = wide && paneActive.value && openKeys.value;
  // A notice about the agent open beside the tree is said in its own view (D3.7).
  const view = here();
  const told = notice.value && !(view?.name === 'agent' && view.agent === notice.value.agent) ? notice.value.text : null;
  const s = wide ? chosen() : null;
  // The act the selected agent, else the one open, has put forward: outlined, never pressed.
  const picked = chosen();
  const whose = picked?.kind === 'agent' ? picked.row.agent : view?.name === 'agent' ? view.agent : null;
  const next = m.agents.value.find((a) => a.agent === whose)?.next;
  const put = (act: 'eval' | 'seal') => (next === act ? ` tree-act--put-${act}` : '');
  return (
    <div class={wide ? 'tree-bar tree-bar--wide' : 'tree-bar'}>
      {said.value ? <p class="tree-said" role="status">{said.value}</p> : told && <p class="tree-said" role="status">{told}</p>}
      <div class="tree-acts" onPointerDown={(e) => inPane && e.preventDefault()}>
        <button class="tree-act" type="button" onClick={askOn}>{w('act.ask')}</button>
        <button class={`tree-act${put('eval')}`} type="button" aria-busy={acting.value === 'eval' || undefined} onClick={() => void evalOn()}>{w('act.eval')}</button>
        <button class={`tree-act${put('seal')}`} type="button" aria-busy={acting.value === 'seal' || undefined} onClick={() => void sealOn()}>{w('act.seal')}</button>
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
