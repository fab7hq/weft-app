import { useEffect, useRef, useState } from 'preact/hooks';
import type { Machine } from '../api';
import * as m from '../machine';
import { back } from '../nav';
import { BarSheet, askHere, openKeys, type BarActs } from './Bar';
import { KeyBar, mods, press } from './Keys';
import { Tabs } from './Tabs';
import { ANSWER, sent, typed } from '../keys';
import { NeedsYouPill } from './Tree';
import { Screen, fit } from './Screen';
import { act } from './Asked';
import { LinkPill } from './Status';
import { w } from '../words';

export const b64 = (bytes: number[]) => btoa(String.fromCharCode(...bytes));


/** Before a device's first key for an agent: its size (remote.md §9). */
const sized = new Set<string>();

export function Agent({ machine, agent, embedded = false }: { machine: Machine; agent: string; embedded?: boolean }) {
  const a = m.agents.value.find((x) => x.agent === agent);
  const live = m.link.value === 'connected';
  const driving = m.control.value[agent] === 'you';
  if (!driving) sized.delete(agent);
  const box = useRef<HTMLDivElement>(null);
  const [message, setMessage] = useState('');
  const [history, setHistory] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [bar, setBar] = useState(false);
  const [typing, setTyping] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  /** An Ask to this agent; its pending is shown when the machine answers. */
  const ask = (text: string) => live && void act({ agent, act: 'ask', text });

  const takeKeys = () => {
    if (sized.has(agent) || !box.current) return;
    const { rows, cols } = fit(box.current);
    if (m.send({ type: 'size', agent, rows, cols })) sized.add(agent);
  };
  const key = (bytes: number[]) => {
    if (!live) return;
    takeKeys();
    void m.request({ type: 'keys', agent, bytes: b64(bytes) });
  };
  const sendText = (e: Event) => {
    e.preventDefault();
    if (!live || !message.trim()) return;
    if (asking) {
      void ask(message);
      setMessage('');
      setAsking(false);
      return;
    }
    takeKeys();
    if (m.request({ type: 'text', agent, text: message })) setMessage('');
  };
  const showHistory = async () => {
    const answer = await m.request({ type: 'read', agent, what: 'history' });
    if (answer?.type === 'ok') setHistory(String(answer.text ?? ''));
  };

  const acts: BarActs = { live, harness: a?.harness ?? '', onAsk: () => setAsking(true) };
  // On a desktop the bar's Keys send here.
  useEffect(() => {
    if (!embedded) return;
    openKeys.value = key;
    return () => {
      openKeys.value = null;
    };
  });
  // Ask puts the person in the message box.
  useEffect(() => {
    if (asking) input.current?.focus();
  }, [asking]);
  // Ask from the tree's bar: this agent, in the message box.
  useEffect(() => {
    if (!askHere.value) return;
    askHere.value = false;
    setAsking(true);
  }, [askHere.value]);

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
      {!a && <p class="note pane-said">This agent has gone</p>}
      <Screen agent={agent} driving={driving} history={history} onHistory={() => void showHistory()} onLive={() => setHistory(null)} onKey={key} box={box} />
      {a?.turn === 'waiting' && (
        // While the agent waits for its person (its hooks say so; the screen is never read).
        <div class="answer-strip" role="toolbar" aria-label="Answer">
          <span class="label">{w('title.needs_you').toUpperCase()}</span>
          <span class="spacer" />
          {ANSWER.map(({ label, name }) => (
            <button key={name} class="fab7-key" type="button" aria-label={name} disabled={!live} onClick={() => press(name, key)}>
              {label}
            </button>
          ))}
        </div>
      )}
      {typing && (
        // On top of the on-screen keyboard while the message box has focus (§6).
        // A tap on it must not take the focus, or the keyboard would close.
        <div class="keys-on-keyboard" onPointerDown={(e) => e.preventDefault()} onMouseDown={(e) => e.preventDefault()}>
          <KeyBar live={live} send={key} />
        </div>
      )}
      <form class="message-row" onSubmit={sendText}>
        {asking ? (
          <button class="fab7-key" type="button" aria-label={w('act.cancel')} onClick={() => setAsking(false)}>✕</button>
        ) : (
          <button class="fab7-key" type="button" aria-label="The bar" onClick={() => setBar(true)}>⌃</button>
        )}
        <label for="message" style={{ position: 'absolute', left: '-9999px' }}>{asking ? w('ask.title') : 'Message'}</label>
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
          placeholder={asking ? w('ask.title') : a ? `Message ${a.title}` : 'Message'}
          disabled={!live}
          style={{ flex: 1, minWidth: 0 }}
        />
        <button class="fab7-button" type="submit" aria-label={asking ? w('act.ask') : w('act.send')} disabled={!live}>{asking ? w('act.ask') : '▶'}</button>
      </form>
      {bar && (
        <BarSheet
          onClose={() => setBar(false)}
          acts={acts}
          keys={<KeyBar live={live} send={key} />}
        />
      )}
    </div>
  );
}
