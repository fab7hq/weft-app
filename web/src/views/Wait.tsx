// Every wait says so: where the person acted, a breathing dot and what is
// being done; past a few seconds a moving bar and the time so far. Once the
// machine says how its job goes, its steps, the count under way and a bar
// filled by how much is done, when it can tell. What is
// still coming breathes where it will be. A failure is said in amber where
// the work was shown, until the person acts again.
import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import * as m from '../machine';
import { go, here } from '../nav';
import * as J from '../jobs';
import type { StepLine } from '../jobs';
import { acted, elapsed, ended, failed, isLong, mine, openingJob, refused, saving, working } from '../waits';
import { fill, w } from '../words';
import { workName } from './Seal';

// A press on a control is the person acting: a failure said before has been read.
addEventListener('pointerdown', (e) => {
  if (failed.value && (e.target as Element | null)?.closest?.('button, select, input, textarea, a, [role="treeitem"], [role="button"]')) acted();
}, { capture: true });

/** The time now, a second at a time, while `on`. */
export function useNow(on: boolean): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!on) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [on]);
  return now;
}

/** A breathing dot. */
export const Dot = () => <span class="wait-dot" aria-hidden="true" />;

/** A moving bar: working, how long unknown. */
export const Moving = () => <span class="wait-bar" aria-hidden="true"><i /></span>;

/** The bar: filled by how much is done when the machine can tell, else moving. */
export function Bar({ share, small = false }: { share: number | null; small?: boolean }) {
  if (share === null) return <Moving />;
  return (
    <span class={small ? 'wait-bar wait-bar--fill wait-bar--small' : 'wait-bar wait-bar--fill'} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(share * 100)}>
      <b style={{ width: `${(share * 100).toFixed(1)}%` }} />
    </span>
  );
}

/** Each step's mark: done ✓, under way the breathing dot, to come ○. */
function Mark({ state }: { state: StepLine['state'] }) {
  if (state === 'now') return <span class="wait-step-mark"><Dot /></span>;
  return <span class="wait-step-mark" aria-hidden="true">{state === 'done' ? '✓' : state === 'failed' ? '✕' : state === 'skipped' ? '–' : '○'}</span>;
}

/** A wait's steps: done ones muted with their time, the one under way with
 * its count and its time so far, those to come faint. */
