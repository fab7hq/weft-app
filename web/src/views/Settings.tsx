// Settings (M9.1, D9.2) and the desktop's menu (D9.1), which share their rows:
// Start an agent, this device, its notifications, the machines, the account.
import { useEffect, useState } from 'preact/hooks';
import * as api from '../api';
import { Confirm, type Cost } from './Confirm';
import * as m from '../machine';
import { back, go, reset } from '../nav';
import { fill, w } from '../words';
import * as push from '../push';
import * as store from '../store';

/** Start an agent on the open machine (M9.7). */
export function StartRow({ then, sub = true }: { then?: () => void; sub?: boolean }) {
  const machine = m.current.value;
  if (!machine) return null;
  const start = () => {
    then?.();
    go({ name: 'start', machine: machine.id, from: w('web.settings.title') });
  };
  return (
    <button class="settings-row" type="button" onClick={start} aria-label={w('start.title')}>
      <span class="settings-text">
        <span>{w('start.title')}</span>
        {sub && <span class="settings-sub">{fill('web.start.runs_on', { machine: machine.name })}</span>}
      </span>
      <span class="eval-more">›</span>
    </button>
  );
}

/** This device's name, as the machines show it. */
function useName(): [string, (s: string) => void, () => void] {
  const [name, setName] = useState('');
  useEffect(() => void store.device().then((d) => setName(d.name)), []);
  const keep = () => void store.device().then((d) => store.set('devices', 'this', { ...d, name: name.trim() || d.name }));
  return [name, setName, keep];
}

/** Notifications from the open machine, and why not when they cannot be. */
export function Notifications({ sub = true }: { sub?: boolean }) {
  const machine = m.current.value;
  const [on, setOn] = useState(false);
  const [said, setSaid] = useState<string | null>(null);
  useEffect(() => {
    if (machine) void store.get<store.Kept>('macs', machine.id).then((k) => setOn(Boolean(k?.push)));
  }, [machine?.id]);
  if (!machine) return null;
  const toggle = async () => {
    setSaid(null);
    if (on) {
      await push.turnOff(machine.id);
      return setOn(false);
    }
    const why = await push.turnOn(machine.id);
    if (why) setSaid(why);
    else setOn(true);
  };
  return (
    <>
      <label for="pushes" class="settings-row">
        <span class="settings-text">
          <span>{fill('web.settings.notifications', { machine: machine.name })}</span>
          {sub && <span class="settings-sub">{w('web.settings.notifications_when')}</span>}
        </span>
        <input id="pushes" type="checkbox" checked={on} onChange={() => void toggle()} class="settings-toggle" />
      </label>
      {said === 'web.push.home_screen' ? (
        <div role="status" class="settings-said">
          <strong>{w('web.push.home_screen')}</strong>
          <span class="note">{w('web.push.home_screen_how')}</span>
        </div>
      ) : (
        said && <p class="note settings-said" role="status">{w(said)}</p>
      )}
    </>
  );
}

/** The account's machines: the open one says so; a tap opens one's tree. */
export function MachineRows({ then }: { then?: () => void }) {
  const open = m.current.value;
  return (
    <>
      {m.mine.value.map((x) => (
        <button key={x.id} class="settings-row" type="button" onClick={() => (then?.(), reset({ name: 'tree', machine: x.id }))}>
          <span class="settings-text">{x.name}</span>
          <span class="settings-sub">{x.id === open?.id && m.link.value === 'connected' ? w('web.settings.connected') : ''}</span>
          <span class="eval-more">›</span>
        </button>
      ))}
    </>
  );
}

type Leave = 'out' | 'everywhere' | 'forget' | 'delete';

/** What each way of leaving asks first, and what it costs. */
const ASKS: Record<Leave, [ask: string, what: string, cost: Cost]> = {
  out: ['web.settings.sign_out_ask', 'web.settings.sign_out_what', 'go'],
  everywhere: ['web.settings.everywhere_ask', 'web.settings.everywhere_what', 'go'],
  forget: ['web.settings.forget_ask', 'web.settings.forget_what', 'warn'],
  delete: ['web.settings.delete_ask', 'web.settings.delete_what', 'danger'],
};

/** The confirmation for one way of leaving; Proceed leaves. */
function Leaving({ how, login, onClose }: { how: Leave; login: string; onClose: () => void }) {
  const [ask, what, cost] = ASKS[how];
  return <Confirm question={w(ask)} what={fill(what, { login })} cost={cost} onProceed={() => void leave(how)} onClose={onClose} />;
}

