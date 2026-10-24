// A Seal's one dialog: the work it seals, the disposition (accepted unless
// another is picked) and, for the others, an optional reason. Seal records
// it; nothing is typed into an agent. Cancel, Esc or a press outside closes it.
import { signal } from '@preact/signals';
import { useLayoutEffect, useState } from 'preact/hooks';
import { DISPOSITIONS, reasonsFor, sealMessage, type Disposition } from '../seal';
import { w } from '../words';
import { act } from './Asked';
import { said } from './Bar';

/** The Seal being decided: the work or the Eval it seals, and the work's title. */
export const sealing = signal<{ project: string; unit?: string; eval?: string; title: string } | null>(null);

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
  const { title, ...where } = on;
  const seal = async () => {
    close();
    const refused = await act(sealMessage(where, disposition, reason));
    if (refused) said.value = String(refused.message);
  };
  const pick = (d: Disposition) => {
    setDisposition(d);
    setReason(null);
  };
  return (
    <div class="sure-backdrop" onClick={(e) => e.target === e.currentTarget && close()}>
      <div class="sure" role="dialog" aria-modal="true" aria-label={w('dialog.seal.title')}>
        <h2 class="sure-title">{w('dialog.seal.title')}</h2>
        <p class="sure-what">{title}</p>
        <div class="sure-chips" role="radiogroup">
          {DISPOSITIONS.map((d) => (
            <button key={d} type="button" class="sure-chip" role="radio" aria-checked={d === disposition} onClick={() => pick(d)}>{w(`seal.d.${d}`)}</button>
          ))}
        </div>
        {reasonsFor(disposition).length > 0 && (
          <>
            <p class="sure-what">{w('dialog.seal.why')}</p>
            <div class="sure-chips" role="radiogroup">
              {reasonsFor(disposition).map((r) => (
                <button key={r} type="button" class="sure-chip" role="radio" aria-checked={r === reason} onClick={() => setReason(r === reason ? null : r)}>{w(`seal.r.${r}`)}</button>
              ))}
            </div>
          </>
        )}
        <div class="sure-acts">
          <button type="button" class="sure-act" onClick={close}>{w('act.cancel')}</button>
          <button type="button" class="sure-act sure-act--go" onClick={() => void seal()}>{w('act.seal')}</button>
        </div>
      </div>
    </div>
  );
}
