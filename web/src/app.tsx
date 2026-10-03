import { signal } from '@preact/signals';
import * as api from './api';
import { go, here, reset } from './nav';
import * as machine from './machine';
import { AddMachine } from './views/AddMachine';
import { Agent } from './views/Agent';
import { Agents } from './views/Agents';
import { Machines } from './views/Machines';
import { SignIn } from './views/SignIn';

/** What the app knows about who is here and their machines. */
type Account =
  | { state: 'loading' }
  | { state: 'offline' }
  | { state: 'signed_out' }
  | { state: 'signed_in'; login: string; machines: api.Machine[] };

export const account = signal<Account>({ state: 'loading' });

export async function lookWho(): Promise<void> {
  try {
    const me = await api.me();
    if (!me) {
      account.value = { state: 'signed_out' };
      reset({ name: 'signin' });
      return;
    }
    const machines = await api.machines();
    account.value = { state: 'signed_in', login: me.login, machines };
    if (machines.length === 0) reset({ name: 'add' });
    else if (machines.length === 1) reset({ name: 'agents', machine: machines[0].id });
    else reset({ name: 'machines' });
  } catch {
    account.value = { state: 'offline' };
  }
}

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

function Asking({ name }: { name: string }) {
  return (
    <div class="app">
      <div class="appbar">
        <h1>{name}</h1>
        <span class="fab7-pill">Asking</span>
      </div>
      <div class="page">
        <h2>Allow this phone on your machine</h2>
        <p class="lede">Your machine is asking you. Go to it and press Y.</p>
        <p class="note">The question waits two minutes. Nothing on this device can answer it.</p>
      </div>
    </div>
  );
}

function Refused({ name }: { name: string }) {
  return (
    <div class="app">
      <div class="appbar">
        <h1>{name}</h1>
        <span class="fab7-pill">Refused</span>
      </div>
      <div class="page">
        <h2>Not allowed</h2>
        <p class="lede">{machine.refusal.value}</p>
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
      return <AddMachine login={a.login} />;
    case 'machines':
      return <Machines list={a.machines} />;
    case 'agents':
    case 'agent': {
      const m = a.machines.find((x) => x.id === view.machine);
      if (!m) return <Machines list={a.machines} />;
      machine.open(m);
      if (machine.link.value === 'asking') return <Asking name={m.name} />;
      if (machine.link.value === 'refused') return <Refused name={m.name} />;
      return view.name === 'agent' ? <Agent machine={m} agent={view.agent} /> : <Agents machine={m} />;
    }
    default:
      return <div class="app" />;
  }
}

void lookWho();
addEventListener('online', () => void lookWho());
