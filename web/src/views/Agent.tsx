import type { Machine } from '../api';
import * as m from '../machine';
import { back } from '../nav';
import { LinkPill } from './Status';

/** The keys the key bar sends, as bytes (web-app.md §6). */
export const KEYS: [string, string, number[]][] = [
  ['Esc', 'Esc', [0x1b]],
  ['Tab', 'Tab', [0x09]],
  ['↑', 'Up', [0x1b, 0x5b, 0x41]],
  ['↓', 'Down', [0x1b, 0x5b, 0x42]],
  ['⏎', 'Enter', [0x0d]],
  ['^C', 'Control-C', [0x03]],
  ['1', '1', [0x31]],
  ['2', '2', [0x32]],
  ['3', '3', [0x33]],
];

export const b64 = (bytes: number[]) => btoa(String.fromCharCode(...bytes));

export function Agent({ machine, agent }: { machine: Machine; agent: string }) {
  const a = m.agents.value.find((x) => x.agent === agent);
  const live = m.link.value === 'connected';
  return (
    <div class="app">
      <div class="appbar">
        <button class="back" type="button" onClick={back}>‹ Agents</button>
        <span class="spacer" />
        <LinkPill />
      </div>
      <div style={{ padding: '12px 16px 8px' }}>
        <span style={{ fontSize: '17px', fontWeight: 600 }}>{a ? `${a.project} · ${a.title}` : machine.name}</span>
      </div>
      <div style={{ flex: 1 }} />
      <div class="fab7-keybar" role="toolbar" aria-label="Keys">
        {KEYS.map(([label, name, bytes]) => (
          <button
            key={name}
            class="fab7-key"
            type="button"
            aria-label={name}
            disabled={!live}
            onClick={() => void m.request({ type: 'keys', agent, bytes: b64(bytes) })}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
