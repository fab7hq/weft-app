// Ask (M4.1–M4.4, D4.1–D4.4): what to do, and SEND TO, the project's running
// agents; a follow-up names the work and the id it carries. A sheet on a
// phone; on a desktop a panel docked in the main column, under what is open.
import { signal } from '@preact/signals';
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import * as m from '../machine';
import { act } from './Asked';
import { w } from '../words';

export interface Asking {
  /** The agent to send to first. */
  agent?: string;
  /** The project whose agents SEND TO lists. */
  project?: string;
  /** A follow-up: the work it is about, and the id it carries. */
  follow?: { unit: string; title: string; follows: string };
}

/** The Ask being written, if any. */
export const asking = signal<Asking | null>(null);

/** A tablet or a desktop, where Wide docks the Ask (the same width Wide is drawn at). */
const wideQuery = matchMedia('(min-width: 768px)');
const wide = signal(wideQuery.matches);
wideQuery.addEventListener('change', (e) => (wide.value = e.matches));

/** On a phone: the sheet over a backdrop. */
export function AskSheet() {
  const a = asking.value;
  if (!a || wide.value) return null;
  return (
    <div class="sheet-backdrop ask-backdrop" onClick={(e) => e.target === e.currentTarget && (asking.value = null)}>
      <AskForm key={JSON.stringify(a)} asked={a} docked={false} />
    </div>
  );
}

/** On a desktop: the panel under the main column's view (D4.1). */
export function AskDock() {
  const a = asking.value;
  if (!a || !wide.value) return null;
  return <AskForm key={JSON.stringify(a)} asked={a} docked />;
}

function AskForm({ asked, docked }: { asked: Asking; docked: boolean }) {
  const agents = m.agents.value.filter((x) => x.running && (!asked.project || x.project === asked.project));
  const [text, setText] = useState('');
  const [to, setTo] = useState(asked.agent ?? agents[0]?.agent ?? '');
  const box = useRef<HTMLTextAreaElement>(null);
  // On a desktop the panel opens ready to type; on a phone the person taps the box to type or dictate (M4.1 → M4.2).
  useLayoutEffect(() => {
    if (docked) box.current?.focus();
  }, [docked]);
  const close = () => (asking.value = null);
  const send = (e: Event) => {
    e.preventDefault();
    if (!text.trim() || !to) return;
    close();
    const f = asked.follow;
    void act(f ? { act: 'follow_up', agent: to, unit: f.unit, text } : { act: 'ask', agent: to, text });
  };
  const f = asked.follow;
  return (
    <form
      class={docked ? 'ask-panel ask-panel--docked' : 'fab7-sheet ask-panel ask-sheet'}
      role="dialog"
      aria-label={w('ask.title')}
      onSubmit={send}
      onKeyDown={(e) => e.key === 'Escape' && close()}
    >
      {f && <span class="ask-eyebrow">{`${w('act.follow_up')} · ${f.title} · ${f.follows}`.toUpperCase()}</span>}
      <label class="ask-title" for="ask-text">{w('ask.title')}</label>
      <textarea ref={box} id="ask-text" class={text ? 'ask-text ask-text--said' : 'ask-text'} value={text} onInput={(e) => setText((e.target as HTMLTextAreaElement).value)} />
      {docked ? (
        <div class="ask-row">
          <span class="ask-eyebrow" id="ask-to-label">{w('ask.send_to')}</span>
          <SendTo agents={agents} to={to} onPick={setTo} />
          <span class="spacer" />
          <button class="tree-act" type="button" onClick={close}>{w('act.cancel')}</button>
          <button class="tree-act tree-act--go" type="submit">{w('act.ask')}</button>
        </div>
      ) : (
        <>
          <span class="ask-eyebrow" id="ask-to-label">{w('ask.send_to')}</span>
          <SendTo agents={agents} to={to} onPick={setTo} />
          <div class="ask-acts">
            <button class="tree-act" type="button" onClick={close}>{w('act.cancel')}</button>
            <button class="tree-act tree-act--go" type="submit">{w('act.ask')}</button>
          </div>
        </>
      )}
    </form>
  );
}

/**
 * SEND TO (M4.3, D4.3): the picked agent with ▾; open, the running agents in
 * its place, the picked one ✓. A button that opens a listbox, as a select is
 * read: arrows move, Enter or Space picks, Escape or Tab closes.
 */
function SendTo({ agents, to, onPick }: { agents: m.Agent[]; to: string; onPick: (agent: string) => void }) {
  const [open, setOpen] = useState(false);
  const at = Math.max(0, agents.findIndex((x) => x.agent === to));
  const [active, setActive] = useState(at);
  const list = useRef<HTMLUListElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const back = useRef(false);
  // The focus moves with the list as soon as it is drawn.
  useLayoutEffect(() => {
    if (open) list.current?.focus();
    else if (back.current) {
      back.current = false;
      button.current?.focus();
    }
  }, [open]);
  const show = (i = at) => {
    setActive(i);
    setOpen(true);
  };
  const shut = (focus: boolean) => {
    back.current = focus;
    setOpen(false);
  };
  const pick = (i: number) => {
    const x = agents[i];
    if (x) onPick(x.agent);
    shut(true);
  };
  if (!open) {
    const picked = agents[at];
    return (
      <button
        ref={button}
        type="button"
        class="ask-to"
        aria-haspopup="listbox"
        aria-expanded="false"
        aria-labelledby="ask-to-label ask-to-value"
        onClick={() => show()}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            show();
          }
        }}
      >
        <span id="ask-to-value" class="ask-to-name">{picked?.harness ?? ''}</span>
        <span class="ask-to-arrow" aria-hidden="true">▾</span>
      </button>
    );
  }
  return (
    <ul
      ref={list}
      class="ask-to ask-to--open"
      role="listbox"
      tabIndex={-1}
      aria-labelledby="ask-to-label"
      aria-activedescendant={`ask-to-${active}`}
      // Leaving the list closes it; a pick or Escape, closing it already, takes the focus back.
      onBlur={(e) => !back.current && !list.current?.contains(e.relatedTarget as Node | null) && shut(false)}
      onKeyDown={(e) => {
        const last = agents.length - 1;
        const keys: Record<string, () => void> = {
          ArrowDown: () => setActive(Math.min(last, active + 1)),
          ArrowUp: () => setActive(Math.max(0, active - 1)),
          Home: () => setActive(0),
          End: () => setActive(last),
          Enter: () => pick(active),
          ' ': () => pick(active),
          Escape: () => shut(true),
        };
        const go = keys[e.key];
        if (e.key === 'Tab') return shut(false);
        if (!go) return;
        e.preventDefault();
        // Escape closes the list, not the Ask around it.
        e.stopPropagation();
        go();
      }}
    >
      {agents.map((x, i) => (
        <li
          key={x.agent}
          id={`ask-to-${i}`}
          role="option"
          aria-selected={x.agent === to}
          class={i === active ? 'ask-to-option ask-to-option--active' : 'ask-to-option'}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => pick(i)}
        >
          {x.harness}
        </li>
      ))}
    </ul>
  );
}
