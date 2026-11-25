// Settings (19.1–19.11), grouped by what the person wants to do: the open
// machine's General, Eval, Rules and Agent apps, then this device and the
// account. A desktop lists the sections beside the one shown; a phone lists
// them, each opening its page. Advanced settings shows the expert controls in
// place, and every page says so. And the desktop's ☰ menu (19.1): the
// machines, Settings… and Sign out.
import { useEffect, useState } from 'preact/hooks';
import * as api from '../api';
import { advanced, flipAdvanced } from '../advanced';
import { Confirm, type Cost } from './Confirm';
import * as m from '../machine';
import { back, go, reset, swap, type Section } from '../nav';
import { ENTRIES, HOW_HARD, type HowHard, KEYS, ROLES, domainName, howHard, judgesIn, machineName, machineSwitch } from '../settings';
import { fill, w } from '../words';
import { Mark } from './Tree';
import * as push from '../push';
import * as store from '../store';
import { KeepSessions, MachineName, RoleRow, Row, useSettings } from './MachineSettings';
import { AppsSection, EvalNever, Head, RulesSection, appsNeeding, useRulesSummary, useSupported } from './RingFrameSettings';
import { Coming, Saving } from './Wait';

/** This device's name, as the machines show it. */
function useName(): [string, (s: string) => void, () => void] {
  const [name, setName] = useState('');
  useEffect(() => void store.device().then((d) => setName(d.name)), []);
  const keep = () => void store.device().then((d) => store.set('devices', 'this', { ...d, name: name.trim() || d.name }));
  return [name, setName, keep];
}

