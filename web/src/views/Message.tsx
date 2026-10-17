// The message row (M3.1, D15.1): one box and ▶ for an agent. On a phone it is
// under the agent; on a desktop there is one, under the panes, for the agent
// in front, its placeholder naming it. A message is `text`: the Mac pastes it
// and presses Enter. Weft owns the agent's size, so none is sent first.
import { useEffect, useRef, useState } from 'preact/hooks';
import * as m from '../machine';
import { mods } from './Keys';
import { sent, typed } from '../keys';
import { own } from '../textkeys';
import { fill, w } from '../words';

export const b64 = (bytes: number[]) => btoa(String.fromCharCode(...bytes));

/** Why nothing went, as the TUI says it (M10.2). */
export function refusal(answer: Record<string, unknown> | undefined): string | null {
  if (answer?.type !== 'error') return null;
  const key = `not_typed.${String(answer.code)}`;
  return w(key) === key ? String(answer.message) : w(key);
}

/** Why an agent takes nothing: it has ended, or the machine is not reached. */
export function notLive(a: m.Agent | undefined): string {
  return a && !a.running ? fill('agent.ended', { harness: a.harness }) : w('web.why.not_connected');
}

/** What each agent's message field holds, by agent, for this visit. */
const drafts = new Map<string, string>();

/** What each agent's field could show after its draft, by agent: kept, as the drafts are. */
const ghosts = new Map<string, { draft: string; text: string }>();

/** How long a draft stays the same before it is asked about. */
const SETTLED = 100;

/**
 * `said`: a why from elsewhere (a key, an act), shown above the row and
 * cleared by `clear` on the next use. `onTyping`: whether the box has focus,
 * for the phone's key bar.
 */
export function MessageRow({ agent, wide, said, clear, onTyping, keys = false }: { agent: string; wide: boolean; said?: string | null; clear?: () => void; onTyping?: (on: boolean) => void; keys?: boolean }) {
  const a = m.agents.value.find((x) => x.agent === agent);
  const live = m.link.value === 'connected' && Boolean(a?.running);
  // Each agent's own draft, brought back when it is in front again.
  const [message, setDraft] = useState(drafts.get(agent) ?? '');
  const setMessage = (text: string) => (text ? drafts.set(agent, text) : drafts.delete(agent), setDraft(text));
  useEffect(() => setDraft(drafts.get(agent) ?? ''), [agent]);
  const [mine, setMine] = useState<string | null>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  // A suggestion for this agent's draft, shown dim after the caret; one for
  // another agent or an older draft is never shown.
  const [, redraw] = useState(0);
  const ghost = ghosts.get(agent);
  const setGhost = (g: { draft: string; text: string } | null, of = agent) => (g ? ghosts.set(of, g) : ghosts.delete(of), redraw((n) => n + 1));
  const asked = useRef('');
  useEffect(() => {
    if (ghost && ghost.draft !== message) setGhost(null);
    // An empty field follows the agent's last reply: once its turn has ended, again after each turn.
    const ended = Boolean(a?.running) && a?.turn === 'ended';
    if (!message && !ended) return;
    const which = `${agent}\n${message}\n${message ? '' : a?.since ?? 0}`;
    const t = setTimeout(() => {
      if (asked.current === which) return;
      asked.current = which;
      const [forAgent, forDraft] = [agent, message];
      void m.request({ type: 'suggest', agent, draft: message })?.then((r) => {
        const text = r?.type === 'ok' && typeof r.text === 'string' ? r.text : '';
        if (text && drafts.get(forAgent) === (forDraft || undefined)) setGhost({ draft: forDraft, text }, forAgent);
      });
    }, SETTLED);
    return () => clearTimeout(t);
  }, [agent, message, a?.turn, a?.since]);
  const atEnd = !field.current || field.current.selectionStart === message.length;
  const shown = ghost && ghost.draft === message && atEnd ? ghost.text : null;
  const take = () => {
    if (!shown) return;
    setMessage(message + shown);
    setGhost(null);
    field.current?.focus();
  };
  const why = mine ?? said ?? null;
  const fresh = () => (setMine(null), clear?.());
  const key = (bytes: number[]) => {
    fresh();
    if (!live) return setMine(notLive(a));
    void m.request({ type: 'keys', agent, bytes: b64(bytes) })?.then((r) => setMine(refusal(r)));
  };
  const send = (e: Event) => {
    e.preventDefault();
    fresh();
    if (!message.trim()) return;
    if (!live) return setMine(notLive(a));
    const sending = m.request({ type: 'text', agent, text: message });
    if (sending) {
      setMessage('');
      void sending.then((r) => setMine(refusal(r)));
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
  // Shift+Enter adds a line everywhere (D3.13). Composing, Enter is the input method's.
  const enter = (e: KeyboardEvent) => {
    if (e.isComposing) return;
    // Tab takes the suggestion shown, Escape drops it; with none shown each is the browser's.
    if (shown && (own(e) === 'take' || own(e) === 'drop')) {
      e.preventDefault();
      return own(e) === 'take' ? take() : setGhost(null);
    }
    if (own(e) !== 'send') return;
    if (matchMedia('(pointer: coarse)').matches) return;
    send(e);
  };
  return (
    <div class={`message-foot${wide ? ' message-foot--wide' : ''}${why ? ' message-foot--said' : ''}${keys ? ' message-foot--keys' : ''}`}>
      {why && <p class="tree-said message-said" role="status">{why}</p>}
      <form class="message-row" onSubmit={send}>
        <label for="message-box" style={{ position: 'absolute', left: '-9999px' }}>{w('web.agent.message_box')}</label>
        <div class="message-field">
        <textarea
          id="message-box"
          ref={field}
          rows={1}
          class="message-input"
          value={message}
          onInput={(e) => (setMessage((e.target as HTMLTextAreaElement).value), fresh())}
          onKeyDown={enter}
          onFocus={() => onTyping?.(true)}
          onBlur={() => onTyping?.(false)}
          onBeforeInput={(e) => {
            // With Ctrl or Alt lit, a typed character is a key for the agent (§6).
            const bytes = e.data ? typed(e.data, mods.value) : null;
            if (!bytes) return;
            e.preventDefault();
            key(bytes);
            mods.value = sent(mods.value);
          }}
          placeholder={a?.running ? fill('web.agent.message', { harness: wide ? `${a.project} · ${a.harness}` : a.harness }) : w('web.agent.message_box')}
        />
        {shown && (
          // The words again, unseen, so the suggestion lands just after them.
          <div class="message-input message-mirror" aria-hidden="true" style={{ height: field.current?.style.height }}>
            <span class="message-typed">{message}</span>
            <span class="message-ghost">{shown}</span>
          </div>
        )}
        {shown && <button class="message-take" type="button" onMouseDown={(e) => e.preventDefault()} onClick={take}>{w('suggest.take')}</button>}
        </div>
        {/* After a refusal, on a phone, the box stands without ▶ until it is used again (M10.2). */}
        {!(why && !wide) && <button class="send-key" type="submit" aria-label={w('act.send')} onMouseDown={(e) => e.preventDefault()}>▶</button>}
      </form>
    </div>
  );
}
