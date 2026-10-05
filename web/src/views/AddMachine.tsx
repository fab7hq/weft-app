// Add a machine (M1.5, D1.5): how to put one on the account, and the page
// moves on by itself once one joins.
import { useEffect } from 'preact/hooks';
import * as api from '../api';
import { go } from '../nav';
import { fill, w } from '../words';

export function AddMachine({ login, onJoined }: { login: string; onJoined: () => void }) {
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
      <div class="appbar">
        <h1>{w('web.machines.title')}</h1>
        <span class="spacer" />
        <button class="back" type="button" onClick={() => go({ name: 'settings' })}>{w('web.settings.title')}</button>
      </div>
      <div class="page">
        <p class="label" style={{ margin: 0 }}>{fill('web.add.signed_in', { login })}</p>
        <h2>{w('web.add.title')}</h2>
        <p class="lede">{w('web.add.none')}</p>
        <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {steps.map(([key, text]) => (
            <li key={key} style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
              <span class="fab7-key" style={{ minWidth: '36px', height: '36px', cursor: 'default' }} aria-hidden="true">{key}</span>
              <span style={{ paddingTop: '7px', fontSize: '15px', lineHeight: 1.6 }}>{text}</span>
            </li>
          ))}
        </ol>
        <p class="note" style={{ marginTop: 'auto' }}>{w('web.add.joins')}</p>
      </div>
    </div>
  );
}
