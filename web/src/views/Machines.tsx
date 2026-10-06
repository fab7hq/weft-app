// Your machines (M1.6, D1.6): open one, or remove one from the account; on a
// desktop with Remove and a confirmation over the page, on a phone by swiping
// the row left. Weft on the machine is not touched: it joins again with W → R.
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import * as api from '../api';
import { go } from '../nav';
import { fill, w } from '../words';

export function Machines({ list, wide, onRemoved }: { list: api.Machine[]; wide: boolean; onRemoved: (id: string) => void }) {
  // The row whose Remove shows, and the machine the confirmation asks about.
  const [shown, setShown] = useState<string | null>(null);
  const [sure, setSure] = useState<api.Machine | null>(null);
  const from = useRef<number | null>(null);
  const remove = async (m: api.Machine) => {
    setSure(null);
    await api.removeMachine(m.id);
    onRemoved(m.id);
  };
  return (
    <div class="app">
      <div class="appbar">
        <h1>{w('web.machines.title')}</h1>
        <span class="spacer" />
        <button class="back" type="button" onClick={() => go({ name: 'settings' })}>{w('web.settings.title')}</button>
      </div>
      <div class="page">
        <ul aria-label={w('web.machines.title')} class="machines">
          {list.map((m) => (
            <li
              key={m.id}
              class={shown === m.id ? 'machine machine--swiped' : 'machine'}
              onTouchStart={(e) => (from.current = e.touches[0].clientX)}
              onTouchEnd={(e) => {
                if (from.current === null) return;
                const dx = e.changedTouches[0].clientX - from.current;
                if (dx < -40) setShown(m.id);
                else if (dx > 40) setShown(null);
                from.current = null;
              }}
            >
              <button type="button" class="fab7-row machine-open" onClick={() => go({ name: 'tree', machine: m.id })}>
                <span class="fab7-row__title">{m.name}</span>
                <span class="fab7-row__meta">{w(m.address ? 'web.machines.tunnel' : 'web.machines.no_address')}</span>
              </button>
              {(wide || shown === m.id) && (
                <button type="button" class="machine-remove" onClick={() => (wide ? setSure(m) : void remove(m))}>
                  {w('web.machines.remove')}
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>
      {sure && <Sure machine={sure} onRemove={() => void remove(sure)} onClose={() => setSure(null)} />}
    </div>
  );
}

/** D1.6: Remove {machine} from your account? Cancel, Esc or a click outside closes it. */
function Sure({ machine, onRemove, onClose }: { machine: api.Machine; onRemove: () => void; onClose: () => void }) {
  // At commit, not after paint, so an Esc pressed as it shows still closes it.
  useLayoutEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', esc);
    return () => removeEventListener('keydown', esc);
  }, [onClose]);
  const question = fill('web.machines.remove_sure', { machine: machine.name });
  return (
    <div class="sure-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class="sure" role="dialog" aria-modal="true" aria-label={question}>
        <h2 class="sure-title">{question}</h2>
        <p class="sure-what">{fill('web.machines.remove_what', { machine: machine.name })}</p>
        <div class="sure-acts">
          <button type="button" class="machine-remove" onClick={onClose}>{w('act.cancel')}</button>
          <button type="button" class="machine-remove machine-remove--sure" onClick={onRemove}>{w('web.machines.remove')}</button>
        </div>
      </div>
    </div>
  );
}
