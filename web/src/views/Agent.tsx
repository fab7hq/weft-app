import { useEffect, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import type { Machine } from '../api';
import * as m from '../machine';
import { back, swap } from '../nav';
import { openKeys, said as actSaid } from './Bar';
import { asking } from './Ask';
import { KeyBar, mods, press } from './Keys';
import { notSetUp, Tabs } from './Tabs';
import { AgentList, AgentName, Dots, useSwipe } from './Agents';
import { ANSWER, sent, typed } from '../keys';
import { Screen, fit } from './Screen';
import { HeaderPills } from './Status';
import { fill, w } from '../words';

export const b64 = (bytes: number[]) => btoa(String.fromCharCode(...bytes));


/** Before a device's first key for an agent: its size (remote.md §9). */
const sized = new Set<string>();

/**
 * One agent. On a desktop, `embedded` beside the tree; of two side by side (`side`),
 * `current` is the side with the keys, a press in the other calls `onPick`,
 * `head` names it in place of the tabs, and no answer strip is drawn: its
 * screen and the bar's Keys answer it.
 */
export function Agent({ machine, agent, embedded = false, current = true, onPick, head, side = false }: { machine: Machine; agent: string; embedded?: boolean; current?: boolean; onPick?: (e: PointerEvent) => void; head?: ComponentChildren; side?: boolean }) {
  const a = m.agents.value.find((x) => x.agent === agent);
  // Nothing goes to an agent that has ended.
  const live = m.link.value === 'connected' && Boolean(a?.running);
  const driving = m.control.value[agent] === 'you';
  if (!driving) sized.delete(agent);
  const box = useRef<HTMLDivElement>(null);
  const [message, setMessage] = useState('');
  const field = useRef<HTMLTextAreaElement>(null);
  const [history, setHistory] = useState<string | null>(null);
  // At the top of the history, with nothing older to read (M3.6).
  const [top, setTop] = useState(false);
  // The key the agent's harness reads its own history with, as the machine names it.
  const [transcript, setTranscript] = useState<string | null>(null);
  const [typing, setTyping] = useState(false);
  // On a phone, the list of agents over the view.
  const [list, setList] = useState(false);
  const swipe = useSwipe(machine.id, agent);

  const takeKeys = () => {
    if (sized.has(agent) || !box.current) return;
    // The terminal's own area, inside the pane's padding, as `watch` measured it.
    const { rows, cols } = fit((box.current.firstElementChild as HTMLElement | null) ?? box.current);
    if (m.send({ type: 'size', agent, rows, cols })) sized.add(agent);
  };
  // Why nothing went, as the TUI says it (M10.2); the next press clears it.
  const [mine, setSaid] = useState<string | null>(null);
  // An act's why, on a phone, where no tree bar is drawn to say it.
  const said = mine ?? (embedded ? null : actSaid.value);
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
  // The box grows with its lines up to five, then scrolls inside (M3.13).
  useEffect(() => {
    const el = field.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [message]);
  // Enter sends where a keyboard is attached and adds a line on a touch screen;
  // Shift+Enter adds a line everywhere (D3.13).
  const enter = (e: KeyboardEvent) => {
    if (e.key !== 'Enter' || e.shiftKey || e.isComposing) return;
    if (matchMedia('(pointer: coarse)').matches) return;
    sendText(e);
  };
  const showHistory = async () => {
    const answer = await m.request({ type: 'read', agent, what: 'history' });
    if (answer?.type !== 'ok') return;
    setTranscript(typeof answer.transcript === 'string' && answer.transcript ? answer.transcript : null);
    setHistory(String(answer.text ?? ''));
  };

  // On a desktop the bar's Keys send here.
  useEffect(() => {
    if (!embedded || !current) return;
    openKeys.value = key;
    return () => {
      // Of two side by side, the other may have taken them already.
      if (openKeys.value === key) openKeys.value = null;
    };
  });

  const wide = embedded;
  const keys = typing || (!wide && Boolean(a?.running));
  const unset = a?.running && notSetUp(a);
  return (
    <div class={wide ? 'app agent agent--wide' : 'app agent'} style={embedded ? { height: '100%' } : undefined} onPointerDownCapture={current ? undefined : onPick}>
      {!embedded && (
        // The header and the dots: a swipe on them moves to the next agent or the previous one.
        <div class="agent-head" {...swipe}>
          <div class="appbar">
            <button class="back" type="button" onClick={back}>{`‹ ${a?.project ?? machine.name}`}</button>
            <span class="agent-name-at">
              <AgentName agent={a} onOpen={() => setList(true)} />
            </span>
            {m.link.value !== 'connected' && <HeaderPills machine={machine} />}
            {/* Ask into this agent (M3.11). */}
            <button class="tree-act appbar-ask" type="button" onClick={() => (asking.value = { agent, project: a?.project })}>
              {w('act.ask')}
            </button>
          </div>
          <Dots open={agent} />
        </div>
      )}
      {!embedded && list && <AgentList machine={machine.id} open={agent} onClose={() => setList(false)} />}
      {embedded && (head ?? <Tabs machine={machine.id} open={agent} />)}
      {a?.running ? (
        <div class="pane-wrap">
          <Screen agent={agent} driving={driving} current={current} history={history} onHistory={() => void showHistory()} onTop={() => setTop(true)} onLive={() => (setHistory(null), setTop(false))} onKey={key} box={box} />
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
      {!side && a?.turn === 'waiting' && a.running && m.link.value === 'connected' && (
        // While the agent waits for its person (its hooks say so; the screen is never read),
        // as the machine says now: not while it is being reached again (M1.8, D1.8).
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
        <div class={`message-foot${said ? ' message-foot--said' : ''}${keys ? ' message-foot--keys' : ''}`}>
          {said && <p class="tree-said message-said" role="status">{said}</p>}
          {(a?.running || !wide) && (
            <form class="message-row" onSubmit={sendText}>
              <label for={`message-${agent}`} style={{ position: 'absolute', left: '-9999px' }}>{w('web.agent.message_box')}</label>
              <textarea
                id={`message-${agent}`}
                ref={field}
                rows={1}
                class="message-input"
                value={message}
                onInput={(e) => (setMessage((e.target as HTMLTextAreaElement).value), setSaid(null))}
                onKeyDown={enter}
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
              {/* After a refusal, on a phone, the box stands without ▶ until it is used again (M10.2). */}
              {!(said && !wide) && <button class="send-key" type="submit" aria-label={w('act.send')} onMouseDown={(e) => e.preventDefault()}>▶</button>}
            </form>
          )}
        </div>
      )}
      {keys && (
        // On a phone, always under the message row (M3.11); on a tablet, on
        // top of the on-screen keyboard while the message box has focus (§6).
        // A tap on it must not take the focus, or the keyboard would close.
        <div class={typing ? 'keys-on-keyboard' : 'keys-on-keyboard keys-at-rest'} onPointerDown={(e) => e.preventDefault()} onMouseDown={(e) => e.preventDefault()}>
          <KeyBar send={key} />
        </div>
      )}
    </div>
  );
}
