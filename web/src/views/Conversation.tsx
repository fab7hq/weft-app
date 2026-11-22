// An agent's two views (ADR-0031; M12.1–M12.4, D12.1–D12.3): Terminal, its
// screen, and Conversation, only the person's messages and the agent's
// replies, read from the harness's own transcript while shown and kept
// nowhere. The choice is this device's, the last one made.
import { signal } from '@preact/signals';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import * as m from '../machine';
import { clock } from '../bar';
import { Markdown } from './Markdown';
import { Held, type Item, type Laid, type Place, type Row, type Step, gone, placeOf, rows, scrollFor, spans } from '../conversation';
import { fill, w } from '../words';
import { readOf } from '../waits';
import { go } from '../nav';
import { GLYPH, nameOf, sizeWord, type Ref } from '../viewer/kinds';
import { Coming, ReadFailed } from './Wait';

type View = 'terminal' | 'conversation';

/** Where the choice is kept: in this browser only. */
const VIEW = 'weft.view';

/** Where each agent's conversation was left on this device, while the page is open. */
const places = new Map<string, Place>();

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

/** The files an agent's message named: one chip each, wrapping; a chip opens its file. */
function Files({ agent, refs }: { agent: string; refs: Ref[] }) {
  const open = (ref: Ref) => {
    const machine = m.current.value;
    if (machine) go({ name: 'file', machine: machine.id, agent, ref });
  };
  return (
    <div class="convo-files">
      {refs.map((r) => (
        <button key={r.path} type="button" class="convo-file" title={r.path} onClick={() => open(r)}>
          <span class="convo-file-glyph" aria-hidden="true">{GLYPH[r.kind] ?? GLYPH.other}</span>
          <span class="convo-file-name">{nameOf(r.path)}</span>
          <span class="convo-file-size">{sizeWord(r.size)}</span>
        </button>
      ))}
    </div>
  );
}

const MARK: Record<Step['state'], string> = { done: '✓', failed: '✗', running: '' };

/** The steps between two messages: one line, opened in place to one line each. */
function Steps({ id, steps, wide }: { id: string; steps: Step[]; wide: boolean }) {
  const [open, setOpen] = useState(false);
  const count = steps.length === 1 ? w('web.steps.one') : fill('web.steps.many', { n: String(steps.length) });
  if (!open) {
    const first = steps.map((s) => `${s.tool} ${s.arg}`.trim()).join(', ');
    return (
      <button type="button" data-row={id} class={wide ? 'convo-steps convo-steps--wide' : 'convo-steps'} aria-expanded="false" onClick={() => setOpen(true)}>
        <span class="convo-steps-line">{`▸ ${count} · ${first}`}</span>
      </button>
    );
  }
  return (
    <div data-row={id} class={wide ? 'convo-steps convo-steps--open convo-steps--wide' : 'convo-steps convo-steps--open'}>
      <button type="button" class="convo-steps-head" aria-expanded="true" onClick={() => setOpen(false)}>{`▾ ${count}`}</button>
      {steps.map((s, n) => (
        <div key={n} class="convo-step" data-state={s.state}>
          {s.state === 'running' ? <span class="convo-running">{w('web.step.running')}</span> : <span class="convo-mark">{MARK[s.state]}</span>}
          <span class="convo-step-tool">{s.tool}</span>
          <span class="convo-step-arg">{s.arg}</span>
        </div>
      ))}
    </div>
  );
}

