// An agent's two views (ADR-0031; M12.1–M12.4, D12.1–D12.3): Terminal, its
// screen, and Conversation, only the person's messages and the agent's
// replies, read from the harness's own transcript while shown and kept
// nowhere. The choice is this device's, the last one made.
import { signal } from '@preact/signals';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import * as m from '../machine';
import { clock } from '../bar';
import { Held, type Item, type Row, type Step, rows, spans } from '../conversation';
import { fill, w } from '../words';

type View = 'terminal' | 'conversation';

/** Where the choice is kept: in this browser only. */
const VIEW = 'weft.view';

/** The view an agent opens in on this device. */
export const view = signal<View>(((): View => {
  try {
    return localStorage.getItem(VIEW) === 'conversation' ? 'conversation' : 'terminal';
  } catch {
    return 'terminal';
  }
})());

export function choose(v: View): void {
  view.value = v;
  try {
    localStorage.setItem(VIEW, v);
  } catch {
    // Not kept: Terminal opens next time.
  }
}

/** Terminal | Conversation: full width under the header on a phone, beside the layout button on a desktop. */
export function ViewSwitch({ wide }: { wide: boolean }) {
  return (
    <div class={wide ? 'view-switch view-switch--wide' : 'view-switch'} role="tablist" aria-label={`${w('web.view.terminal')} | ${w('web.view.conversation')}`}>
      {(['terminal', 'conversation'] as const).map((v) => (
        <button key={v} type="button" role="tab" class="view-seg" aria-selected={view.value === v} onMouseDown={(e) => e.preventDefault()} onClick={() => choose(v)}>
          {w(`web.view.${v}`)}
        </button>
      ))}
    </div>
  );
}

/** A message's words, its code spans in mono. */
function Said({ text }: { text: string }) {
  return (
    <>
      {spans(text).map((s, n) => (s.code ? <code key={n} class="convo-code">{s.text}</code> : s.text))}
    </>
  );
}

const MARK: Record<Step['state'], string> = { done: '✓', failed: '✗', running: '' };

/** The steps between two messages: one line, opened in place to one line each. */
function Steps({ steps, wide }: { steps: Step[]; wide: boolean }) {
  const [open, setOpen] = useState(false);
  const count = steps.length === 1 ? w('web.steps.one') : fill('web.steps.many', { n: String(steps.length) });
  if (!open) {
    const first = steps.map((s) => `${s.tool} ${s.arg}`.trim()).join(', ');
    return (
      <button type="button" class={wide ? 'convo-steps convo-steps--wide' : 'convo-steps'} aria-expanded="false" onClick={() => setOpen(true)}>
        <span class="convo-steps-line">{`▸ ${count} · ${first}`}</span>
      </button>
    );
  }
  return (
    <div class={wide ? 'convo-steps convo-steps--open convo-steps--wide' : 'convo-steps convo-steps--open'}>
      <button type="button" class="convo-steps-head" aria-expanded="true" onClick={() => setOpen(false)}>{`▾ ${count}`}</button>
      {steps.map((s, n) => (
        <div key={n} class="convo-step" data-state={s.state}>
          <span class="convo-step-tool">{s.tool}</span>
          <span class="convo-step-arg">{s.arg}</span>
          {s.state === 'running' ? <span class="convo-running">{w('web.step.running')}</span> : <span class="convo-mark">{MARK[s.state]}</span>}
        </div>
      ))}
    </div>
  );
}

function Message({ row, harness, wide }: { row: Extract<Row, { kind: 'person' | 'agent' }>; harness: string; wide: boolean }) {
  const at = row.at === null ? null : clock(row.at);
  if (row.kind === 'person') {
    return (
      <div class="convo-you">
        <div class="convo-bubble"><Said text={row.text} /></div>
        {at && <div class="convo-time">{at}</div>}
      </div>
    );
  }
  return (
    <div class="convo-agent">
      {wide ? (
        <div class="convo-who">
          <span>{harness}</span>
          {at && <span class="convo-time">{at}</span>}
        </div>
      ) : (
        <div class="convo-who">{harness}</div>
      )}
      <div class="convo-text"><Said text={row.text} /></div>
      {!wide && at && <div class="convo-time">{at}</div>}
    </div>
  );
}

/** How far down the chat is, for a phone's scroll bar (M3.14): the thumb's top and height, in parts of the bar. */
type Thumb = { top: number; size: number };

