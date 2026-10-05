import { useEffect, useRef, useState } from 'preact/hooks';
import type { Machine } from '../api';
import * as m from '../machine';
import { back, go, swap } from '../nav';
import { BarSheet, Label, wideActs, type BarActs } from './Bar';
import { KeyBar, mods, press } from './Keys';
import { Tabs } from './Tabs';
import { ANSWER, sent, typed } from '../keys';
import { NeedsYou } from './Agents';
import { Screen, fit } from './Screen';
import { ConfirmSheet } from './Sheets';
import { LinkPill } from './Status';
import { w } from '../words';

export const b64 = (bytes: number[]) => btoa(String.fromCharCode(...bytes));

const WORDS: Record<m.Agent['turn'], string> = { waiting: 'Needs you', working: 'Working', ready: 'Ready', ended: 'Ended' };

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
  const [shown, setShown] = useState<string | null>(null);
  const [answered, setAnswered] = useState(false);
  const [bar, setBar] = useState(false);
  const [typing, setTyping] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const pending = m.pendings.value.find((p) => p.id === shown) ?? null;
  const [kept, setKept] = useState<m.Pending | null>(null);
  if (pending && pending !== kept) setKept(pending);

  // A pending answered elsewhere closes the sheet, and says so.
  useEffect(() => {
    const r = m.resolved.value;
    if (!r || r.id !== shown || answered) return;
    setAnswered(true);
    const t = setTimeout(() => {
      setShown(null);
      setAnswered(false);
    }, 2500);
    return () => clearTimeout(t);
  }, [m.resolved.value, shown]);

  /** An Ask to this agent; its pending is shown when the machine answers. */
  const ask = async (text: string) => {
    if (!live) return;
    const answer = await m.request({ type: 'act', agent, act: 'ask', text });
    if (answer?.type === 'ok' && answer.pending) {
      setAnswered(false);
      setShown(String(answer.pending));
    }
  };
  const answer = (yes: boolean) => {
    if (!shown) return;
    void m.request({ type: 'resolve', pending: shown, yes });
    setShown(null);
  };

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

  const acts: BarActs = {
    live,
    onAsk: () => setAsking(true),
    onList: embedded ? null : back,
    onHistory: () => void showHistory(),
    onWeft: () => go({ name: 'settings' }),
  };
  // Wide: the bar under the list and the pane draws these acts.
  useEffect(() => {
    if (!embedded) return;
    wideActs.value = acts;
  });
  useEffect(() => () => {
    if (embedded) wideActs.value = null;
  }, []);
  // Ask puts the person in the message box.
  useEffect(() => {
    if (asking) input.current?.focus();
  }, [asking]);
  // While Weft has the keys (nothing focused that types), the TUI's keys act (§7).
  useEffect(() => {
    const keys = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey || t.closest('input, textarea, [tabindex="0"], [role="dialog"]')) return;
      const k = e.key.toLowerCase();
      const n = Number(k);
      const tab = n >= 1 && n <= 9 ? m.agents.value[n - 1] : undefined;
      const known: Record<string, () => void> = {
        a: acts.onAsk,
        h: acts.onHistory,
        w: acts.onWeft,
        l: () => (acts.onList ? acts.onList() : (document.querySelector('nav[aria-label="Agents"] button') as HTMLElement | null)?.focus()),
      };
      const run = tab ? () => tab.agent !== agent && swap({ name: 'agent', machine: machine.id, agent: tab.agent }) : known[k];
      if (!run) return;
      e.preventDefault();
      run();
    };
    addEventListener('keydown', keys);
    return () => removeEventListener('keydown', keys);
  });

  return (
    <div class="app" style={embedded ? { height: '100%' } : undefined}>
      {!embedded && (
        <div class="appbar">
          <button class="back" type="button" onClick={back}>‹ Agents</button>
          <span class="spacer" />
          <NeedsYou />
          <LinkPill />
        </div>
      )}
      <Tabs machine={machine.id} open={agent} />
      <div style={{ padding: '12px 16px 8px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: '17px', fontWeight: 600 }}>{a ? `${a.project} · ${a.title}` : 'This agent has gone'}</span>
          <span style={{ fontSize: '12px', color: driving ? 'var(--fab7-teal)' : 'var(--fab7-muted)' }}>
            {driving ? 'You have the keys' : "Watching at the machine's size"}
          </span>
        </div>
        {a && <span class={a.turn === 'waiting' ? 'fab7-pill fab7-pill--needs-you' : 'fab7-pill'}>{WORDS[a.turn]}</span>}
      </div>
      <Screen agent={agent} driving={driving} history={history} onHistory={() => void showHistory()} onLive={() => setHistory(null)} onKey={key} box={box} />
      {a?.turn === 'waiting' && (
        // While the agent waits for its person (its hooks say so; the screen is never read).
        <div class="answer-strip" role="toolbar" aria-label="Answer">
          <span class="label">{w('title.needs_you').toUpperCase()}</span>
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
      {shown && (pending ?? kept) && <ConfirmSheet pending={(pending ?? kept)!} answered={answered} onAnswer={answer} />}
    </div>
  );
}
