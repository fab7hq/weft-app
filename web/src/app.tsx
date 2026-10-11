import { signal } from '@preact/signals';
import * as api from './api';
import { go, here, reset } from './nav';
import { fill, w } from './words';
import * as machine from './machine';
import * as store from './store';
import { AddMachine } from './views/AddMachine';
import { Agent } from './views/Agent';
import { PendingBar } from './views/Asked';
import { AskSheet } from './views/Ask';
import { Details, RoundDetails, SealDetails } from './views/Details';
import { EarlierSessions, SessionDetails } from './views/Session';
import { EvalView } from './views/EvalView';
import { Mark, TreePage } from './views/Tree';
import { StartPage } from './views/Start';
import { Machines } from './views/Machines';
import { Settings } from './views/Settings';
import { Wide } from './views/Wide';
import { SignIn } from './views/SignIn';

/** What the app knows about who is here and their machines. */
type Account =
  | { state: 'loading' }
  | { state: 'offline' }
  | { state: 'signed_out' }
  | { state: 'signed_in'; login: string; machines: api.Machine[] };

export const account = signal<Account>({ state: 'loading' });

/** A tablet or a desktop: the tree beside the agent. */
const wideQuery = matchMedia('(min-width: 768px)');
const wide = signal(wideQuery.matches);
wideQuery.addEventListener('change', (e) => (wide.value = e.matches));

/** The agent a notification asked to open (web-app.md §8), read once at start. */
let wanted: string | null = null;
const reading = store.get<string>('open', 'open').then((a) => {
  wanted = a ?? null;
});

/** Open the agent a notification asked for, once the machine lists it. */
function openWanted(machineId: string): void {
  if (!wanted || !machine.agents.value.some((a) => a.agent === wanted)) return;
  const agent = wanted;
  wanted = null;
  void store.del('open', 'open');
  go({ name: 'agent', machine: machineId, agent });
}

export async function lookWho(): Promise<void> {
  await reading;
  try {
    const me = await api.me();
    if (!me) {
      account.value = { state: 'signed_out' };
      reset({ name: 'signin' });
      return;
    }
    const machines = await api.machines();
    account.value = { state: 'signed_in', login: me.login, machines };
    machine.mine.value = machines;
    if (machines.length === 0) reset({ name: 'add' });
    else if (machines.length === 1) reset({ name: 'tree', machine: machines[0].id });
    else reset({ name: 'machines' });
  } catch {
    account.value = { state: 'offline' };
  }
}

/** A machine left the account: it goes from the list, and from the screen if open. */
function removed(id: string): void {
  const a = account.value;
  if (a.state !== 'signed_in') return;
  const machines = a.machines.filter((m) => m.id !== id);
  account.value = { ...a, machines };
  machine.mine.value = machines;
  if (machine.current.value?.id === id) machine.close();
  if (machines.length === 0) reset({ name: 'add' });
}

/** A machine joined while the account had none: look again, and open it. */
const joined = () => void lookWho();

export function NoConnection() {
  return (
    <div class="app">
      <div class="page">
        <h2>No connection</h2>
        <p class="lede">Weft needs the network to reach your machines. It will try again when you are back online.</p>
        <button class="start-button start-button--plain" type="button" onClick={() => void lookWho()}>{w('web.try_again')}</button>
      </div>
    </div>
  );
}

/** Allowing this device (M8.1, D8.1): the machine asks, and only it can answer. */
function Asking({ name }: { name: string }) {
  const where = wide.value ? 'browser' : 'phone';
  // The key the machine waits for, drawn as a key.
  const [before, after] = fill('web.allow.go', { machine: name }).split('{key}');
  return (
    <div class="app">
      <div class="appbar">
        <Mark />
        <h1>{name}</h1>
        <span class="spacer" />
        <span class="link-pill">{w('web.link.asking')}</span>
      </div>
      <div class="page allow">
        <h2>{w(`web.allow.${where}`)}</h2>
        <p class="lede">
          {before}
          <span class="allow-key">Y</span>
          {after}
        </p>
        <p class="allow-waits">{w(`web.allow.waits_${where}`)}</p>
      </div>
    </div>
  );
}

/** The refusals that need the person (M13.2–M13.4): a title naming the
 * machine, what to do, and the way on. */
const NEEDS_YOU: Record<string, { title: string; act: 'again' | 'reload' }> = {
  'web.refused.update': { title: 'web.refused.update_title', act: 'again' },
  'web.refused.reload': { title: 'web.refused.reload_title', act: 'reload' },
  'web.refused.signed_out': { title: 'web.refused.signed_out_title', act: 'again' },
};

