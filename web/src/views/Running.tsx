// A running Eval as a picture (17.6): a ring that fills as the checking comes
// in, each stage lighting up in turn, and the judges as live cards that open
// their pane. Stop Eval asks the machine's one Stop dialog.
import type { Machine } from '../api';
import { judgesOf } from '../judges';
import * as m from '../machine';
import { go } from '../nav';
import { type Light, type Progress, RADIUS, ring } from '../progress';
import { fill, w } from '../words';
import { act } from './Asked';

/** A stage's node: done is a filled check, under way pulses, next is hollow, tests spin. */
function Node({ light }: { light: Light }) {
  return (
    <svg class={`running-node running-node--${light}`} width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
      {light === 'done' && <><circle cx="11" cy="11" r="11" class="node-fill" /><path d="M6 11.5l3.2 3.2L16 8" class="node-check" /></>}
      {light === 'now' && <><circle cx="11" cy="11" r="9" class="node-ping" /><circle cx="11" cy="11" r="9" class="node-ring" /><circle cx="11" cy="11" r="4" class="node-dot" /></>}
      {light === 'next' && <circle cx="11" cy="11" r="9" class="node-idle" />}
      {light === 'running' && <><circle cx="11" cy="11" r="9" class="node-idle" /><circle cx="11" cy="11" r="9" class="node-spin" stroke-dasharray="14 57" /></>}
    </svg>
  );
}

export function Running({ machine, project, eval: id, title, progress, wide }: { machine: Machine; project: string; eval: string; title: string; progress: Progress; wide: boolean }) {
  const judges = judgesOf(m.judges.value, id);
  const box = RADIUS * 2 + 20;
  const c = box / 2;
  return (
    <div class={wide ? 'running running--wide' : 'running'}>
      <div class="running-head">
        <strong>{w('eval_view.checking')}</strong>
        <span class="dim">{title}{judges.length > 0 && ` · ${fill('eval_view.reading', { n: String(judges.length) })}`}</span>
      </div>
      <div class="running-picture">
        <div class="running-ring" role="img" aria-label={`${progress.percent}% ${w('eval_view.checked')}`}>
          <svg width={box} height={box} viewBox={`0 0 ${box} ${box}`}>
            <circle cx={c} cy={c} r={RADIUS} class="running-track" />
            <circle cx={c} cy={c} r={RADIUS} class="running-fill" stroke-dasharray={ring(progress.percent)} transform={`rotate(-90 ${c} ${c})`} />
            <g class="running-arc" style={{ transformOrigin: `${c}px ${c}px` }}>
              <circle cx={c} cy={c} r={RADIUS} class="running-sweep" stroke-dasharray={`18 ${Math.round(2 * Math.PI * RADIUS)}`} />
            </g>
          </svg>
          <div class="running-percent"><b>{`${progress.percent}%`}</b><span class="dim">{w('eval_view.checked')}</span></div>
        </div>
        <ol class="running-stages">
          {progress.stages.map((s) => (
            <li key={s.name} class={`running-stage running-stage--${s.light}`}>
              <Node light={s.light} />
              <span class="running-name">{s.name}</span>
              <span class="running-note">{s.note}</span>
            </li>
          ))}
        </ol>
      </div>
      {judges.length > 0 && (
        <>
          <span class="eval-label running-label">{`${w('eval_view.judges')} · ${w('eval_view.watch')}`}</span>
          <div class="running-judges">
            {judges.map((j) => (
              <button key={j.agent} class="running-judge" type="button" onClick={() => go({ name: 'agent', machine: machine.id, agent: j.agent })}>
                <b>{j.harness}</b>
                <span class="running-beat"><i>●</i><i>●</i><i>●</i> {w(`turn.${j.turn}`)}</span>
              </button>
            ))}
          </div>
        </>
      )}
      <button class="tree-act tree-act--warn running-stop" type="button" onClick={() => void act({ act: 'stop', project, eval: id })}>{w('dialog.stop_eval.go')}</button>
    </div>
  );
}