/**
 * The conversation, opened at its end. Older pages come as the person
 * scrolls up; what the file adds comes while it is shown. Unread, or
 * unreadable, it says so in one line.
 */
export function Conversation({ agent, wide }: { agent: string; wide: boolean }) {
  const a = m.agents.value.find((x) => x.agent === agent);
  const harness = a?.harness ?? '';
  const held = useMemo(() => new Held(), [agent]);
  const [items, setItems] = useState<Item[]>([]);
  const [readable, setReadable] = useState<boolean | null>(null);
  const before = useRef<string | null>(null);
  const reading = useRef(false);
  const box = useRef<HTMLDivElement>(null);
  // At the end: what comes keeps it there.
  const atEnd = useRef(true);
  // Where the chat was before an older page went in above it.
  const from = useRef<number | null>(null);
  const [thumb, setThumb] = useState<Thumb | null>(null);
  const connected = m.link.value === 'connected';

  useEffect(() => {
    if (!connected) return;
    let gone = false;
    const newest = async () => {
      const answer = await m.request({ type: 'read', what: 'conversation', agent });
      if (gone) return;
      const page = answer?.type === 'ok' ? (answer.conversation as Record<string, unknown>) : null;
      if (!page || page.readable !== true) {
        setReadable(false);
        m.unfollow(agent);
        return;
      }
      held.clear();
      held.after((page.items as Item[]) ?? []);
      before.current = typeof page.before === 'string' ? page.before : null;
      atEnd.current = true;
      setItems(held.all());
      setReadable(true);
      if (typeof page.after === 'string') m.follow(agent, page.after);
    };
    const stop = m.hear((msg) => {
      if (msg.agent !== agent) return;
      if (msg.reset === true) return void newest();
      if (msg.readable === false) return setReadable(false);
      held.after((msg.items as Item[]) ?? []);
      setItems(held.all());
    });
    void newest();
    return () => {
      gone = true;
      stop();
      m.unfollow(agent);
    };
  }, [agent, connected]);

  const older = async () => {
    if (reading.current || !before.current) return;
    reading.current = true;
    const answer = await m.request({ type: 'read', what: 'conversation', agent, before: before.current });
    reading.current = false;
    const page = answer?.type === 'ok' ? (answer.conversation as Record<string, unknown>) : null;
    if (!page || page.readable !== true) return;
    from.current = box.current ? box.current.scrollHeight - box.current.scrollTop : null;
    held.before((page.items as Item[]) ?? []);
    before.current = typeof page.before === 'string' ? page.before : null;
    setItems(held.all());
  };

  const measure = () => {
    const el = box.current;
    if (!el) return;
    atEnd.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
    setThumb(el.scrollHeight > el.clientHeight ? { top: el.scrollTop / el.scrollHeight, size: el.clientHeight / el.scrollHeight } : null);
    if (el.scrollTop < 40) void older();
  };

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    if (from.current !== null) {
      el.scrollTop = el.scrollHeight - from.current;
      from.current = null;
    } else if (atEnd.current) {
      el.scrollTop = el.scrollHeight;
    }
    measure();
  }, [items, readable, a?.turn]);

  if (readable === false) {
    return (
      <div class={wide ? 'convo convo--wide' : 'convo'}>
        <p class="convo-unreadable">{fill('web.conversation.unreadable', { harness })}</p>
      </div>
    );
  }
  const waiting = a?.running && a.turn === 'waiting';
  return (
    <div class={wide ? 'convo convo--wide' : 'convo'}>
      <div class="convo-scroll" ref={box} onScroll={measure}>
        <div class="convo-column">
          {rows(items).map((row) =>
            row.kind === 'steps' ? <Steps key={row.id} steps={row.steps} wide={wide} /> : <Message key={row.id} row={row} harness={harness} wide={wide} />,
          )}
          {waiting && (
            // While the agent waits, its questions are answered in Terminal (M12.4).
            <p class="convo-waiting">
              {fill('web.waiting.for_you', { harness })}
              <button type="button" class="convo-answer" onClick={() => choose('terminal')}>{w('web.waiting.answer')}</button>
            </p>
          )}
        </div>
      </div>
      {!wide && (
        // Every phone agent screen has its scroll bar (M3.3, M3.14); its thumb shows where the chat is.
        <div class="convo-bar" aria-hidden="true">
          {thumb && <span style={{ top: `${thumb.top * 100}%`, height: `${thumb.size * 100}%` }} />}
        </div>
      )}
    </div>
  );
}
