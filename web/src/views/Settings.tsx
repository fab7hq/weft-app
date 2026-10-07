// Settings (M9.1, D9.2) and the desktop's menu (D9.1), which share their rows:
// Start an agent, this device, its notifications, the machines, the account.
import { useEffect, useState } from 'preact/hooks';
import * as api from '../api';
import { Confirm, type Cost } from './Confirm';
import * as m from '../machine';
import { back, go, reset } from '../nav';
import { fill, w } from '../words';
import { Mark } from './Tree';
import * as push from '../push';
import * as store from '../store';

/** Start an agent on the open machine (M9.7). */
export function StartRow({ then, menu = false }: { then?: () => void; menu?: boolean }) {
  const machine = m.current.value;
  if (!machine) return null;
  const start = () => {
    then?.();
    go({ name: 'start', machine: machine.id, from: w('web.settings.title') });
  };
  if (menu)
    return (
      <button class="menu-row menu-start" type="button" onClick={start}>
        {w('start.title')}
      </button>
    );
  return (
    <button class="settings-row" type="button" onClick={start} aria-label={w('start.title')}>
      <span class="settings-text">
        <span>{w('start.title')}</span>
        <span class="settings-sub">{fill('web.start.runs_on', { machine: machine.name })}</span>
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

/** Notifications from the open machine: on or off, and why not when they cannot be. */
function usePush(): [on: boolean, said: string | null, toggle: () => Promise<void>] {
  const machine = m.current.value;
  const [on, setOn] = useState(false);
  const [said, setSaid] = useState<string | null>(null);
  useEffect(() => {
    if (machine) void store.get<store.Kept>('macs', machine.id).then((k) => setOn(Boolean(k?.push)));
  }, [machine?.id]);
  const toggle = async () => {
    if (!machine) return;
    setSaid(null);
    if (on) {
      await push.turnOff(machine.id);
      return setOn(false);
    }
    const why = await push.turnOn(machine.id);
    if (why) setSaid(why);
    else setOn(true);
  };
  return [on, said, toggle];
}

/** The switch the cards draw, kept a checkbox for whoever reads the page. */
function Switch({ on, toggle }: { on: boolean; toggle: () => void }) {
  return (
    <span class="switch">
      <input id="pushes" type="checkbox" checked={on} onChange={toggle} class="switch-input" />
      <span class="switch-track" aria-hidden="true">
        <span class="switch-knob" />
      </span>
    </span>
  );
}

/** Why notifications did not turn on (M9.2, M9.3, D9.3). */
function PushSaid({ said }: { said: string | null }) {
  if (!said) return null;
  return said === 'web.push.home_screen' ? (
    <div role="status" class="push-said push-said--home">
      <strong>{w('web.push.home_screen')}</strong>
      <span>{w('web.push.home_screen_how')}</span>
    </div>
  ) : (
    <p class="push-said" role="status">{w(said)}</p>
  );
}

/** Notifications from the open machine, as Settings' row on a phone (M9.1). */
export function Notifications() {
  const machine = m.current.value;
  const [on, said, toggle] = usePush();
  if (!machine) return null;
  return (
    <>
      <label for="pushes" class="settings-row">
        <span class="settings-text">
          <span>{fill('web.settings.notifications', { machine: machine.name })}</span>
          <span class="settings-sub">{w('web.settings.notifications_when')}</span>
        </span>
        <Switch on={on} toggle={() => void toggle()} />
      </label>
      <PushSaid said={said} />
    </>
  );
}

/** The account's machines: the open one says so; a tap opens one's tree. */
export function MachineRows({ then, menu = false }: { then?: () => void; menu?: boolean }) {
  const open = m.current.value;
  return (
    <>
      {m.mine.value.map((x) => {
        const here = x.id === open?.id && m.link.value === 'connected';
        return (
          <button key={x.id} class={menu ? 'menu-row menu-machine' : 'settings-row'} type="button" onClick={() => (then?.(), reset({ name: 'tree', machine: x.id }))}>
            <span class="settings-text">{x.name}</span>
            {/* "connected ›", one line of words as the cards set it (M9.1). */}
            {here && <span class="settings-connected">{menu ? w('web.settings.connected') : `${w('web.settings.connected')} ›`}</span>}
            {!here && <span class="eval-more">›</span>}
          </button>
        );
      })}
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
    // Safari in a tab has no pushManager: there is nothing to drop, and forgetting goes on.
    await (await navigator.serviceWorker?.getRegistration())?.pushManager?.getSubscription().then((s) => s?.unsubscribe()).catch(() => {});
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

/** D9.1: what ☰ opens on a desktop, dropping down from it. A click outside
 * closes it. When notifications cannot turn on, it holds only their row and
 * why (D9.3). */
export function Menu({ onClose, onSignOut }: { onClose: () => void; onSignOut: () => void }) {
  const machine = m.current.value;
  const [name] = useName();
  const [on, said, toggle] = usePush();
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', esc);
    return () => removeEventListener('keydown', esc);
  }, [onClose]);
  const pushes = machine && (
    <label for="pushes" class="menu-push">
      <span class="settings-text">{fill('web.settings.notifications', { machine: machine.name })}</span>
      <Switch on={on} toggle={() => void toggle()} />
    </label>
  );
  return (
    <div class="menu-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      {said ? (
        <div class="menu-pop menu-pop--said" role="menu" aria-label="Weft">
          {pushes}
          <PushSaid said={said} />
        </div>
      ) : (
        <div class="menu-pop" role="menu" aria-label="Weft">
          <StartRow then={onClose} menu />
          <div class="menu-part">
            <div class="fab7-group settings-group">{w('web.settings.this_device')}</div>
            <div class="menu-value">{name}</div>
          </div>
          {pushes && <div class="menu-part">{pushes}</div>}
          <div class="menu-part menu-part--machines">
            <div class="fab7-group settings-group">{w('web.settings.machines')}</div>
            <MachineRows then={onClose} menu />
          </div>
          <div class="menu-part menu-part--acts">
            <button class="menu-row" type="button" onClick={() => (onClose(), go({ name: 'settings' }))}>{w('web.menu.settings')}</button>
            <button class="menu-row" type="button" onClick={() => (onClose(), onSignOut())}>{w('web.settings.sign_out')}</button>
          </div>
        </div>
      )}
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

/** Settings (M9.1, D9.2): the phone's whole page; on a desktop what the menu does not hold. */
export function Settings({ login, wide }: { login: string; wide: boolean }) {
  const machine = m.current.value;
  const [name, setName, keep] = useName();
  const [asking, setAsking] = useState<Leave | null>(null);
  const leaving = (how: Leave, word: string, cost = '') => (
    <button class={`settings-row settings-leave ${cost}`} type="button" onClick={() => setAsking(how)}>{w(word)}</button>
  );
  return (
    <div class="app">
      {wide ? (
        <div class="appbar">
          <Mark />
          {machine && <span class="settings-machine">{machine.name}</span>}
          <span class="spacer" />
          <button class="back" type="button" onClick={back}>{`‹ ${w('web.settings.back')}`}</button>
        </div>
      ) : (
        <div class="appbar">
          <button class="back" type="button" onClick={back}>{`‹ ${w('web.settings.back')}`}</button>
          <h1>{w('web.settings.title')}</h1>
        </div>
      )}
      <div class="settings">
        {wide && <h1 class="settings-title">{w('web.settings.title')}</h1>}
        {/* On a desktop these are the menu's (D9.1). */}
        {!wide && machine && (
          <>
            <div class="fab7-group settings-group">{machine.name}</div>
            <StartRow />
          </>
        )}
        <div class="fab7-group settings-group">{w('web.settings.this_device')}</div>
        <div class="settings-field">
          <label for="device-name" class="settings-label">{w('web.settings.name')}</label>
          <input id="device-name" value={name} onInput={(e) => setName((e.target as HTMLInputElement).value)} onBlur={keep} class="settings-name" />
        </div>
        {!wide && <Notifications />}
        {!wide && m.mine.value.length > 0 && (
          <>
            <div class="fab7-group settings-group">{w('web.settings.machines')}</div>
            <MachineRows />
          </>
        )}
        <div class="fab7-group settings-group">{fill('web.settings.account', { login })}</div>
        {leaving('out', 'web.settings.sign_out')}
        {leaving('everywhere', 'web.settings.sign_out_everywhere')}
        {leaving('forget', 'web.settings.forget', 'leave--warn')}
        {leaving('delete', 'web.settings.delete', 'leave--danger')}
        {asking && <Leaving how={asking} login={login} onClose={() => setAsking(null)} />}
        <div class="settings-foot">
          <p>{w('web.settings.stays')}</p>
          <a href="/privacy">{w('web.settings.privacy')}</a>
        </div>
      </div>
    </div>
  );
}
