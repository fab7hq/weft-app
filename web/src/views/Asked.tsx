// The confirmation bar (M4.5–M4.14, D4.5–D4.14), wherever the person is:
// what the machine is about to type, Cancel beside Send; Send anyway when its
// agent has not said it is ready; Resume, or Start an agent, when the work's
// agent is not running. Answered on the machine first, it says so and closes.
import { signal } from '@preact/signals';
import { useEffect, useState } from 'preact/hooks';
import * as m from '../machine';
import { go } from '../nav';
import { clip, clock, why } from '../bar';
import { fill, w } from '../words';

/** The pending this device asked for and shows. */
export const shown = signal<string | null>(null);

/** An act the machine refused because no agent of the work's harness runs. */
interface Gone {
  harness: string;
  project: string;
  session: { at: number; last: string } | null;
  /** The act, sent again once the agent is back. */
  again: Record<string, unknown>;
}
const gone = signal<Gone | null>(null);

/** The project a work is in. */
const projectOf = (unit: unknown) => m.tree.value.find((p) => p.harnesses.some((h) => h.works.some((x) => x.unit === unit)))?.project ?? '';

/** An act; the pending it staged is shown when the machine answers. Its error, if any. */
export async function act(message: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  const answer = await m.request({ type: 'act', ...message });
  if (answer?.type === 'ok' && answer.pending) shown.value = String(answer.pending);
  if (answer?.type === 'error' && answer.code === 'not_running') {
    const session = (answer.session as Gone['session']) ?? null;
    gone.value = { harness: String(answer.harness), project: projectOf(message.unit), session, again: message };
    return null;
  }
  return answer?.type === 'error' ? answer : null;
}

export function PendingBar() {
  return gone.value ? <GoneBar gone={gone.value} /> : <SendBar />;
}

function SendBar() {
  const id = shown.value;
  const pending = m.pendings.value.find((p) => p.id === id) ?? null;
  const [kept, setKept] = useState<m.Pending | null>(null);
  const [answered, setAnswered] = useState(false);
  const [unready, setUnready] = useState<string | null>(null);
  if (pending && pending !== kept) setKept(pending);
  // Answered on the machine first: say so, then go. The timer hangs on
  // `answered` alone, so a later message cannot cancel it.
  const r = m.resolved.value;
  if (r && r.id === id && !answered) setAnswered(true);
  useEffect(() => {
    if (!answered) return;
    const t = setTimeout(() => {
      shown.value = null;
      setAnswered(false);
    }, 2500);
    return () => clearTimeout(t);
  }, [answered]);
  const showing = pending ?? (kept?.id === id ? kept : null);
  if (!id || !showing) return null;
  const answer = async (yes: boolean, force = false) => {
    const said = await m.request({ type: 'resolve', pending: id, yes, ...(force ? { force } : {}) });
    // Weft types on its own only into an agent that has said it is ready.
    if (said?.type === 'error' && said.code === 'not_ready') return setUnready(String(said.message));
    setUnready(null);
    shown.value = null;
  };
  if (unready && !answered) {
    return (
      <div class="pending-bar" role="dialog" aria-label={w('not_ready.title')}>
        <span class="pending-what">{w('not_ready.title')}</span>
        <p class="pending-why">{unready}</p>
        <p class="pending-why">{w('not_ready.why')}</p>
        <Acts cancel={() => void answer(false)} go={[w('act.send_anyway'), () => void answer(true, true)]} />
      </div>
    );
  }
  const harness = m.agents.value.find((a) => a.agent === showing.agent)?.harness ?? '';
  return (
    <div class="pending-bar" role="dialog" aria-label={showing.what}>
      <div class="pending-head">
        <span class="pending-what">{showing.what}</span>
        {!answered && <span class="pending-into">{fill('web.bar.into', { harness })}</span>}
      </div>
      {answered ? (
        <p class="note" role="status">{w('web.bar.answered')}</p>
      ) : (
        <>
          {why(showing.why).map((s) => (
            <p key={s} class="pending-why">{s}</p>
          ))}
          <pre class="pending-text">{showing.text}</pre>
          <Acts cancel={() => void answer(false)} go={[w('act.send'), () => void answer(true)]} />
        </>
      )}
    </div>
  );
}

/** The work's agent is not running: resume its session, then the act; or start a fresh one. */
function GoneBar({ gone: g }: { gone: Gone }) {
  const close = () => (gone.value = null);
  const resume = async () => {
    close();
    const started = await m.request({ type: 'start', project: g.project, harness: g.harness, unit: g.again.unit });
    if (started?.type === 'ok') void act(g.again);
  };
  const fresh = () => {
    close();
    const machine = m.current.value;
    if (machine) go({ name: 'start', machine: machine.id, from: g.project, harness: g.harness });
  };
  return (
    <div class="pending-bar" role="dialog" aria-label={fill('resume.title', { harness: g.harness })}>
      <span class="pending-what">{fill('resume.title', { harness: g.harness })}</span>
      {g.session ? (
        <>
          <p class="pending-why">{`${w('resume.session')} · ${clock(g.session.at)} · "${clip(g.session.last, 28)}"`}</p>
          <p class="pending-why">{w('resume.either_way')}</p>
          <Acts cancel={close} go={[w('act.resume'), () => void resume()]} />
        </>
      ) : (
        <>
          <p class="pending-why">{w('resume.nothing')}</p>
          <Acts cancel={close} go={[w('start.title'), fresh]} />
        </>
      )}
    </div>
  );
}

function Acts({ cancel, go: [label, onGo] }: { cancel: () => void; go: [string, () => void] }) {
  return (
    <div class="pending-acts">
      <span class="spacer" />
      <button class="tree-act" type="button" onClick={cancel}>{w('act.cancel')}</button>
      <button class="tree-act tree-act--go" type="button" onClick={onGo}>{label}</button>
    </div>
  );
}
