import { useEffect, useRef, useState } from 'preact/hooks';
import type { Machine } from '../api';
import * as m from '../machine';
import { back, swap } from '../nav';
import { BarSheet, openKeys, type BarActs } from './Bar';
import { asking } from './Ask';
import { KeyBar, mods, press } from './Keys';
import { Tabs } from './Tabs';
import { ANSWER, sent, typed } from '../keys';
import { NeedsYouPill } from './Tree';
import { Screen, fit } from './Screen';
import { LinkPill } from './Status';
import { fill, w } from '../words';

export const b64 = (bytes: number[]) => btoa(String.fromCharCode(...bytes));


/** Before a device's first key for an agent: its size (remote.md §9). */
const sized = new Set<string>();

export function Agent({ machine, agent, embedded = false }: { machine: Machine; agent: string; embedded?: boolean }) {
  const a = m.agents.value.find((x) => x.agent === agent);
  // Nothing goes to an agent that has ended.
  const live = m.link.value === 'connected' && Boolean(a?.running);
  const driving = m.control.value[agent] === 'you';
  if (!driving) sized.delete(agent);
  const box = useRef<HTMLDivElement>(null);
  const [message, setMessage] = useState('');
  const [history, setHistory] = useState<string | null>(null);
  const [bar, setBar] = useState(false);
  const [typing, setTyping] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const takeKeys = () => {
    if (sized.has(agent) || !box.current) return;
    // The terminal's own area, inside the pane's padding, as `watch` measured it.
    const { rows, cols } = fit((box.current.firstElementChild as HTMLElement | null) ?? box.current);
    if (m.send({ type: 'size', agent, rows, cols })) sized.add(agent);
  };
  // Why nothing went, as the TUI says it (M10.2); the next press clears it.
  const [said, setSaid] = useState<string | null>(null);
  const why = () => (a && !a.running ? fill('agent.ended', { harness: a.harness }) : w('web.why.not_connected'));
  const refused = (answer: Record<string, unknown> | undefined) => {
    if (answer?.type !== 'error') return;
    const key = `not_typed.${String(answer.code)}`;
    setSaid(w(key) === key ? String(answer.message) : w(key));
  };
  const key = (bytes: number[]) => {
    setSaid(null);
    if (!live) return setSaid(why());
    takeKeys();
    void m.request({ type: 'keys', agent, bytes: b64(bytes) })?.then(refused);
  };
  const sendText = (e: Event) => {
    e.preventDefault();
    setSaid(null);
    if (!message.trim()) return;
    if (!live) return setSaid(why());
    takeKeys();
    const sent = m.request({ type: 'text', agent, text: message });
    if (sent) {
      setMessage('');
      void sent.then(refused);
    }
  };
  const showHistory = async () => {
    const answer = await m.request({ type: 'read', agent, what: 'history' });
    if (answer?.type === 'ok') setHistory(String(answer.text ?? ''));
  };

  const acts: BarActs = { harness: a?.harness ?? '', onAsk: () => (asking.value = { agent, project: a?.project }) };
  // On a desktop the bar's Keys send here.
  useEffect(() => {
    if (!embedded) return;
    openKeys.value = key;
    return () => {
      openKeys.value = null;
    };
  });

  return (
    <div class="app" style={embedded ? { height: '100%' } : undefined}>
      {!embedded && (
        <div class="appbar">
          <button class="back" type="button" onClick={back}>{`‹ ${a?.project ?? machine.name}`}</button>
          <span class="spacer" />
          <NeedsYouPill machine={machine} />
          {m.link.value !== 'connected' && <LinkPill />}
        </div>
      )}
      <Tabs machine={machine.id} open={agent} />
      {a?.running ? (
        <Screen agent={agent} driving={driving} history={history} onHistory={() => void showHistory()} onLive={() => setHistory(null)} onKey={key} box={box} />
      ) : (
        // Its pane closed, as the TUI's does; its work stays on the tree.
        <div class="ended">
          {a && <p class="ended-said">{fill('agent.ended', { harness: a.harness })}</p>}
          <button class="tree-act" type="button" onClick={() => swap({ name: 'tree', machine: machine.id })}>{w('web.agent.back')}</button>
        </div>
      )}
      {a?.turn === 'waiting' && (
        // While the agent waits for its person (its hooks say so; the screen is never read).
        <div class="answer-strip" role="toolbar" aria-label="Answer">
          <span class="label">{w('title.needs_you').toUpperCase()}</span>
          <span class="spacer" />
          {ANSWER.map(({ label, name }) => (
            <button key={name} class="fab7-key" type="button" aria-label={name} onClick={() => press(name, key)}>
              {label}
            </button>
          ))}
        </div>
      )}
      {typing && (
        // On top of the on-screen keyboard while the message box has focus (§6).
        // A tap on it must not take the focus, or the keyboard would close.
        <div class="keys-on-keyboard" onPointerDown={(e) => e.preventDefault()} onMouseDown={(e) => e.preventDefault()}>
          <KeyBar send={key} />
        </div>
      )}
      {said && <p class="tree-said" role="status">{said}</p>}
      <form class="message-row" onSubmit={sendText}>
        <button class="fab7-key" type="button" aria-label="The bar" onClick={() => setBar(true)}>⌃</button>
        <label for="message" style={{ position: 'absolute', left: '-9999px' }}>Message</label>
        <input
          id="message"
          ref={input}
          class="field"
          value={message}
          onInput={(e) => setMessage((e.target as HTMLInputElement).value)}
          onFocus={() => setTyping(true)}
          onBlur={() => setTyping(false)}
          onBeforeInput={(e) => {
            // With Ctrl or Alt lit, a typed character is a key for the agent (§6).
            const bytes = e.data ? typed(e.data, mods.value) : null;
            if (!bytes) return;
            e.preventDefault();
            key(bytes);
            mods.value = sent(mods.value);
          }}
          placeholder={fill('web.agent.message', { harness: a?.harness ?? '' })}
          style={{ flex: 1, minWidth: 0 }}
        />
        <button class="fab7-button" type="submit" aria-label={w('act.send')}>▶</button>
      </form>
      {bar && (
        <BarSheet
          onClose={() => setBar(false)}
          acts={acts}
          keys={<KeyBar send={key} />}
        />
      )}
    </div>
  );
}
