import { useEffect, useState } from 'preact/hooks';
import * as api from '../api';
import * as m from '../machine';
import { back, reset } from '../nav';
import * as push from '../push';
import * as store from '../store';

export function Settings({ login }: { login: string }) {
  const machine = m.current.value;
  const [name, setName] = useState('');
  const [pushes, setPushes] = useState(false);
  const [said, setSaid] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  useEffect(() => {
    void store.device().then((d) => setName(d.name));
    if (machine) void store.get<store.Kept>('macs', machine.id).then((k) => setPushes(Boolean(k?.push)));
  }, [machine?.id]);

  const toggle = async () => {
    if (!machine) return;
    setSaid(null);
    if (pushes) {
      await push.turnOff(machine.id);
      setPushes(false);
      return;
    }
    const why = await push.turnOn(machine.id);
    if (why === 'home_screen') setSaid('home_screen');
    else if (why) setSaid(why);
    else setPushes(true);
  };
  const leave = async (how: 'out' | 'everywhere' | 'forget' | 'delete') => {
    if (how === 'forget') {
      await store.clear('macs');
      await store.clear('devices');
      return;
    }
    if (how === 'delete') await api.deleteAccount();
    else await api.signOut(how === 'everywhere');
    m.close();
    location.assign('/');
  };

  return (
    <div class="app">
      <div class="appbar">
        <button class="back" type="button" onClick={back}>‹ Back</button>
        <span class="spacer" />
        <h1>Settings</h1>
        <span class="spacer" />
      </div>
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
        <div class="fab7-group">This device</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '8px 16px 16px', borderBottom: '1px solid var(--fab7-line)' }}>
          <label for="device-name" style={{ fontSize: '13px', color: 'var(--fab7-muted)' }}>Name, as your machines show it</label>
          <input
            id="device-name"
            value={name}
            onInput={(e) => setName((e.target as HTMLInputElement).value)}
            onBlur={() => void store.device().then((d) => store.set('devices', 'this', { ...d, name: name.trim() || d.name }))}
            class="field"
          />
        </div>
        {machine && (
          <label for="pushes" style={{ display: 'flex', alignItems: 'center', gap: '12px', minHeight: '64px', padding: '0 16px', borderBottom: '1px solid var(--fab7-line)' }}>
            <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontSize: '15px' }}>Notifications from {machine.name}</span>
              <span style={{ fontSize: '12px', color: 'var(--fab7-muted)' }}>When an agent needs you and you are away from your machine</span>
            </span>
            <input id="pushes" type="checkbox" checked={pushes} onChange={() => void toggle()} style={{ width: '22px', height: '22px', accentColor: '#58a6ff' }} />
          </label>
        )}
        {said === 'home_screen' ? (
          <div role="status" style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <strong style={{ fontSize: '15px' }}>Add Weft to your Home Screen first</strong>
            <span class="note">On iPhone and iPad a notification comes only to the app on the Home Screen: tap Share, then Add to Home Screen, then open Weft from there and turn notifications on.</span>
          </div>
        ) : (
          said && <p class="note" role="status" style={{ padding: '12px 16px' }}>{said}</p>
        )}
        <div class="fab7-group">Account · {login}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '8px 16px' }}>
          <button class="fab7-button fab7-button--secondary" type="button" onClick={() => void leave('out')}>Sign out</button>
          <button class="fab7-button fab7-button--secondary" type="button" onClick={() => void leave('everywhere')}>Sign out everywhere</button>
          <button class="fab7-button fab7-button--secondary" type="button" onClick={() => void leave('forget')}>Forget this device</button>
          {deleting ? (
            <button class="fab7-button fab7-button--secondary" type="button" style={{ color: 'var(--fab7-amber-text)' }} onClick={() => void leave('delete')}>
              Delete my account and its machines
            </button>
          ) : (
            <button class="fab7-button fab7-button--secondary" type="button" onClick={() => setDeleting(true)}>Delete my account</button>
          )}
        </div>
        <p class="note" style={{ margin: 'auto 16px 24px' }}>
          Signing out keeps this device allowed on your machines; remove it there with W → R. <a href="/privacy">Privacy</a>
        </p>
      </div>
    </div>
  );
}