function Message({ row, agent, harness, waiting }: { row: Extract<Row, { kind: 'person' | 'agent' }>; agent: string; harness: string; waiting: boolean }) {
  const at = row.at === null ? null : clock(row.at);
  if (row.kind === 'person') {
    return (
      <div class="convo-you" data-row={row.id}>
        <div class="convo-who">
          <span class="convo-you-name">YOU</span>
          {at && <span class="convo-time">{at}</span>}
        </div>
        <div class="convo-text"><Said text={row.text} /></div>
      </div>
    );
  }
  // The last thing the agent said leads with its state: the square while it waits for you.
  return (
    <div class="convo-agent" data-row={row.id}>
      <div class="convo-who">
        <span class={waiting ? 'convo-name needs' : 'convo-name good'}>{`${waiting ? '■' : '●'} ${harness}`}</span>
        {at && <span class="convo-time">{at}</span>}
      </div>
      <div class="convo-text convo-md"><Markdown text={row.text} /></div>
      {row.refs && <Files agent={agent} refs={row.refs} />}
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
  // Why the first page, or an older one, could not be read; Try again reads it again.
  const [failed, setFailed] = useState<{ why: string; older: boolean } | null>(null);
  const [tries, setTries] = useState(0);
  // An older page is being read: lines breathe above the chat.
  const [paging, setPaging] = useState(false);
  const before = useRef<string | null>(null);
  const reading = useRef(false);
  const box = useRef<HTMLDivElement>(null);
  // At the end: what comes keeps it there.
  const atEnd = useRef(true);
  // Where the chat was before an older page went in above it.
  const from = useRef<number | null>(null);
  const [thumb, setThumb] = useState<Thumb | null>(null);
  // Away from its end: the button that takes it back there.
  const [away, setAway] = useState(false);
  // Where the person left this conversation, until it is shown there again.
  const wanted = useRef<Place>(places.get(agent) ?? null);
  const connected = m.link.value === 'connected';

  useEffect(() => {
    if (!connected) return;
    let gone = false;
    const newest = async () => {
      const answer = await m.request({ type: 'read', what: 'conversation', agent });
      if (gone) return;
      // A read that failed is not a conversation that cannot be shown: it says why.
      const r = readOf<Record<string, unknown>>(answer, 'conversation');
      if (r.failed) return setFailed({ why: r.failed, older: false });
      if (!r.got) return;
      const page = r.got;
      if (page.readable !== true) {
        setReadable(false);
        m.unfollow(agent);
        return;
      }
      held.clear();
      held.after((page.items as Item[]) ?? []);
      before.current = typeof page.before === 'string' ? page.before : null;
      atEnd.current = wanted.current === null;
      setItems(held.all());
      setReadable(true);
      setFailed(null);
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
  }, [agent, connected, tries]);

  // A page that failed is read again only on Try again (`retry`).
  const older = async (retry = false) => {
    if (reading.current || !before.current || (failed && !retry)) return;
    reading.current = true;
    setPaging(true);
    const answer = await m.request({ type: 'read', what: 'conversation', agent, before: before.current });
    reading.current = false;
    setPaging(false);
    const r = readOf<Record<string, unknown>>(answer, 'conversation');
    if (r.failed) return setFailed({ why: r.failed, older: true });
    const page = r.got;
    if (!page || page.readable !== true) return;
    from.current = box.current ? box.current.scrollHeight - box.current.scrollTop : null;
    held.before((page.items as Item[]) ?? []);
    before.current = typeof page.before === 'string' ? page.before : null;
    setItems(held.all());
  };

  /** The rows as drawn, in the scroll's content. */
  const laid = (el: HTMLElement): Laid[] => {
    const at = el.getBoundingClientRect().top - el.scrollTop;
    return [...el.querySelectorAll<HTMLElement>('[data-row]')].map((r) => {
      const b = r.getBoundingClientRect();
      return { id: r.dataset.row ?? '', top: b.top - at, bottom: b.bottom - at };
    });
  };

  const measure = () => {
    const el = box.current;
    if (!el) return;
    atEnd.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
    setAway(!atEnd.current);
    if (wanted.current === null && readable) places.set(agent, placeOf(laid(el), el.scrollTop, atEnd.current, items.at(-1)?.id));
    setThumb(el.scrollHeight > el.clientHeight ? { top: el.scrollTop / el.scrollHeight, size: el.clientHeight / el.scrollHeight } : null);
    if (el.scrollTop < 40) void older();
  };

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const back = wanted.current && readable ? scrollFor(wanted.current, laid(el)) : undefined;
    if (back !== undefined) {
      // Back where the person left it.
      el.scrollTop = back;
      wanted.current = null;
      from.current = null;
    } else if (wanted.current && readable) {
      // Not read yet: an older page, or its end once there is none or it is gone.
      if (before.current && !gone(wanted.current, items.map((i) => i.id))) void older();
      else (wanted.current = null), (atEnd.current = true), (el.scrollTop = el.scrollHeight);
    } else if (from.current !== null) {
      el.scrollTop = el.scrollHeight - from.current;
      from.current = null;
    } else if (atEnd.current) {
      el.scrollTop = el.scrollHeight;
    }
    measure();
  }, [items, readable, a?.turn]);

  const again = () => {
    const was = failed;
    setFailed(null);
    if (was?.older) void older(true);
    else setTries((n) => n + 1);
  };
  const failure = failed && <ReadFailed text={fill('wait.could_not_read', { why: failed.why })} again={again} />;
  // The first page still coming, or failed: said where the chat will be.
  if (readable === null) {
    return (
      <div class={wide ? 'convo convo--wide' : 'convo'}>
        <div class="convo-scroll">
          <div class="convo-column">{failure || <Coming />}</div>
        </div>
      </div>
    );
  }
  if (readable === false) {
    return (
      <div class={wide ? 'convo convo--wide' : 'convo'}>
        <p class="convo-unreadable">{fill('web.conversation.unreadable', { harness })}</p>
      </div>
    );
  }
  const waiting = a?.running && a.turn === 'waiting';
  const all = rows(items);
  const lastAgent = all.filter((r) => r.kind === 'agent').at(-1)?.id;
  return (
    <div class={wide ? 'convo convo--wide' : 'convo'}>
      <div class="convo-scroll" ref={box} onScroll={measure}>
        <div class="convo-column">
          {paging && <Coming lines={[60, 40]} />}
          {failed?.older && failure}
          {all.map((row) =>
            row.kind === 'steps' ? (
              <Steps key={row.id} id={row.id} steps={row.steps} wide={wide} />
            ) : <Message key={row.id} row={row} agent={agent} harness={harness} waiting={Boolean(waiting) && row.id === lastAgent} />,
          )}
          {waiting && <p class="convo-waiting">{w('web.waiting.for_you')}</p>}
        </div>
      </div>
      {away && (
        <button type="button" class={wide ? 'to-end to-end--wide' : 'to-end'} aria-label={w('panes.to_end')} onClick={() => box.current && (box.current.scrollTop = box.current.scrollHeight)}>
          ↓
        </button>
      )}
      {!wide && (
        // Every phone agent screen has its scroll bar (M3.3, M3.14); its thumb shows where the chat is.
        <div class="convo-bar" aria-hidden="true">
          {thumb && <span style={{ top: `${thumb.top * 100}%`, height: `${thumb.size * 100}%` }} />}
        </div>
      )}
    </div>
  );
}
