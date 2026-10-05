// What the machine is about to type, shown once an act staged it, wherever the
// person is; answered on the machine first, it says so and closes.
import { signal } from '@preact/signals';
import { useEffect, useState } from 'preact/hooks';
import * as m from '../machine';
import { ConfirmSheet } from './Sheets';

/** The pending this device asked for and shows. */
export const shown = signal<string | null>(null);

/** An act; the pending it staged is shown when the machine answers. Its error, if any. */
export async function act(message: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  const answer = await m.request({ type: 'act', ...message });
  if (answer?.type === 'ok' && answer.pending) shown.value = String(answer.pending);
  return answer?.type === 'error' ? answer : null;
}

export function PendingSheet() {
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
  return <ConfirmSheet pending={showing} answered={answered} onAnswer={answer} />;
}
