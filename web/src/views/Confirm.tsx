// The confirmation over the page that every act that leaves asks first with
// (M1.6, D1.6, M9.4–M9.6, D9.4): the question, what it does, Cancel and
// Proceed, coloured by what it costs. Cancel, Esc or a press outside closes it.
import { useLayoutEffect, useState } from 'preact/hooks';
import { w } from '../words';

export type Cost = 'go' | 'warn' | 'danger';

/** What a Proceed that could not reach Weft's service says. */
const UNREACHED = 'No connection: Weft needs the network for this. Try again when you are back online.';

/** Proceed works until what it does has answered, the dialog staying; a
 * failure is said in it, in amber, until the person acts again. */
export function Confirm({ question, what, cost, onProceed, onClose }: { question: string; what: string; cost: Cost; onProceed: () => void | Promise<void>; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const proceed = async () => {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    try {
      await onProceed();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };
  // At commit, not after paint, so an Esc pressed as it shows still closes it.
  useLayoutEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', esc);
    return () => removeEventListener('keydown', esc);
  }, [onClose]);
  return (
    <div class="sure-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class="sure" role="dialog" aria-modal="true" aria-label={question}>
        <h2 class="sure-title">{question}</h2>
        <p class="sure-what">{what}</p>
        {failed && <p class="sure-what ask-hint" role="alert">{UNREACHED}</p>}
        <div class="sure-acts">
          <button type="button" class="sure-act" onClick={onClose}>{w('act.cancel')}</button>
          <button type="button" class={`sure-act sure-act--${cost}`} aria-busy={busy || undefined} onClick={() => void proceed()}>{w('act.proceed')}</button>
        </div>
      </div>
    </div>
  );
}