/** Leave: sign out here or everywhere, forget this device, delete the account. */
async function leave(how: Leave) {
  if (how === 'forget') {
    // This browser drops its name, its tokens and its notifications; the
    // next time it opens a machine, the machine asks again.
    m.send({ type: 'push', subscription: null });
    await (await navigator.serviceWorker?.getRegistration())?.pushManager.getSubscription().then((s) => s?.unsubscribe());
    await store.clear('macs');
    await store.clear('devices');
    m.close();
    return location.assign('/');
  }
  if (how === 'delete') await api.deleteAccount();
  else await api.signOut(how === 'everywhere');
  m.close();
  location.assign('/');
}

/** D9.1: what ☰ opens on a desktop, dropping down from it. A click outside closes it. */
export function Menu({ onClose, onSignOut }: { onClose: () => void; onSignOut: () => void }) {
  const [name] = useName();
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', esc);
    return () => removeEventListener('keydown', esc);
  }, [onClose]);
  return (
    <div class="menu-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class="menu-pop" role="menu" aria-label="Weft">
        <StartRow then={onClose} sub={false} />
        <div class="fab7-group">{w('web.settings.this_device')}</div>
        <div class="settings-row settings-row--read">{name}</div>
        <Notifications sub={false} />
        <div class="fab7-group">{w('web.settings.machines')}</div>
        <MachineRows then={onClose} />
        <button class="settings-row" type="button" onClick={() => (onClose(), go({ name: 'settings' }))}>{w('web.menu.settings')}</button>
        <button class="settings-row" type="button" onClick={() => (onClose(), onSignOut())}>{w('web.settings.sign_out')}</button>
      </div>
    </div>
  );
}

/** ☰ at the top right of a desktop's tree: it opens the menu (D9.1). */
export function MenuButton({ login }: { login: string }) {
  const [open, setOpen] = useState(false);
  const [out, setOut] = useState(false);
  return (
    <>
      <button class="menu" type="button" aria-label="Menu" aria-expanded={open} onClick={() => setOpen(!open)}>☰</button>
      {open && <Menu onClose={() => setOpen(false)} onSignOut={() => setOut(true)} />}
      {out && <Leaving how="out" login={login} onClose={() => setOut(false)} />}
    </>
  );
}

export function Settings({ login, wide }: { login: string; wide: boolean }) {
  const machine = m.current.value;
  const [name, setName, keep] = useName();
  const [asking, setAsking] = useState<Leave | null>(null);
  return (
    <div class="app">
      <div class="appbar">
        <button class="back" type="button" onClick={back}>{`‹ ${w('web.settings.back')}`}</button>
        <span class="spacer" />
        <h1>{w('web.settings.title')}</h1>
        <span class="spacer" />
      </div>
      <div class="settings">
        {/* On a desktop these are the menu's (D9.1). */}
        {!wide && machine && (
          <>
            <div class="fab7-group">{machine.name}</div>
            <StartRow />
          </>
        )}
        <div class="fab7-group">{w('web.settings.this_device')}</div>
        <div class="settings-field">
          <label for="device-name" class="settings-sub">{w('web.settings.name')}</label>
          <input id="device-name" value={name} onInput={(e) => setName((e.target as HTMLInputElement).value)} onBlur={keep} class="field" />
        </div>
        {!wide && <Notifications />}
        {!wide && m.mine.value.length > 0 && (
          <>
            <div class="fab7-group">{w('web.settings.machines')}</div>
            <MachineRows />
          </>
        )}
        <div class="fab7-group">{fill('web.settings.account', { login })}</div>
        <div class="settings-acts">
          <button class="fab7-button fab7-button--secondary" type="button" onClick={() => setAsking('out')}>{w('web.settings.sign_out')}</button>
          <button class="fab7-button fab7-button--secondary" type="button" onClick={() => setAsking('everywhere')}>{w('web.settings.sign_out_everywhere')}</button>
          <button class="fab7-button fab7-button--secondary leave--warn" type="button" onClick={() => setAsking('forget')}>{w('web.settings.forget')}</button>
          <button class="fab7-button fab7-button--secondary leave--danger" type="button" onClick={() => setAsking('delete')}>{w('web.settings.delete')}</button>
        </div>
        {asking && <Leaving how={asking} login={login} onClose={() => setAsking(null)} />}
        <p class="note settings-foot">
          {w('web.settings.stays')} <a href="/privacy">{w('web.settings.privacy')}</a>
        </p>
      </div>
    </div>
  );
}
