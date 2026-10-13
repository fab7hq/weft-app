// Ask (M4.1–M4.4, D4.1–D4.4): what to do, and SEND TO, the project's running
// agents and a new one of each harness; a follow-up names the work and the id
// it carries, and goes first to the agent that wrote it. A sheet on a
// phone; on a desktop a panel docked in the main column, under what is open.
import { signal } from '@preact/signals';
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import * as m from '../machine';
import { act, acting } from './Asked';
import { said } from './Bar';
import { destinations, keyOf, SendTo, type Dest } from './SendTo';
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
  const f = asked.follow;
  const rows = destinations(asked.project, f ? asked.agent : undefined);
  const [text, setText] = useState('');
  const [to, setTo] = useState<Dest | null>(asked.agent ? { agent: asked.agent } : (rows[0]?.dest ?? null));
  const box = useRef<HTMLTextAreaElement>(null);
  // On a desktop the panel opens ready to type; on a phone the person taps the box to type or dictate (M4.1 → M4.2).
  useLayoutEffect(() => {
    if (docked) box.current?.focus();
  }, [docked]);
  const close = () => (asking.value = null);
  // Open until the machine answers, Ask showing it is working; then the bar
  // takes its place, or the why above the acts says what went wrong.
  const send = async (e: Event) => {
    e.preventDefault();
    if (!text.trim() || !to || acting.value) return;
    // A new agent is started on the machine for it, then asked once it is ready.
    const project = asked.project ?? m.agents.value.find((x) => x.agent === asked.agent)?.project;
    const where = 'agent' in to ? { agent: to.agent } : { project, start: to.start };
    const refused = await act(f ? { act: 'follow_up', ...where, unit: f.unit, text } : { act: 'ask', ...where, text });
    close();
    if (refused) said.value = String(refused.message);
  };
  const picked = to ? keyOf(to) : '';
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
          <SendTo rows={rows} to={picked} onPick={setTo} />
          <span class="spacer" />
          <button class="tree-act" type="button" onClick={close}>{w('act.cancel')}</button>
          <button class="tree-act tree-act--go" type="submit" aria-busy={acting.value ? true : undefined}>{w('act.ask')}</button>
        </div>
      ) : (
        <>
          <span class="ask-eyebrow" id="ask-to-label">{w('ask.send_to')}</span>
          <SendTo rows={rows} to={picked} onPick={setTo} />
          <div class="ask-acts">
            <button class="tree-act" type="button" onClick={close}>{w('act.cancel')}</button>
            <button class="tree-act tree-act--go" type="submit" aria-busy={acting.value ? true : undefined}>{w('act.ask')}</button>
          </div>
        </>
      )}
    </form>
  );
}