/** Not allowed (M8.2–M8.4, D8.2): why, and Your machines, the way on; or what
 * to do first, when it needs the person (M13.2–M13.4). */
function Refused({ name }: { name: string }) {
  const machines = () => {
    machine.close();
    go({ name: 'machines' });
  };
  const key = machine.refusal.value ?? 'web.refused.other';
  const needs = NEEDS_YOU[key];
  if (needs) {
    return (
      <div class="app">
        <div class="appbar">
          <Mark />
          <h1>{name}</h1>
          <span class="spacer" />
          <span class="link-pill">{w('web.link.refused')}</span>
        </div>
        <div class="page allow">
          <h2>{fill(needs.title, { machine: name })}</h2>
          <p class="lede">{fill(key, { machine: name })}</p>
          <div class="refused-acts">
            {needs.act === 'reload' ? (
              <button class="start-button start-button--go" type="button" onClick={() => location.reload()}>{w('web.reload')}</button>
            ) : (
              <button class="start-button start-button--go" type="button" onClick={() => machine.again()}>{w('web.try_again')}</button>
            )}
            <button class="start-button" type="button" onClick={machines}>{w('web.machines.title')}</button>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div class="app">
      <div class="appbar">
        <Mark />
        <h1>{name}</h1>
        <span class="spacer" />
        <span class="link-pill">{w('web.link.refused')}</span>
      </div>
      <div class="page allow">
        <h2>{w('web.refused.title')}</h2>
        <p class="lede">{w(machine.refusal.value ?? 'web.refused.other')}</p>
        <button class="start-button start-button--go start-button--wide" type="button" onClick={machines}>{w('web.machines.title')}</button>
      </div>
    </div>
  );
}

export function App() {
  const a = account.value;
  if (a.state === 'loading') return <div class="app loading" aria-busy="true"><Mark /></div>;
  if (a.state === 'offline') return <NoConnection />;
  const view = here();
  if (a.state === 'signed_out' || !view || view.name === 'signin') return <SignIn />;
  switch (view.name) {
    case 'add':
      return <AddMachine login={a.login} wide={wide.value} onJoined={joined} />;
    case 'machines':
      return <Machines list={a.machines} wide={wide.value} onRemoved={removed} />;
    case 'tree':
    case 'agent':
    case 'detail':
    case 'round':
    case 'seal':
    case 'session':
    case 'earlier':
    case 'eval':
    case 'start': {
      const m = a.machines.find((x) => x.id === view.machine);
      if (!m) return <Machines list={a.machines} wide={wide.value} onRemoved={removed} />;
      machine.open(m);
      if (machine.link.value === 'asking') return <Asking name={m.name} />;
      if (machine.link.value === 'refused') return <Refused name={m.name} />;
      if (view.name === 'tree') queueMicrotask(() => openWanted(m.id));
      const shown =
        wide.value ? <Wide login={a.login} machine={m} agent={view.name === 'agent' ? view.agent : null} starting={view.name === 'start' ? view.harness ?? '' : null} view={view} />
        : view.name === 'eval' ? <EvalView key={`${view.eval}${view.at}${view.files}`} machine={m} project={view.project} eval={view.eval} at={view.at} files={view.files} />
        : view.name === 'detail' ? <Details key={view.unit} machine={m} project={view.project} unit={view.unit} />
        : view.name === 'round' ? <RoundDetails key={view.eval} machine={m} project={view.project} eval={view.eval} />
        : view.name === 'seal' ? <SealDetails key={view.seal} machine={m} project={view.project} seal={view.seal} />
        : view.name === 'session' ? <SessionDetails key={view.session} machine={m} project={view.project} session={view.session} />
        : view.name === 'earlier' ? <EarlierSessions key={view.project} machine={m} project={view.project} />
        : view.name === 'start' ? <StartPage machine={m} from={view.from} harness={view.harness} project={view.project} />
        : view.name === 'agent' ? <Agent machine={m} agent={view.agent} />
        : <TreePage machine={m} />;
      return (
        <>
          {shown}
          <AskSheet />
          <PendingBar />
        </>
      );
    }
    case 'settings':
      return <Settings login={a.login} wide={wide.value} />;
    default:
      return <div class="app" />;
  }
}

// A notification tapped while the app is open (the service worker says which).
navigator.serviceWorker?.addEventListener('message', (e) => {
  const msg = e.data as { type?: string; agent?: string };
  const m = machine.current.value;
  if (msg.type !== 'open' || !msg.agent || !m) return;
  void store.del('open', 'open');
  go({ name: 'agent', machine: m.id, agent: msg.agent });
});

void lookWho();
addEventListener('online', () => void lookWho());
