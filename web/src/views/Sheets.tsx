// The two sheets (web-app.md §7): what Weft will type, exactly, before it
// types it; and the Eval record.
import type * as m from '../machine';
import { evalState, w } from '../words';

export function ConfirmSheet({ pending, answered, onAnswer }: { pending: m.Pending; answered: boolean; onAnswer: (yes: boolean) => void }) {
  return (
    <div class="sheet-backdrop">
      <div class="fab7-sheet" role="dialog" aria-label={pending.what}>
        <h2 class="fab7-sheet__title">{pending.what}</h2>
        <p class="fab7-sheet__why">{pending.why}</p>
        <pre class="fab7-sheet__text">{pending.text}</pre>
        {answered ? (
          <p class="note" role="status">Answered on the machine</p>
        ) : (
          <div class="fab7-sheet__actions">
            <button class="fab7-button fab7-button--secondary" type="button" onClick={() => onAnswer(false)}>No</button>
            <button class="fab7-button" type="button" onClick={() => onAnswer(true)}>Yes, type it</button>
          </div>
        )}
      </div>
    </div>
  );
}

interface Reading {
  role: string;
  vote: string;
  reason: string;
}
interface Step {
  id: string;
  text: string;
  state: string | { read: string };
  readings: Reading[];
}
export interface EvalRecord {
  eval_id: string;
  closed: boolean;
  verdict: string | null;
  confidence: number | null;
  groups: { key: string; title: string; steps: Step[] }[];
}


export function RecordSheet({ record, title, onSeal, onAskAgain, onClose }: { record: EvalRecord; title: string; onSeal: () => void; onAskAgain: () => void; onClose: () => void }) {
  const steps = record.groups.flatMap((g) => g.steps);
  const met = steps.filter((s) => s.state === 'met').length;
  return (
    <div class="sheet-backdrop">
      <div class="fab7-sheet" role="dialog" aria-label="Eval record" style={{ maxHeight: '86%', overflow: 'auto' }}>
        <span class="label" style={{ color: 'var(--fab7-accent)' }}>Eval record · {title}</span>
        <h2 class="fab7-sheet__title">
          {met} of {steps.length} met{record.confidence !== null ? ` · judges agree ${Math.round(record.confidence * 100)}%` : ''}
        </h2>
        <p class="fab7-sheet__why">Agreement is the judges agreeing, not a measure of being right.{record.closed ? '' : ' The Eval is still running.'}</p>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {steps.map((s) => (
            <li key={s.id} style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingBottom: '14px', borderBottom: '1px solid var(--fab7-line)' }}>
              <span style={{ fontSize: '14px', fontWeight: 600, color: s.state === 'not_met' ? 'var(--fab7-amber-text)' : undefined }}>
                {evalState(s.state)} · {s.text}
              </span>
              {s.readings.map((r) => (
                <span key={r.role} style={{ fontSize: '13px', lineHeight: 1.6, color: 'var(--fab7-muted)' }}>{r.reason}</span>
              ))}
            </li>
          ))}
        </ul>
        <div class="fab7-sheet__actions">
          <button class="fab7-button fab7-button--secondary" type="button" onClick={onAskAgain}>Ask again</button>
          <button class="fab7-button" type="button" onClick={onSeal}>{w('act.seal')}</button>
        </div>
        <button class="back" type="button" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