/** Notifications from the open machine on this device: on or off, and why not when they cannot be. */
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
function Switch({ id, on, toggle, turbo = false }: { id: string; on: boolean; toggle: () => void; turbo?: boolean }) {
  return (
    <span class={turbo ? 'switch switch--turbo' : 'switch'}>
      <input id={id} type="checkbox" checked={on} onChange={toggle} class="switch-input" />
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

/** The account's machines in ☰: the open one says so; another opens its tree. */
function MachineRows({ then }: { then: () => void }) {
  const open = m.current.value;
  return (
    <>
      {m.mine.value.map((x) => {
        const here = x.id === open?.id && m.link.value === 'connected';
        return (
          <button key={x.id} class={`menu-row menu-machine${here ? ' menu-machine--here' : ''}`} type="button" onClick={() => (then(), here || reset({ name: 'tree', machine: x.id }))}>
            <span class={here ? 'set-dot set-dot--on' : 'set-dot'} aria-hidden="true">●</span>
            <span class="settings-text">{x.name}</span>
            {here ? <span class="settings-connected">{w('web.settings.connected')}</span> : <span class="eval-more">›</span>}
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
  return <Confirm question={w(ask)} what={fill(what, { login })} cost={cost} onProceed={() => leave(how)} onClose={onClose} />;
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

/** 19.1: what ☰ opens on a desktop, dropping down from it: the machines,
 * Settings… and Sign out. A click outside, or Esc, closes it. */
export function Menu({ onClose, onSignOut }: { onClose: () => void; onSignOut: () => void }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', esc);
    return () => removeEventListener('keydown', esc);
  }, [onClose]);
  return (
    <div class="menu-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class="menu-pop" role="menu" aria-label="Weft">
        <div class="menu-part menu-part--machines">
          <div class="fab7-group settings-group">{w('web.settings.machines')}</div>
          <MachineRows then={onClose} />
        </div>
        <div class="menu-part menu-part--acts">
          <button class="menu-row" type="button" onClick={() => (onClose(), go({ name: 'settings', machine: m.current.value?.id }))}>{w('web.menu.settings')}</button>
          <button class="menu-row" type="button" onClick={() => (onClose(), onSignOut())}>{w('web.settings.sign_out')}</button>
        </div>
      </div>
    </div>
  );
}

/** ☰ at the top right of a desktop's tree: it opens the menu (19.1). */
export function MenuButton({ login }: { login: string }) {
  const [open, setOpen] = useState(false);
  const [out, setOut] = useState(false);
  return (
    <>
      <button class="menu" type="button" aria-label={w('menu')} aria-expanded={open} onClick={() => setOpen(!open)}>☰</button>
      {open && <Menu onClose={() => setOpen(false)} onSignOut={() => setOut(true)} />}
      {out && <Leaving how="out" login={login} onClose={() => setOut(false)} />}
    </>
  );
}

/** The sections of the open machine, in their order, and their names. */
const SECTIONS: [Section, string][] = [
  ['general', 'settings.general'],
  ['eval', 'settings.eval'],
  ['rules', 'settings.rules'],
  ['apps', 'settings.apps'],
];

/** The badge every Settings page carries while Advanced settings is on. */
function AdvancedMark() {
  return advanced.value ? <span class="set-mode">{w('settings.advanced_mark')}</span> : null;
}

/** Advanced settings' switch: at the foot of a desktop's list and of a phone's. */
function AdvancedSwitch() {
  return (
    <label for="advanced" class={`set-advanced${advanced.value ? ' set-advanced--on' : ''}`}>
      <span class="settings-text">{w('settings.advanced')}</span>
      <Switch id="advanced" on={advanced.value} toggle={flipAdvanced} />
    </label>
  );
}

/** Which machine Settings is for: the account's machines, the open one picked. */
function MachinePicker({ machine, section }: { machine: api.Machine | null; section?: Section }) {
  const connected = machine && m.link.value === 'connected';
  if (m.mine.value.length === 0) return null;
  return (
    <label class="set-machine">
      <span class={connected ? 'set-dot set-dot--on' : 'set-dot'} aria-hidden="true">●</span>
      <select class="set-machine-select" aria-label={w('web.settings.machines')} value={machine?.id ?? ''}
        onChange={(e) => swap({ name: 'settings', machine: (e.target as HTMLSelectElement).value, section })}>
        {!machine && <option value="">—</option>}
        {m.mine.value.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
      </select>
      {connected && <span class="settings-connected set-machine-said">{w('settings.connected')}</span>}
      <span class="set-machine-chev" aria-hidden="true">▾</span>
    </label>
  );
}

/** A machine's switch: its words, and the switch the cards draw. */
function SwitchRow({ project, which, word, what, turbo = false }: { project: string; which: 'turbo' | 'login' | 'notify'; word: string; what: string; turbo?: boolean }) {
  const s = m.settings.value[project];
  const on = machineSwitch(s, which);
  const id = `machine-${which}`;
  return (
    <label for={id} class="settings-row">
      <span class="settings-text">
        <span>{word}</span>
        <span class="settings-sub">{what}</span>
      </span>
      <Switch id={id} on={on} turbo={turbo} toggle={() => void m.setSetting(project, 'machine', KEYS[which], !on)} />
    </label>
  );
}

/** General (19.2, 19.10): the machine's name, Start Weft at login, Notify me,
 * how long finished sessions stay, and Turbo. */
function General({ project, machine }: { project: string; machine: api.Machine }) {
  const named = machineName(m.settings.value[project], machine.name);
  return (
    <>
      <div class="fab7-group settings-group">{named}</div>
      <MachineName project={project} listed={machine.name} />
      <SwitchRow project={project} which="login" word={w('settings.login')} what={fill('settings.login_what', { machine: named })} />
      <SwitchRow project={project} which="notify" word={w('settings.notify')} what={w('settings.notify_what')} />
      <KeepSessions project={project} />
      <div class="fab7-group settings-group">{w('settings.agents')}</div>
      <SwitchRow project={project} which="turbo" word={w('desktop.menu.turbo')} what={w('settings.turbo_what')} turbo />
    </>
  );
}

const CARE: [Exclude<HowHard, 'custom'>, string, string][] = [
  ['quick', 'desktop.settings.quick', 'settings.eval.quick_what'],
  ['balanced', 'desktop.settings.balanced', 'settings.eval.balanced_what'],
  ['thorough', 'desktop.settings.thorough', 'settings.eval.thorough_what'],
];

/** How carefully Eval reads: Quick, Balanced or Thorough for every reader, or
 * Custom once a reader is set on its own. */
function Care({ project }: { project: string }) {
  const hard = howHard(m.settings.value[project]?.machine);
  const choose = async (h: Exclude<HowHard, 'custom'>) => {
    for (const [role] of ROLES) await m.setSetting(project, 'machine', ['eval', 'debate', role, 'effort'], HOW_HARD[h]);
  };
  return (
    <div class="set-care" role="radiogroup" aria-label={w('settings.eval.care')}>
      {CARE.map(([h, word, what]) => (
        <button key={h} type="button" role="radio" aria-checked={hard === h} class={hard === h ? 'set-care-opt set-care-opt--on' : 'set-care-opt'} onClick={() => void choose(h)}>
          <span class="set-care-name">{w(word)}</span>
          <span class="set-care-what">{w(what)}</span>
        </button>
      ))}
      {hard === 'custom' && (
        <span class="set-care-opt set-care-opt--on" role="radio" aria-checked>
          <span class="set-care-name">{w('desktop.settings.custom')}</span>
          <span class="set-care-what">{w('settings.eval.custom_what')}</span>
        </span>
      )}
    </div>
  );
}

/** Eval (19.3, 19.4): how carefully it reads, which agent app reads, and what
 * it never does; Advanced settings adds each reader and who runs each step. */
function EvalSection({ project }: { project: string }) {
  const s = m.settings.value[project]?.machine;
  const supported = useSupported(project);
  const judge = supported?.find((h) => h.harness === judgesIn(s))?.eval ?? undefined;
  const more = advanced.value;
  return (
    <>
      <Head label={w('settings.eval.care')} />
      <Care project={project} />
      <Head label={w('settings.eval.who')} />
      <Row e={ENTRIES[3]} s={s} project={project} scope="machine" named={['settings.eval.read_by', 'settings.eval.read_by_what']} />
      {more && (
        <>
          <Head label={w('settings.eval.each')} more />
          {ROLES.map(([role, , word]) => <RoleRow key={role} role={role} word={word} s={s} project={project} judge={judge} />)}
          <Head label={w('settings.eval.steps')} more />
          <Row e={ENTRIES[0]} s={s} project={project} scope="machine" />
          <Row e={ENTRIES[1]} s={s} project={project} scope="machine" named={['act.eval', 'settings.eval.eval_what']} />
          <Row e={ENTRIES[2]} s={s} project={project} scope="machine" />
        </>
      )}
      <EvalNever project={project} />
    </>
  );
}

/** This device & account (19.9): this device's name and its notifications, then the account's acts. */
function You({ login, machine }: { login: string; machine: api.Machine | null }) {
  const [name, setName, keep] = useName();
  const [on, said, toggle] = usePush();
  const [asking, setAsking] = useState<Leave | null>(null);
  const leaving = (how: Leave, word: string, cost = '') => (
    <button class={`settings-row settings-leave ${cost}`} type="button" onClick={() => setAsking(how)}>{w(word)}</button>
  );
  return (
    <>
      <div class="fab7-group settings-group">{w('settings.device')}</div>
      <div class="settings-row settings-row--setting settings-machine-name">
        <label class="settings-text" for="device-name">
          <span>{w('desktop.settings.name')}</span>
          <span class="settings-sub">{w('settings.device_name_what')}</span>
        </label>
        <input id="device-name" class="settings-input" value={name} onInput={(e) => setName((e.target as HTMLInputElement).value)} onBlur={keep} />
      </div>
      {machine && (
        <label for="pushes" class="settings-row">
          <span class="settings-text">
            <span>{w('settings.device_notify')}</span>
            <span class="settings-sub">{fill('settings.device_notify_what', { machine: machine.name })}</span>
          </span>
          <Switch id="pushes" on={on} toggle={() => void toggle()} />
        </label>
      )}
      <PushSaid said={said} />
      {/* The login as it is spelled, in an eyebrow that is otherwise upper case. */}
      <div class="fab7-group settings-group">
        {w('web.settings.account').split('{login}')[0]}
        <span class="as-spelled">{login}</span>
        {w('web.settings.account').split('{login}')[1] ?? ''}
      </div>
      {leaving('out', 'web.settings.sign_out')}
      {leaving('everywhere', 'web.settings.sign_out_everywhere')}
      {leaving('forget', 'web.settings.forget', 'leave--warn')}
      {leaving('delete', 'web.settings.delete', 'leave--danger')}
      {asking && <Leaving how={asking} login={login} onClose={() => setAsking(null)} />}
      <a class="set-privacy" href="/privacy">{w('web.settings.privacy')}</a>
    </>
  );
}

/** One section's page: what the machine has said, else that it is coming. */
function Shown({ section, login, machine, project, wide, practice }: { section: Section; login: string; machine: api.Machine | null; project: string | undefined; wide: boolean; practice?: string }) {
  const s = useSettings(project);
  if (section === 'you') return <You login={login} machine={machine} />;
  if (!machine) return null;
  if (!project) return <p class="settings-sub set-lede">{fill('web.machine.no_project', { machine: machine.name })}</p>;
  if (section === 'rules') return <RulesSection project={project} wide={wide} practice={practice} openPractice={(c) => go({ name: 'settings', machine: machine.id, section: 'rules', practice: c })} />;
  if (section === 'apps') return <AppsSection project={project} machine={machineName(s, machine.name)} />;
  if (!s) return <Coming />;
  return section === 'general' ? <General project={project} machine={machine} /> : <EvalSection project={project} />;
}

/** Agent apps' mark in a desktop's list: how many need the person. */
function AppsMark({ project }: { project: string }) {
  const { n } = appsNeeding(useSupported(project));
  return n > 0 ? <span class="set-needs">{`■ ${n}`}</span> : null;
}

/** A phone's list (19.1, 19.11): each section with what it holds now, then this device & account. */
function PhoneList({ login, machine, project }: { login: string; machine: api.Machine | null; project: string | undefined }) {
  const named = machine ? machineName(m.settings.value[project ?? ''], machine.name) : '';
  const open = (section: Section) => go({ name: 'settings', machine: machine?.id, section });
  return (
    <>
      <MachinePicker machine={machine} />
      {machine && (
        <>
          <div class="fab7-group settings-group">{named}</div>
          {project ? <Summaries project={project} open={open} /> : SECTIONS.map(([sec, word]) => <ListRow key={sec} word={w(word)} onClick={() => open(sec)} />)}
        </>
      )}
      <div class="fab7-group settings-group">{w('word.you')}</div>
      <ListRow word={w('settings.device_account')} said={login} onClick={() => open('you')} />
      <span class="spacer" />
      <AdvancedSwitch />
    </>
  );
}

function ListRow({ word, said, warn = false, onClick }: { word: string; said?: string; warn?: boolean; onClick: () => void }) {
  return (
    <button class="settings-row set-list-row" type="button" onClick={onClick}>
      <span class="settings-text">{word}</span>
      {said && <span class={warn ? 'set-said set-said--warn' : 'set-said'}>{warn ? `■ ${said}` : said}</span>}
      <span class="eval-more" aria-hidden="true">›</span>
    </button>
  );
}

/** The phone's list rows for a machine with a project: each with its summary. */
function Summaries({ project, open }: { project: string; open: (s: Section) => void }) {
  const s = useSettings(project);
  const supported = useSupported(project);
  const rules = useRulesSummary(project);
  const hard = howHard(s?.machine);
  const reader = supported?.find((h) => h.harness === judgesIn(s?.machine))?.title;
  const evalSaid = [w(hard === 'custom' ? 'desktop.settings.custom' : `desktop.settings.${hard}`), reader].filter(Boolean).join(' · ');
  const apps = appsNeeding(supported);
  return (
    <>
      <ListRow word={w('settings.general')} onClick={() => open('general')} />
      <ListRow word={w('settings.eval')} said={s ? evalSaid : ''} onClick={() => open('eval')} />
      <ListRow word={w('settings.rules')} said={rules} onClick={() => open('rules')} />
      <ListRow word={w('settings.apps')} said={apps.said} warn={apps.n > 0} onClick={() => open('apps')} />
    </>
  );
}

/** Settings: a desktop's list beside the section shown; a phone's list, or one section's page. */
export function Settings({ login, wide, machine, section, practice }: { login: string; wide: boolean; machine: api.Machine | null; section?: Section; practice?: string }) {
  const project = machine ? m.tree.value[0]?.project : undefined;
  const more = advanced.value;
  const at: Section | undefined = section ?? (wide ? (machine ? 'general' : 'you') : undefined);
  const title = (sec: Section) => w(sec === 'you' ? 'settings.device_account' : SECTIONS.find(([x]) => x === sec)?.[1] ?? '');
  if (!wide) {
    const page = at && (practice ? domainName(practice.replace(/^practices\//, '')) : title(at));
    return (
      <div class="app">
        <div class={`appbar${more ? ' appbar--advanced' : ''}`}>
          <button class="back" type="button" onClick={back}>{`‹ ${at ? w(practice ? 'settings.rules' : 'web.settings.title') : w('web.settings.back')}`}</button>
          <h1>{page || w('web.settings.title')}</h1>
          <span class="spacer" />
          <AdvancedMark />
        </div>
        <div class={`settings settings--machine${at ? '' : ' set-list'}`}>
          <Saving />
          {at ? <Shown section={at} login={login} machine={machine} project={project} wide={false} practice={practice} /> : <PhoneList login={login} machine={machine} project={project} />}
        </div>
      </div>
    );
  }
  const item = (sec: Section, word: string) => (
    <button key={sec} type="button" class={`set-item${sec === at ? ' set-item--on' : ''}`} aria-current={sec === at ? 'page' : undefined}
      onClick={() => swap({ name: 'settings', machine: machine?.id, section: sec })}>
      <span>{w(word)}</span>
      {sec === 'apps' && project && <AppsMark project={project} />}
    </button>
  );
  return (
    <div class="app">
      <div class={`appbar${more ? ' appbar--advanced' : ''}`}>
        <Mark />
        <span class="spacer" />
        <button class="back" type="button" onClick={back}>{`‹ ${w('web.settings.back')}`}</button>
      </div>
      <div class="set-wrap">
        <nav class="set-nav" aria-label={w('web.settings.title')}>
          <h1 class="settings-title">{w('web.settings.title')}<AdvancedMark /></h1>
          <MachinePicker machine={machine} section={at} />
          {machine && SECTIONS.map(([sec, word]) => item(sec, word))}
          <div class="fab7-group settings-group">{w('word.you')}</div>
          {item('you', 'settings.device_account')}
          <span class="spacer" />
          <AdvancedSwitch />
        </nav>
        <div class="settings settings--machine set-col">
          <h2 class="set-title">{at && title(at)}</h2>
          <Saving />
          {at && <Shown section={at} login={login} machine={machine} project={project} wide practice={practice} />}
        </div>
      </div>
    </div>
  );
}
