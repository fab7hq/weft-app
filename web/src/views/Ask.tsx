// Ask (M4.1–M4.4, D4.1–D4.4): what to do, and SEND TO, the project's running
// agents and a new one of each harness; a follow-up names the work and the id
// it carries, and goes first to the agent that wrote it. A sheet on a
// phone; on a desktop a panel docked in the main column, under what is open.
import { signal } from '@preact/signals';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import * as m from '../machine';
import { act, acting } from './Asked';
import { said } from './Bar';
import { destinations, keyOf, SendTo, type Dest } from './SendTo';
import { own } from '../textkeys';
import { fill, w } from '../words';
import { draftOf, routeLabel, shownRules, type Sheet } from '../ask';

export interface Asking {
  /** The agent to send to first. */
  agent?: string;
  /** The project whose agents SEND TO lists. */
  project?: string;
  /** A follow-up: the work it is about, and the id it carries. */
  follow?: { unit: string; title: string; follows: string };
  /** The words it starts with, for the person to change. */
  words?: string;
}

/** The Ask being written, if any. */
export const asking = signal<Asking | null>(null);

/** A tablet or a desktop, where Wide docks the Ask (the same width Wide is drawn at). */
const wideQuery = matchMedia('(min-width: 768px)');
const wide = signal(wideQuery.matches);
wideQuery.addEventListener('change', (e) => (wide.value = e.matches));

