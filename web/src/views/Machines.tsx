import type { Machine } from '../api';
import { go } from '../nav';

export function Machines({ list }: { list: Machine[] }) {
  return (
    <div class="app">
      <div class="appbar">
        <h1>Your machines</h1>
        <span class="spacer" />
        <button class="back" type="button" onClick={() => go({ name: 'settings' })}>Settings</button>
      </div>
      <ul aria-label="Your machines" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {list.map((m) => (
          <li key={m.id}>
            <button
              type="button"
              class="fab7-row"
              style={{ width: '100%', background: 'none', border: 0, borderBottom: '1px solid var(--fab7-line)', textAlign: 'left', font: 'inherit', color: 'inherit', cursor: 'pointer' }}
              onClick={() => go({ name: 'agents', machine: m.id })}
            >
              <span class="fab7-row__title">{m.name}</span>
              <span class="fab7-row__meta">{m.address ? 'reached through its tunnel' : 'has not reported an address yet'}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