export function Steps({ lines }: { lines: StepLine[] }) {
  return (
    <div class="wait-steps" role="list">
      {lines.map((l, i) => (
        <div key={i} class={`wait-step wait-step--${l.state}`} role="listitem" data-state={l.state}>
          <Mark state={l.state} />
          <div class="wait-step-body">
            <span class="wait-step-words">{l.words}</span>
            {l.count && (
              <span class="wait-step-count">
                <span class="mono">{l.count}</span>
                {l.fresh && <span class="wait-step-fresh">{` · ${l.fresh}`}</span>}
              </span>
            )}
            <span class="spacer" />
            {l.time && <span class="wait-step-time">{l.time}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

/** What is being done, as one line: the dot, its words, what it is on and,
 * past a few seconds, the time so far; the moving bar under it then. With the
 * machine's job for it, its time and bar at once, the bar filled by how much
 * is done, and its steps. */
export function WorkingLine({ words, about, since, job = null, children }: { words: string; about?: string; since: number; job?: J.Held | null; children?: ComponentChildren }) {
  const now = useNow(true);
  const long = !!job || isLong(since, now);
  return (
    <div class="wait-working" role="status">
      <div class="wait-head">
        <Dot />
        <b class="wait-words">{words}</b>
        {about && <span class="wait-about">{about}</span>}
        <span class="spacer" />
        {long && <span class="wait-time">{elapsed(now - Math.min(since, job?.since ?? since))}</span>}
      </div>
      {long && <Bar share={J.filled(job)} />}
      {job && job.steps.length > 0 && <Steps lines={J.lines(job, now)} />}
      {children}
    </div>
  );
}

/** A short wait beside what it is about: the dot and its words. */
export const Asking = ({ words }: { words: string }) => (
  <span class="wait-inline" role="status"><Dot />{words}</span>
);

/** The bar after a yes: the act working, in the bar's place, until the machine answers. */
export function WorkingBar() {
  const now = working.value;
  if (!now) return null;
  return (
    <div class="pending-bar working-bar" role="dialog" aria-label={now.words}>
      <WorkingLine words={now.words} about={now.about} since={now.since} job={J.byReq(now.req)} />
    </div>
  );
}

/** The Eval this device opened, or the one of the work open here, while RingFrame opens it. */
export function OpeningBar() {
  const o = mine.value;
  const view = here();
  const machine = m.current.value;
  // The work whose Details are open, while its Eval opens.
  const at = !o && view?.name === 'work' ? { project: view.project, unit: view.unit } : null;
  const job = o ? openingJob(o.project, o.unit) : at ? openingJob(at.project, at.unit) : null;
  const there = at && job ? m.tree.value.find((p) => p.project === at.project)?.work.units.find((u) => u.unit === at.unit) ?? null : null;
  // The work open here stopped opening: its Eval view opens, as when this device opened it.
  const was = useRef<{ project: string; unit: string } | null>(null);
  useEffect(() => {
    const before = was.current;
    was.current = there && at ? at : null;
    if (before && !was.current && !mine.value && machine && refused.value !== before.unit) {
      const v = here();
      if (v?.name === 'work' && v.unit === before.unit) void openView(machine.id, before.project, before.unit);
    }
  });
  // This device's own, ended while its answer was lost: its view opens if its Eval runs.
  useEffect(() => {
    const e = ended.value;
    if (!e || !machine) return;
    ended.value = null;
    void openView(machine.id, e.project, e.unit);
  }, [ended.value]);
  // Since this device first saw it opening, when the machine has not said.
  const seen = useRef<{ key: string; at: number } | null>(null);
  const shownFor = o ? `${o.project}/${o.unit}` : there && at ? `${at.project}/${at.unit}` : null;
  if (shownFor && seen.current?.key !== shownFor) seen.current = { key: shownFor, at: Date.now() };
  // On a phone an agent's own view keeps its message row: you can keep working.
  if (view?.name === 'agent' && !matchMedia('(min-width: 768px)').matches) return null;
  if (!o && !there) return null;
  const about = o ? fill('wait.opening_eval_about', { title: o.title, asks: asksOf(o.asks), harness: o.harness }) : workName(there!.title, there!.asks);
  const since = o?.since ?? job?.since ?? seen.current?.at ?? Date.now();
  return (
    <div class="pending-bar opening-bar" role="dialog" aria-label={w('wait.opening_eval')}>
      <WorkingLine words={w('wait.opening_eval')} about={about} since={since} job={job}>
        {!(job && job.steps.length > 0) && <p class="pending-why">{w('wait.opening_eval_line')}</p>}
      </WorkingLine>
    </div>
  );
}

/** How many Asks, as the block names them. */
const asksOf = (n: number) => (n === 1 ? w('unit.one_ask') : fill('unit.asks', { n: String(n) }));

/** Open the Eval view of a work's latest Eval, once RingFrame has opened it. */
export async function openView(machine: string, project: string, unit: string): Promise<void> {
  const answer = await m.request({ type: 'read', what: 'work', project, unit });
  if (answer?.type !== 'ok') return;
  const steps = ((answer.work as { steps?: { step: string; eval?: string }[] } | undefined)?.steps ?? []).filter((s) => s.step === 'eval');
  const last = steps.at(-1)?.eval;
  if (last) go({ name: 'eval', machine, project, eval: last });
}

/** Breathing lines where content will be, never "none yet". */
export function Coming({ lines = [85, 95, 60] }: { lines?: number[] }) {
  return (
    <div class="wait-coming" aria-busy="true">
      {lines.map((at, i) => <span key={i} class="wait-line" style={{ width: `${at}%` }} />)}
    </div>
  );
}

/** A read that failed: why, in amber, where its content would be, and Try again. */
export function ReadFailed({ text, again }: { text: string; again: () => void }) {
  return (
    <div class="wait-failed" role="alert">
      <span class="wait-failed-text">{text}</span>
      <button class="tree-act wait-again" type="button" onClick={again}>{w('wait.try_again')}</button>
    </div>
  );
}

/** A settings page's one line: Saving… while a setting goes, else what the machine would not take, else empty. */
export function Saving() {
  // It floats over the page, so nothing under the person's finger moves as a save comes and goes.
  if (saving.value > 0) return <p class="settings-saving"><Asking words={w('wait.saving')} /></p>;
  return failed.value ? <p class="settings-saving ask-hint" role="alert">{failed.value}</p> : null;
}

/** The last failure, one amber line where the act was, until the person acts again. */
export function FailedLine() {
  return failed.value ? <p class="tree-said" role="alert">{failed.value}</p> : null;
}
