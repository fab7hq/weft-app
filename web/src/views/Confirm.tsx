// The confirmation over the page that every act that leaves asks first with
// (M1.6, D1.6, M9.4–M9.6, D9.4): the question, what it does, Cancel and
// Proceed, coloured by what it costs. Cancel, Esc or a press outside closes it.
import { useLayoutEffect } from 'preact/hooks';
import { w } from '../words';

export type Cost = 'go' | 'warn' | 'danger';

export function Confirm({ question, what, cost, onProceed, onClose }: { question: string; what: string; cost: Cost; onProceed: () => void; onClose: () => void }) {
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
        <div class="sure-acts">
          <button type="button" class="sure-act" onClick={onClose}>{w('act.cancel')}</button>
          <button type="button" class={`sure-act sure-act--${cost}`} onClick={onProceed}>{w('act.proceed')}</button>
        </div>
      </div>
    </div>
  );
}
