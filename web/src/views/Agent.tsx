import { useEffect, useRef, useState } from 'preact/hooks';
import type { Machine } from '../api';
import * as m from '../machine';
import { back, go } from '../nav';
import { BarSheet, Label } from './Bar';
import { KeyBar, mods, press } from './Keys';
import { Tabs } from './Tabs';
import { ANSWER, sent, typed } from '../keys';
import { NeedsYou } from './Agents';
import { Screen, fit } from './Screen';
import { ConfirmSheet, RecordSheet, type EvalRecord } from './Sheets';
import { LinkPill } from './Status';

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
  const [record, setRecord] = useState<EvalRecord | null>(null);
  const [bar, setBar] = useState(false);
  const [typing, setTyping] = useState(false);
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

  /** An act; its pending is shown when the machine answers. */
  const act = async (which: 'ask' | 'eval' | 'seal', text?: string) => {
    if (!live) return;
    setRecord(null);
    const answer = await m.request({ type: 'act', agent, act: which, ...(text ? { text } : {}) });
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
  const openRecord = async () => {
    const answer = await m.request({ type: 'read', agent, what: 'eval' });
    if (answer?.type === 'ok' && answer.record) setRecord(answer.record as EvalRecord);
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
      void act('ask', message);
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
      {history === null ? (
        <Screen agent={agent} driving={driving} onHistory={() => void showHistory()} onKey={key} box={box} />
      ) : (
        <div style={{ flex: 1, minHeight: 0, margin: '0 8px', display: 'flex', flexDirection: 'column', border: '1px solid var(--fab7-line)', borderRadius: 'var(--fab7-radius-lg)' }}>
          <pre
            aria-label="History"
            ref={(el) => { if (el) el.scrollTop = el.scrollHeight; }}
            style={{ flex: 1, margin: 0, padding: '12px', overflow: 'auto', font: '400 12px/1.4 var(--font-mono)', whiteSpace: 'pre-wrap' }}
          >
            {history}
          </pre>
          <button class="fab7-button fab7-button--secondary" type="button" style={{ margin: '8px' }} onClick={() => setHistory(null)}>
            Back to the screen
          </button>
        </div>
      )}
      {a?.unit && a.turn === 'ended' && (
        // On cue (§7): the Ask on the board, once its turn has ended.
        <div class="cue" role="group" aria-label="On cue">
          <span class="cue-text">{a.unit.title} · {a.unit.eval == null ? 'ASKED' : 'EVALED'}</span>
          {a.unit.eval == null ? (
            <button class="fab7-button fab7-button--secondary" type="button" aria-label="Eval" disabled={!live} onClick={() => void act('eval')}><Label word="eval" /></button>
          ) : (
            <>
              <button class="fab7-button fab7-button--secondary" type="button" aria-label="Seal" disabled={!live} onClick={() => void act('seal')}><Label word="seal" /></button>
              <button class="fab7-button fab7-button--secondary" type="button" aria-label="Ask" disabled={!live} onClick={() => setAsking(true)}><Label word="ask" /></button>
            </>
          )}
        </div>
      )}
      {a?.turn === 'waiting' && (
        // While the agent waits for its person (its hooks say so; the screen is never read).
        <div class="answer-strip" role="toolbar" aria-label="Answer">
          <span class="label">NEEDS YOU</span>
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
          <button class="fab7-key" type="button" aria-label="Cancel" onClick={() => setAsking(false)}>✕</button>
        ) : (
          <button class="fab7-key" type="button" aria-label="The bar" onClick={() => setBar(true)}>⌃</button>
        )}
        <label for="message" style={{ position: 'absolute', left: '-9999px' }}>{asking ? 'What do you want done?' : 'Message'}</label>
        <input
          id="message"
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
          placeholder={asking ? 'What do you want done?' : a ? `Message ${a.title}` : 'Message'}
          disabled={!live}
          style={{ flex: 1, minWidth: 0 }}
        />
        <button class="fab7-button" type="submit" aria-label={asking ? 'Ask' : 'Send'} disabled={!live}>{asking ? 'Ask' : '▶'}</button>
      </form>
      {bar && (
        <BarSheet
          onClose={() => setBar(false)}
          acts={{
            live,
            unit: a?.unit,
            onAct: (which) => (which === 'ask' ? setAsking(true) : void act(which)),
            onRecord: () => void openRecord(),
            onList: embedded ? null : back,
            onHistory: () => void showHistory(),
            onWeft: () => go({ name: 'settings' }),
          }}
          keys={<KeyBar live={live} send={key} />}
        />
      )}
      {shown && (pending ?? kept) && <ConfirmSheet pending={(pending ?? kept)!} answered={answered} onAnswer={answer} />}
      {record && (
        <RecordSheet
          record={record}
          title={a?.unit?.title ?? ''}
          onSeal={() => void act('seal')}
          onAskAgain={() => {
            setRecord(null);
            setAsking(true);
          }}
          onClose={() => setRecord(null)}
        />
      )}
    </div>
  );
}
