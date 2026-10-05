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
import { Details } from './views/Details';
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

/** A machine joined while the account had none: look again, and open it. */
const joined = () => void lookWho();

export function NoConnection() {
  return (
    <div class="app">
      <div class="page" style={{ justifyContent: 'center' }}>
        <h2>No connection</h2>
        <p class="lede">Weft needs the network to reach your machines. It will try again when you are back online.</p>
        <button class="fab7-button" type="button" onClick={() => void lookWho()}>Try again</button>
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
        <span class="fab7-pill">{w('web.link.asking')}</span>
      </div>
      <div class="page">
        <h2>{w(`web.allow.${where}`)}</h2>
        <p class="lede">
          {before}
          <span class="fab7-key allow-key">Y</span>
          {after}
        </p>
        <p class="note">{w(`web.allow.waits_${where}`)}</p>
      </div>
    </div>
  );
}

/** Not allowed (M8.2–M8.4, D8.2): why, and Your machines, the way on. */
function Refused({ name }: { name: string }) {
  const machines = () => {
    machine.close();
    go({ name: 'machines' });
  };
  return (
    <div class="app">
      <div class="appbar">
        <Mark />
        <h1>{name}</h1>
        <span class="fab7-pill">{w('web.link.refused')}</span>
      </div>
      <div class="page">
        <h2>{w('web.refused.title')}</h2>
        <p class="lede">{w(machine.refusal.value ?? 'web.refused.other')}</p>
        <button class="fab7-button fab7-button--secondary" type="button" onClick={machines}>{w('web.machines.title')}</button>
      </div>
    </div>
  );
}

export function App() {
  const a = account.value;
  if (a.state === 'loading') return <div class="app" aria-busy="true"></div>;
  if (a.state === 'offline') return <NoConnection />;
  const view = here();
  if (a.state === 'signed_out' || !view || view.name === 'signin') return <SignIn />;
  switch (view.name) {
    case 'add':
      return <AddMachine login={a.login} onJoined={joined} />;
    case 'machines':
      return <Machines list={a.machines} />;
    case 'tree':
    case 'agent':
    case 'detail':
    case 'eval':
    case 'start': {
      const m = a.machines.find((x) => x.id === view.machine);
      if (!m) return <Machines list={a.machines} />;
      machine.open(m);
      if (machine.link.value === 'asking') return <Asking name={m.name} />;
      if (machine.link.value === 'refused') return <Refused name={m.name} />;
      if (view.name === 'tree') queueMicrotask(() => openWanted(m.id));
      const shown =
        wide.value ? <Wide machine={m} agent={view.name === 'agent' ? view.agent : null} starting={view.name === 'start' ? view.harness ?? '' : null} view={view} />
        : view.name === 'eval' ? <EvalView machine={m} unit={view.unit} at={view.at} files={view.files} />
        : view.name === 'detail' ? <Details machine={m} unit={view.unit} />
        : view.name === 'start' ? <StartPage machine={m} from={view.from} harness={view.harness} />
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
