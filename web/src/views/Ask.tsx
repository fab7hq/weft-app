// Ask (M4.1–M4.4, D4.1–D4.4): what to do, and SEND TO, the project's running
// agents; a follow-up names the work and the id it carries.
import { signal } from '@preact/signals';
import { useState } from 'preact/hooks';
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

export function AskSheet() {
  const a = asking.value;
  if (!a) return null;
  return <Sheet key={JSON.stringify(a)} asked={a} />;
}

function Sheet({ asked }: { asked: Asking }) {
  const agents = m.agents.value.filter((x) => x.running && (!asked.project || x.project === asked.project));
  const [text, setText] = useState('');
  const [to, setTo] = useState(asked.agent ?? agents[0]?.agent ?? '');
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
    <div class="sheet-backdrop" onClick={(e) => e.target === e.currentTarget && close()}>
      <form class="fab7-sheet ask-sheet" role="dialog" aria-label={w('ask.title')} onSubmit={send}>
        {f && <span class="label">{`${w('act.follow_up')} · ${f.title} · ${f.follows}`.toUpperCase()}</span>}
        <label class="ask-title" for="ask-text">{w('ask.title')}</label>
        <textarea id="ask-text" class="ask-text" value={text} autoFocus onInput={(e) => setText((e.target as HTMLTextAreaElement).value)} />
        <label class="label" for="ask-to">{w('ask.send_to')}</label>
        <select id="ask-to" class="ask-to" value={to} onChange={(e) => setTo((e.target as HTMLSelectElement).value)}>
          {agents.map((x) => (
            <option key={x.agent} value={x.agent}>{x.harness}</option>
          ))}
        </select>
        <div class="ask-acts">
          <button class="tree-act" type="button" onClick={close}>{w('act.cancel')}</button>
          <button class="tree-act tree-act--go" type="submit">{w('act.ask')}</button>
        </div>
      </form>
    </div>
  );
}
