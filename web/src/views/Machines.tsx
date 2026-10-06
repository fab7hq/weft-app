// Your machines (M1.6, D1.6): open one, or remove one from the account; on a
// desktop with Remove, on a phone by swiping the row left, then Proceed in the
// confirmation over the page. Weft on the machine is not touched: it joins again with W → R.
import { useRef, useState } from 'preact/hooks';
import * as api from '../api';
import { Confirm } from './Confirm';
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
                <button type="button" class="machine-remove" onClick={() => setSure(m)}>
                  {w('web.machines.remove')}
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>
      {sure && (
        <Confirm
          question={fill('web.machines.remove_sure', { machine: sure.name })}
          what={fill('web.machines.remove_what', { machine: sure.name })}
          cost="warn"
          onProceed={() => void remove(sure)}
          onClose={() => setSure(null)}
        />
      )}
    </div>
  );
}

