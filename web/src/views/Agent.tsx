import { useEffect, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import type { Machine } from '../api';
import * as m from '../machine';
import { back, swap } from '../nav';
import { openKeys, said as actSaid } from './Bar';
import { asking } from './Ask';
import { KeyBar, press } from './Keys';
import { notSetUp } from './Tabs';
import { AgentList, AgentName, Dots, useSwipe } from './Agents';
import { ANSWER } from '../keys';
import { Screen } from './Screen';
import { HeaderPills } from './Status';
import { MessageRow, b64, notLive, refusal } from './Message';
import { fill, w } from '../words';
import { Conversation, ViewSwitch, view } from './Conversation';

/**
 * One agent. On a desktop, `embedded` beside the tree under `head`, its
 * pane's tab bar; of several panes (`side`), `current` is the pane you are
 * in, a press in another calls `onPick`, and no answer strip is drawn: its
 * screen and the bar's Keys answer it.
 */
export function Agent({ machine, agent, embedded = false, current = true, onPick, head, side = false }: { machine: Machine; agent: string; embedded?: boolean; current?: boolean; onPick?: (e: PointerEvent) => void; head?: ComponentChildren; side?: boolean }) {
  const a = m.agents.value.find((x) => x.agent === agent);
  // Nothing goes to an agent that has ended.
  const live = m.link.value === 'connected' && Boolean(a?.running);
  const box = useRef<HTMLDivElement>(null);
  const [history, setHistory] = useState<string | null>(null);
  // At the top of the history, with nothing older to read (M3.6).
  const [top, setTop] = useState(false);
  // The key the agent's harness reads its own history with, as the machine names it.
  const [transcript, setTranscript] = useState<string | null>(null);
  const [typing, setTyping] = useState(false);
  // On a phone, the list of agents over the view.
  const [list, setList] = useState(false);
  const swipe = useSwipe(machine.id, agent);

  // Why nothing went, as the TUI says it (M10.2); the next press clears it.
  const [mine, setSaid] = useState<string | null>(null);
  // An act's why, on a phone, where no tree bar is drawn to say it.
  const said = mine ?? (embedded ? null : actSaid.value);
  // A key, from the key bar, the answer strip or the screen: its refusal is said here.
  const key = (bytes: number[]) => {
    setSaid(null);
    if (!live) return setSaid(notLive(a));
    void m.request({ type: 'keys', agent, bytes: b64(bytes) })?.then((r) => setSaid(refusal(r)));
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
  const talk = view.value === 'conversation';
  // The key bar is only under Terminal (M12.1).
  const keys = typing || (!wide && !talk && Boolean(a?.running));
  const unset = a?.running && notSetUp(a);
  return (
    <div class={wide ? 'app agent agent--wide' : 'app agent'} style={embedded ? { height: '100%' } : undefined} onPointerDownCapture={onPick}>
      {!embedded && (
        // The header and the dots: a swipe on them moves to the next agent or the previous one.
        <div class="agent-head" {...swipe}>
          <div class="appbar">
            <button class="back" type="button" onClick={back}>{w('web.back.tree')}</button>
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
      {embedded && head}
      {talk ? (
        // Conversation, of a running agent or one that has ended alike.
        <div class="pane-wrap">
          {!wide && <ViewSwitch wide={false} />}
          <Conversation key={agent} agent={agent} wide={wide} />
        </div>
      ) : a?.running ? (
        <div class="pane-wrap">
          {!wide && <ViewSwitch wide={false} />}
          <Screen agent={agent} current={current} bars={!embedded} history={history} onHistory={() => void showHistory()} onTop={() => setTop(true)} onLive={() => (setHistory(null), setTop(false))} onKey={key} box={box} />
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
        // which a desktop has beside it (D3.7). Its Conversation is a switch away (M3.7).
        <>
        {!wide && <div class="ended-switch"><ViewSwitch wide={false} /></div>}
        <div class="ended">
          {a && <p class="ended-said">{fill('agent.ended', { harness: a.harness })}</p>}
          {!wide && <button class="tree-act" type="button" onClick={() => swap({ name: 'tree', machine: machine.id })}>{w('web.agent.back')}</button>}
        </div>
        </>
      )}
      {!side && !talk && a?.turn === 'waiting' && a.running && m.link.value === 'connected' && (
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
      {/* On a phone the agent's own message row; on a desktop one under the panes (D15.1), and here only a key's why. */}
      {!wide ? (
        <MessageRow agent={agent} wide={false} said={said} clear={() => setSaid(null)} onTyping={setTyping} keys={keys} />
      ) : (
        said && (
          <div class="message-foot message-foot--said">
            <p class="tree-said message-said" role="status">{said}</p>
          </div>
        )
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
