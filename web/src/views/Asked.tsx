// What the machine is about to type, shown once an act staged it, wherever the
// person is: the bar (M4.5–M4.10, D4.5–D4.10), Cancel beside Send. Answered on
// the machine first, it says so and closes.
import { signal } from '@preact/signals';
import { useEffect, useState } from 'preact/hooks';
import * as m from '../machine';
import { why } from '../bar';
import { fill, w } from '../words';

/** The pending this device asked for and shows. */
export const shown = signal<string | null>(null);

/** An act; the pending it staged is shown when the machine answers. Its error, if any. */
export async function act(message: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  const answer = await m.request({ type: 'act', ...message });
  if (answer?.type === 'ok' && answer.pending) shown.value = String(answer.pending);
  return answer?.type === 'error' ? answer : null;
}

export function PendingBar() {
  const id = shown.value;
  const pending = m.pendings.value.find((p) => p.id === id) ?? null;
  const [kept, setKept] = useState<m.Pending | null>(null);
  const [answered, setAnswered] = useState(false);
  if (pending && pending !== kept) setKept(pending);
  useEffect(() => {
    const r = m.resolved.value;
    if (!r || r.id !== id || answered) return;
    setAnswered(true);
    const t = setTimeout(() => {
      shown.value = null;
      setAnswered(false);
    }, 2500);
    return () => clearTimeout(t);
  }, [m.resolved.value, id]);
  const showing = pending ?? (kept?.id === id ? kept : null);
  if (!id || !showing) return null;
  const answer = (yes: boolean) => {
    void m.request({ type: 'resolve', pending: id, yes });
    shown.value = null;
  };
  const harness = m.agents.value.find((a) => a.agent === showing.agent)?.harness ?? '';
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
      {answered ? (
        <p class="note" role="status">Answered on the machine</p>
      ) : (
        <div class="pending-acts">
          <span class="spacer" />
          <button class="tree-act" type="button" onClick={() => answer(false)}>{w('act.cancel')}</button>
          <button class="tree-act tree-act--go" type="button" onClick={() => answer(true)}>{w('act.send')}</button>
        </div>
      )}
    </div>
  );
}
