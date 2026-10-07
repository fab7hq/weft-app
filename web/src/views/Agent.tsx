import { useEffect, useRef, useState } from 'preact/hooks';
import type { Machine } from '../api';
import * as m from '../machine';
import { back, swap } from '../nav';
import { BarSheet, openKeys, type BarActs } from './Bar';
import { asking } from './Ask';
import { KeyBar, mods, press } from './Keys';
import { notSetUp, Tabs } from './Tabs';
import { ANSWER, sent, typed } from '../keys';
import { Screen, fit } from './Screen';
import { HeaderPills } from './Status';
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
  // At the top of the history, with nothing older to read (M3.6).
  const [top, setTop] = useState(false);
  // The key the agent's harness reads its own history with, as the machine names it.
  const [transcript, setTranscript] = useState<string | null>(null);
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
    if (answer?.type !== 'ok') return;
    setTranscript(typeof answer.transcript === 'string' && answer.transcript ? answer.transcript : null);
    setHistory(String(answer.text ?? ''));
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

  const wide = embedded;
  const unset = a?.running && notSetUp(a);
  return (
    <div class={wide ? 'app agent agent--wide' : 'app agent'} style={embedded ? { height: '100%' } : undefined}>
      {!embedded && (
        <div class="appbar">
          <button class="back" type="button" onClick={back}>{`‹ ${a?.project ?? machine.name}`}</button>
          <span class="spacer" />
          <HeaderPills machine={machine} />
        </div>
      )}
      <Tabs machine={machine.id} open={agent} />
      {a?.running ? (
        <div class="pane-wrap">
          <Screen agent={agent} driving={driving} history={history} onHistory={() => void showHistory()} onTop={() => setTop(true)} onLive={() => (setHistory(null), setTop(false))} onKey={key} box={box} />
          {history !== null && top && (
            // The top of what Weft holds: whose history it is, as the TUI says it (M3.6).
            <p class="pane-said" role="status">
              {transcript ? fill('web.agent.own_history', { harness: a.harness, key: transcript }) : fill('web.agent.nothing_scrolled', { harness: a.harness })}
            </p>
          )}
          {unset && (
            // The agent runs; nothing it does is recorded (M3.8).
            <p class="pane-said">{`${fill('why.not_set_up', { harness: a.harness })} ${fill('web.why.set_up_on', { machine: machine.name })}`}</p>
          )}
        </div>
      ) : (
        // Its pane closed, as the TUI's does; its work stays on the tree,
        // which a desktop has beside it (D3.7).
        <div class="ended">
          {a && <p class="ended-said">{fill('agent.ended', { harness: a.harness })}</p>}
          {!wide && <button class="tree-act" type="button" onClick={() => swap({ name: 'tree', machine: machine.id })}>{w('web.agent.back')}</button>}
        </div>
      )}
      {a?.turn === 'waiting' && a.running && (
        // While the agent waits for its person (its hooks say so; the screen is never read).
        <div class="answer-strip" role="toolbar" aria-label="Answer">
          <span class="answer-label">{w('title.needs_you').toUpperCase()}</span>
          {ANSWER.map(({ label, name }) => (
            <button key={name} class="agent-key" type="button" aria-label={name} onClick={() => press(name, key)}>
              {label}
            </button>
          ))}
        </div>
      )}
      {(a?.running || !wide || said) && (
        <div class={said ? 'message-foot message-foot--said' : 'message-foot'}>
          {said && <p class="tree-said message-said" role="status">{said}</p>}
          {(a?.running || !wide) && (
            <form class="message-row" onSubmit={sendText}>
              {/* The key bar below the row leaves with the focus: a press here
                  keeps it until the press is done, so the row does not move under it. */}
              {!wide && (
                <button class="agent-key" type="button" aria-label="The bar" onMouseDown={(e) => e.preventDefault()} onClick={() => (input.current?.blur(), setBar(true))}>
                  ⌃
                </button>
              )}
              <label for="message" style={{ position: 'absolute', left: '-9999px' }}>{w('web.agent.message_box')}</label>
              <input
                id="message"
                ref={input}
                class="message-input"
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
                placeholder={a?.running ? fill('web.agent.message', { harness: a.harness }) : w('web.agent.message_box')}
              />
              <button class="send-key" type="submit" aria-label={w('act.send')} onMouseDown={(e) => e.preventDefault()}>▶</button>
            </form>
          )}
        </div>
      )}
      {typing && (
        // On top of the on-screen keyboard while the message box has focus (§6).
        // A tap on it must not take the focus, or the keyboard would close.
        <div class="keys-on-keyboard" onPointerDown={(e) => e.preventDefault()} onMouseDown={(e) => e.preventDefault()}>
          <KeyBar send={key} />
        </div>
      )}
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
