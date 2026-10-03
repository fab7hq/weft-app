import { signal } from '@preact/signals';

/** What the app knows about who is here. */
type Who = { state: 'loading' } | { state: 'offline' } | { state: 'signed_out' } | { state: 'signed_in'; login: string };

export const who = signal<Who>({ state: 'loading' });

export async function lookWho(): Promise<void> {
  try {
    const r = await fetch('/api/me', { credentials: 'same-origin' });
    if (r.status === 401) who.value = { state: 'signed_out' };
    else if (r.ok) who.value = { state: 'signed_in', login: ((await r.json()) as { login: string }).login };
    else who.value = { state: 'offline' };
  } catch {
    who.value = { state: 'offline' };
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

export function App() {
  const w = who.value;
  if (w.state === 'loading') return <div class="app" aria-busy="true"></div>;
  if (w.state === 'offline') return <NoConnection />;
  return (
    <div class="app">
      <div class="page">
        <h2>Weft</h2>
      </div>
    </div>
  );
}

void lookWho();
addEventListener('online', () => void lookWho());
