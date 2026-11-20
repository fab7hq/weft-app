// A running Eval as a picture (17.6, 6.7): one ring with an arc per read, the
// one being read breathing, its steps in quiet text, then each judge reading
// with a link to watch its pane, and each check still running. Stop Eval, at
// the view's foot, asks the machine's one Stop dialog.
import type { Machine } from '../api';
import { judgesOf } from '../judges';
import * as m from '../machine';
import { go } from '../nav';
import * as J from '../jobs';
import { type Progress, RING, arcs } from '../progress';
import { elapsed } from '../waits';
import { fill, w } from '../words';
import { act, acting } from './Asked';
import { Steps, useNow } from './Wait';

/** The ring: 150 px, or 110 px beside the steps once the list has come (6.7). */
function Ring({ progress, small }: { progress: Progress; small: boolean }) {
  const size = small ? 110 : RING.box;
  const c = RING.box / 2;
  return (
    <div class={small ? 'ev-ring ev-ring--small' : 'ev-ring'} style={{ width: `${size}px`, height: `${size}px` }} role="img" aria-label={`${progress.label} ${progress.note}`}>
      <svg width={size} height={size} viewBox={`0 0 ${RING.box} ${RING.box}`} aria-hidden="true">
        <g transform={`rotate(-87 ${c} ${c})`}>
          {arcs(progress.arcs).map((a, i) => (
            <circle key={i} cx={c} cy={c} r={RING.r} fill="none" stroke={`var(--fab7-${a.stroke})`} stroke-width={small ? 9 : 8}
              stroke-dasharray={RING.dash} stroke-dashoffset={a.offset} class={a.breathes ? 'ev-arc ev-breathe' : 'ev-arc'} data-light={progress.arcs[i]} />
          ))}
        </g>
      </svg>
      <div class="ev-ring-in">
        <span class={small ? 'ev-ring-label ev-ring-label--small' : 'ev-ring-label'}>{progress.label}</span>
        {!small && <span class="faint">{progress.note}</span>}
      </div>
    </div>
  );
}

/** Its steps in quiet text: done ✓ with its time, the one under way with its
 * count and time so far from the readers' job, those to come faint. */
function EvalSteps({ project, eval: id, progress }: { project: string; eval: string; progress: Progress }) {
  const now = useNow(true);
  const job = J.byOn(project, { eval: id }, ['readers']);
  return <Steps lines={J.evalLines(progress.steps, job, now)} />;
}

/** Who is reading and for how long, a link to watch each, then each check still running: faint. */
export function Reading({ machine, eval: id, progress }: { machine: Machine; eval: string; progress: Progress }) {
  const judges = judgesOf(m.judges.value, id);
  const now = useNow(judges.length > 0);
  if (judges.length === 0 && progress.tests.length === 0) return null;
  return (
    <div class="ev-reading">
      {judges.map((j) => (
        <button key={j.agent} class="ev-watch" type="button" onClick={() => go({ name: 'agent', machine: machine.id, agent: j.agent })}>
          {fill('wait.reading', { harness: j.harness })}
          {j.since > 0 && <>{' · '}<span class="mono">{elapsed(now - j.since)}</span></>}
          {` · ${w('eval_view.watch')}`}
        </button>
      ))}
      {progress.tests.map((t) => <span key={t}>{t}</span>)}
    </div>
  );
}

/**
 * The picture: on a desktop the ring beside its steps; on a phone the ring
 * over its steps while nothing is read yet, and a smaller ring beside them
 * once the list has come, who is reading then going under the list.
 */
export function Running({ machine, project, eval: id, progress, wide, small = false }: { machine: Machine; project: string; eval: string; progress: Progress; wide: boolean; small?: boolean }) {
  const compact = !wide && small;
  return (
    <div class={wide ? 'ev-run ev-run--wide' : compact ? 'ev-run ev-run--small' : 'ev-run'}>
      <Ring progress={progress} small={compact} />
      <div class="ev-steps">
        <EvalSteps project={project} eval={id} progress={progress} />
        {!compact && <Reading machine={machine} eval={id} progress={progress} />}
      </div>
    </div>
  );
}

/** Stop Eval, at the foot of the view: a plain button that asks the machine's one Stop dialog (17.10). */
export function StopEval({ project, eval: id }: { project: string; eval: string }) {
  return <button class="tree-act ev-stop" type="button" aria-busy={acting.value === 'stop' || undefined} onClick={() => void act({ act: 'stop', project, eval: id })}>{w('dialog.stop_eval.go')}</button>;
}