/** On a phone: the sheet over a backdrop. */
/** Enter asks, as in the message row: Shift+Enter adds a line, and on a touch screen Enter does. */
function sendOnEnter(e: KeyboardEvent) {
  if (e.isComposing || own(e) !== 'send' || matchMedia('(pointer: coarse)').matches) return;
  e.preventDefault();
  (e.currentTarget as HTMLTextAreaElement).form?.requestSubmit();
}

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
  const [text, setText] = useState(asked.words ?? '');
  const [to, setTo] = useState<Dest | null>(asked.agent ? { agent: asked.agent } : (rows[0]?.dest ?? null));
  const box = useRef<HTMLTextAreaElement>(null);
  // On a desktop the panel opens ready to type; on a phone the person taps the box to type or dictate (M4.1 → M4.2).
  useLayoutEffect(() => {
    if (docked) box.current?.focus();
  }, [docked]);
  const close = () => (asking.value = null);
  const project = asked.project ?? m.agents.value.find((x) => x.agent === asked.agent)?.project;
  const harness = !to ? '' : 'agent' in to ? (m.agents.value.find((a) => a.agent === to.agent)?.harness ?? '') : to.start;
  // What the machine offers for the words, the harness and the route picked:
  // asked again as they change, a moment after the last keystroke.
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [route, setRoute] = useState<string | undefined>(undefined);
  const [plan, setPlan] = useState<string | null | undefined>(undefined);
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!project || !harness) return;
    const t = setTimeout(() => {
      void m.readSettings(project, 'ask', JSON.stringify({ harness, words: text, route })).then((r) => {
        if (r && !(r as { refused?: string }).refused) setSheet(r as Sheet);
      });
    }, 300);
    return () => clearTimeout(t);
  }, [project, harness, text, route]);
  // Open until the machine answers, Ask showing it is working; then the bar
  // takes its place, or the why above the acts says what went wrong.
  const send = async (e: Event) => {
    e.preventDefault();
    if (!text.trim() || !to || acting.value) return;
    // A new agent is started on the machine for it, then asked once it is ready.
    const where = 'agent' in to ? { agent: to.agent } : { project, start: to.start };
    const draft = sheet ? { draft: draftOf(sheet, { plan, removed }) } : {};
    const refused = await act(f ? { act: 'follow_up', ...where, unit: f.unit, text, ...draft } : { act: 'ask', ...where, text, ...draft });
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
      <textarea ref={box} id="ask-text" class={text ? 'ask-text ask-text--said' : 'ask-text'} value={text} onInput={(e) => setText((e.target as HTMLTextAreaElement).value)} onKeyDown={sendOnEnter} />
      {sheet && <AskDraft sheet={sheet} harness={harness} docked={docked} plan={plan} removed={removed} onRoute={setRoute} onPlan={setPlan} onRemoved={setRemoved} />}
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

/** The draft's ROUTE, PLAN, ROUTE RULES and PRACTICES (17.1): the route is the
 * person's pick, the harness's default first; route rules are shown and always
 * sent; a practice's × takes it out, and + rule puts back one taken out. */
function AskDraft({ sheet, harness, docked, plan, removed, onRoute, onPlan, onRemoved }: {
  sheet: Sheet; harness: string; docked: boolean; plan: string | null | undefined; removed: Set<string>;
  onRoute: (r: string) => void; onPlan: (p: string | null) => void; onRemoved: (r: Set<string>) => void;
}) {
  const [all, setAll] = useState(false);
  const [adding, setAdding] = useState(false);
  const shownPlan = plan === undefined ? (sheet.plan?.path ?? '') : (plan ?? '');
  const kept = sheet.practices.filter((r) => !removed.has(r.id));
  const out = sheet.practices.filter((r) => removed.has(r.id));
  const shown = shownRules(sheet.practices, removed, all);
  const without = (id: string) => onRemoved(new Set([...removed, id]));
  const back = (id: string) => onRemoved(new Set([...removed].filter((r) => r !== id)));
  const named = `${harness} · ${routeLabel(sheet.route)}`;
  return (
    <div class="ask-draft">
      <div class="ask-picks">
        <label class="ask-pick">
          <span class="ask-eyebrow">{w('ask.route')}</span>
          <select value={sheet.route} onChange={(e) => onRoute((e.target as HTMLSelectElement).value)}>
            {sheet.routes.map((r) => <option key={r} value={r}>{routeLabel(r)}</option>)}
          </select>
        </label>
        <label class="ask-pick ask-pick--plan">
          <span class="ask-eyebrow">{w('ask.plan')}</span>
          <select value={shownPlan} onChange={(e) => onPlan((e.target as HTMLSelectElement).value || null)}>
            <option value="">{w('ask.no_plan')}</option>
            {sheet.plans.map((p) => <option key={p.path} value={p.path}>{p.path}</option>)}
          </select>
        </label>
      </div>
      <div class="ask-rules-row">
        <span class="ask-eyebrow">{docked ? w('ask.route_rules') : `${w('ask.route_rules')} · ${named}`}</span>
        <ul class="ask-rules">
          {sheet.route_rules.map((r) => (
            <li key={r.id} class="ask-rule"><b>{r.label}</b><span class="ask-rule-text">{r.text}</span><span class="ask-rule-meta">{docked ? `${named} · ${w('ask.always')}` : w('ask.always')}</span></li>
          ))}
        </ul>
      </div>
      <div class="ask-rules-row">
        <span class="ask-eyebrow">{fill('ask.practices', { n: String(kept.length) })}</span>
        <ul class="ask-rules">
          {shown.map((r) => (
            <li key={r.id} class="ask-rule"><b>{r.label}</b><span class="ask-rule-text">{r.text}</span><button type="button" class="ask-rule-out" aria-label={r.label} onClick={() => without(r.id)}>×</button></li>
          ))}
          {!all && kept.length > shown.length && (
            <li class="ask-rule"><button type="button" class="ask-rule-more" onClick={() => setAll(true)}>{fill('ask.more', { n: String(kept.length - shown.length) })}</button></li>
          )}
          {adding && out.map((r) => (
            <li key={r.id} class="ask-rule ask-rule--out"><b>{r.label}</b><span class="ask-rule-text">{r.text}</span><button type="button" class="ask-rule-more" onClick={() => back(r.id)}>+</button></li>
          ))}
        </ul>
        {out.length > 0 && <button type="button" class="ask-rule-add" onClick={() => setAdding(!adding)}>{w('ask.add_rule')}</button>}
      </div>
    </div>
  );
}
