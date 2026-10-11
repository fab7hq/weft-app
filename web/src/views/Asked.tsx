// The confirmation bar (M4.5–M4.14, D4.5–D4.14), wherever the person is:
// what the machine is about to type, Cancel beside Send; Send anyway when its
// agent has not said it is ready; Resume a session by its id, after an act no
// agent runs for, or Start an agent when there is none to resume. Answered on the machine first, it says so and
// closes. On a phone Cancel and the go are halves of the width; on a desktop
// they sit at the right.
import { signal } from '@preact/signals';
import { useEffect, useState } from 'preact/hooks';
import * as m from '../machine';
import { go } from '../nav';
import { clock, why } from '../bar';
import { notice } from './Bar';
import { fill, w } from '../words';

/** The pending this device asked for and shows. */
export const shown = signal<string | null>(null);

/** A session to resume by its id, after a confirm: after an act
 * the machine refused because no agent runs where it goes (`not_running`,
 * which names the session, or none). */
interface Gone {
  project: string;
  harness: string;
  session: m.Session | null;
  /** The machine's own sentence, when it named no session. */
  said?: string;
  /** The act, sent again once the agent is back. */
  again: Record<string, unknown>;
}
const gone = signal<Gone | null>(null);

/** Start a session again by its id in a new pane, then send `again`, or else
 * go to its agent: at once from its Details (M11.5), after the confirm here. */
export async function resume(project: string, harness: string, session: string, again: Record<string, unknown> | null = null) {
  const machine = m.current.value;
  const started = await m.request({ type: 'start', project, harness, resume: session });
  // A pane holds it already: go there.
  const agent = started?.type === 'ok' ? started.agent : started?.code === 'running' ? started.agent : null;
  if (started?.type === 'error' && !agent) return void (notice.value = { agent: '', text: String(started.message) });
  if (again) void act(again);
  else if (machine && agent) go({ name: 'agent', machine: machine.id, agent: String(agent) });
}

/** The project a work is in, as the tree shows it. */
const projectOf = (unit: unknown) =>
  m.tree.value.find((p) => p.work.open.asks.some((a) => a.unit === unit) || p.work.evals.some((r) => r.asks.some((a) => a.unit === unit)))?.project ?? '';

/** An act; the pending it staged is shown when the machine answers. Its error, if any. */
export async function act(message: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  const answer = await m.request({ type: 'act', ...message });
  if (answer?.type === 'ok' && answer.pending) shown.value = String(answer.pending);
  if (answer?.type === 'error' && answer.code === 'not_running') {
    const project = typeof message.project === 'string' ? message.project : projectOf(message.unit);
    gone.value = { project, harness: String(answer.harness), session: (answer.session as m.Session | null) ?? null, said: String(answer.message), again: message };
    return null;
  }
  return answer?.type === 'error' ? answer : null;
}

/** A session id as the cards shorten it: `3f9c2b71…a21e`. */
export const shortId = (id: string) => (id.length > 14 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id);

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
        <div class="pending-head">
          <span class="pending-what">{w('not_ready.title')}</span>
        </div>
        <p class="pending-why">{unready}</p>
        <p class="pending-why">{w('not_ready.why')}</p>
        <Acts cancel={() => void answer(false)} go={[w('act.send_anyway'), () => void answer(true, true)]} />
      </div>
    );
  }
  const harness = m.agents.value.find((a) => a.agent === showing.agent)?.harness ?? '';
  if (answered) {
    return (
      <div class="pending-bar pending-bar--answered" role="dialog" aria-label={showing.what}>
        <span class="pending-what">{showing.what}</span>
        <p class="pending-answered" role="status">{w('web.bar.answered')}</p>
      </div>
    );
  }
  return (
    <div class="pending-bar" role="dialog" aria-label={showing.what}>
      <div class="pending-head">
        <span class="pending-what">{showing.what}</span>
        <span class="pending-into">{fill('web.bar.into', { harness })}</span>
      </div>
      {why(showing.why).map((s) => (
        <p key={s} class="pending-why">{s}</p>
      ))}
      <pre class="pending-text">{showing.text}</pre>
      <Acts cancel={() => void answer(false)} go={[w('act.send'), () => void answer(true)]} />
    </div>
  );
}

/** Resume a session by its id (M4.12, M11.5): what Weft will start, then Resume; with no session to resume, Start an agent. */
function GoneBar({ gone: g }: { gone: Gone }) {
  const close = () => (gone.value = null);
  const machine = m.current.value;
  const s = g.session;
  const back = () => {
    close();
    if (s) void resume(g.project, g.harness, s.session, g.again);
  };
  const fresh = () => {
    close();
    if (machine) go({ name: 'start', machine: machine.id, from: g.project, harness: g.harness });
  };
  const title = s ? fill('web.resume.ask', { harness: g.harness, session: shortId(s.session) }) : g.said ?? '';
  return (
    <div class="pending-bar" role="dialog" aria-label={title}>
      <div class="pending-head">
        <span class="pending-what">{title}</span>
      </div>
      {s ? (
        <>
          <p class="pending-why">{s.state === 'quiet' ? fill('resume.quiet', { time: clock(s.at) }) : fill('resume.how', { harness: g.harness })}</p>
          <p class="pending-why">{w('resume.either_way')}</p>
          <Acts cancel={close} go={[w('act.resume'), back]} />
        </>
      ) : (
        <>
          <p class="pending-why">{w('resume.either_way')}</p>
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
