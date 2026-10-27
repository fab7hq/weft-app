// A Seal's one dialog (17.4, 17.5), in the bar's place: the work it seals and
// its verdict, the decision (accepted unless another is picked) and, for the
// others, an optional reason. Seal records it; nothing is typed into an agent.
import { signal } from '@preact/signals';
import { useLayoutEffect, useState } from 'preact/hooks';
import type * as m from '../machine';
import { DISPOSITIONS, reasonsFor, sealMessage, type Disposition } from '../seal';
import { fill, w } from '../words';
import { act } from './Asked';
import { said } from './Bar';
import { Verdict } from './Tree';

/** The Seal being decided: the work or the Eval it seals, and what the dialog says of it. */
export const sealing = signal<{
  project: string; unit?: string; eval?: string;
  title: string; asks: number; verdict: m.Verdict | null; agreement: number | null;
} | null>(null);

/** The work as the dialogs name it: `health endpoint · 2 Asks`. */
export const workName = (title: string, asks: number) =>
  asks === 1 ? fill('dialog.eval.work_one', { title }) : fill('dialog.eval.work', { title, n: String(asks) });

export function SealDialog() {
  const on = sealing.value;
  const [disposition, setDisposition] = useState<Disposition>('accepted');
  const [reason, setReason] = useState<string | null>(null);
  const close = () => {
    sealing.value = null;
    setDisposition('accepted');
    setReason(null);
  };
  useLayoutEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && close();
    addEventListener('keydown', esc);
    return () => removeEventListener('keydown', esc);
  }, []);
  if (!on) return null;
  const { project, unit, eval: eval_ } = on;
  const seal = async () => {
    close();
    const refused = await act(sealMessage({ project, ...(unit ? { unit } : {}), ...(eval_ ? { eval: eval_ } : {}) }, disposition, reason));
    if (refused) said.value = String(refused.message);
  };
  const pick = (d: Disposition) => {
    setDisposition(d);
    setReason(null);
  };
  const work = workName(on.title, on.asks);
  const records = fill(reason ? 'dialog.seal.records_why' : 'dialog.seal.records', { disposition: w(`seal.d.${disposition}`), work });
  return (
    <div class="pending-bar seal-bar" role="dialog" aria-label={w('dialog.seal.title')}>
      <div class="pending-head">
        <span class="pending-what">{w('dialog.seal.title')}</span>
        <span class="pending-into">{work}</span>
      </div>
      {on.verdict && (
        <div class="seal-kv">
          <span class="ask-eyebrow">{w('dialog.seal.verdict')}</span>
          <span><Verdict verdict={on.verdict} />{on.agreement !== null && ` ${on.agreement.toFixed(2)}`}</span>
        </div>
      )}
      <div class="seal-kv">
        <span class="ask-eyebrow">{w('dialog.seal.decision')}</span>
        <div class="sure-chips" role="radiogroup">
          {DISPOSITIONS.map((d) => (
            <button key={d} type="button" class="sure-chip" role="radio" aria-checked={d === disposition} onClick={() => pick(d)}>{w(`seal.d.${d}`)}</button>
          ))}
        </div>
      </div>
      {reasonsFor(disposition).length > 0 && (
        <div class="seal-kv">
          <span class="ask-eyebrow">{w('dialog.seal.why')}<span class="seal-optional seal-optional--inline">{` · ${w('dialog.seal.optional')}`}</span></span>
          <div class="sure-chips" role="radiogroup">
            {reasonsFor(disposition).map((r) => (
              <button key={r} type="button" class="sure-chip" role="radio" aria-checked={r === reason} onClick={() => setReason(r === reason ? null : r)}>{w(`seal.r.${r}`)}</button>
            ))}
          </div>
          <span class="seal-optional seal-optional--after">{w('dialog.seal.optional')}</span>
        </div>
      )}
      <div class="pending-acts">
        <span class="pending-why seal-records">{records}</span>
        <button type="button" class="tree-act" onClick={close}>{w('act.cancel')}</button>
        <button type="button" class="tree-act tree-act--go" onClick={() => void seal()}>{w('act.seal')}</button>
      </div>
    </div>
  );
}
