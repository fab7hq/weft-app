// Add a machine (M1.5, D1.5): how to put one on the account, and the page
// moves on by itself once one joins.
import { useEffect } from 'preact/hooks';
import * as api from '../api';
import { fill, w } from '../words';
import { MachinesBar } from './Machines';

export function AddMachine({ login, wide, onJoined }: { login: string; wide: boolean; onJoined: () => void }) {
  // Asked every few seconds, so the machine shows as soon as it joins.
  useEffect(() => {
    const t = setInterval(() => {
      void api.machines().then((list) => list.length > 0 && onJoined(), () => {});
    }, 3000);
    return () => clearInterval(t);
  }, [onJoined]);
  const steps: [string, string][] = [
    ['W', w('web.add.menu')],
    ['R', w('web.add.remote')],
    ['⏎', w('web.add.code')],
  ];
  return (
    <div class="app">
      <MachinesBar wide={wide} />
      <div class="page">
        <p class="label" style={{ margin: 0 }}>{fill('web.add.signed_in', { login })}</p>
        <h2>{w('web.add.title')}</h2>
        <p class="lede">{w('web.add.none')}</p>
        <ol class="add-steps">
          {steps.map(([key, text]) => (
            <li key={key} class="add-step">
              <span class="add-key" aria-hidden="true">{key}</span>
              <span>{text}</span>
            </li>
          ))}
        </ol>
        <p class="note">{w('web.add.joins')}</p>
      </div>
    </div>
  );
}
