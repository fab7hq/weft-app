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
import { canAsk, draftOf, isIn, moreCount, routeLabel, sensing, shownRules, type Picked, type Sheet } from '../ask';

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
  // The words the sheet shown was made for: while they differ, Sense reads the new ones (17.23).
  const [sheetFor, setSheetFor] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [route, setRoute] = useState<string | undefined>(undefined);
  const [plan, setPlan] = useState<string | null | undefined>(undefined);
  const [kept, setKept] = useState<Picked>(new Map());
  useEffect(() => {
    if (!project || !harness) return;
    const words = text;
    const t = setTimeout(() => {
      void m.readSettings(project, 'ask', JSON.stringify({ harness, words, route })).then((r) => {
        if (r && !(r as { refused?: string }).refused) {
          setSheet(r as Sheet);
          setSheetFor(words);
        }
      });
    }, 300);
    return () => clearTimeout(t);
  }, [project, harness, text, route]);
  const reading = sensing(sheet, sheetFor, text, picking || route !== undefined);
  const askable = canAsk(sheet) && !reading;
  // Open until the machine answers, Ask showing it is working; then the bar
  // takes its place, or the why above the acts says what went wrong.
  const send = async (e: Event) => {
    e.preventDefault();
    if (!text.trim() || !to || acting.value || !askable) return;
    // A new agent is started on the machine for it, then asked once it is ready.
    const where = 'agent' in to ? { agent: to.agent } : { project, start: to.start };
    const draft = sheet ? { draft: draftOf(sheet, { plan, picked: kept }) } : {};
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
      {reading && <Sensing onPick={() => setPicking(true)} />}
      {sheet && !reading && <AskDraft sheet={sheet} harness={harness} docked={docked} plan={plan} picked={kept} onRoute={setRoute} onPlan={setPlan} onPicked={setKept} />}
      {sheet && !reading && sheet.route === null && <span class="ask-hint">{w('ask.pick_to_ask')}</span>}
      {docked ? (
        <div class="ask-row">
          <span class="ask-eyebrow" id="ask-to-label">{w('ask.send_to')}</span>
          <SendTo rows={rows} to={picked} onPick={setTo} />
          <span class="spacer" />
          <button class="tree-act" type="button" onClick={close}>{w('act.cancel')}</button>
          <button class={askable ? 'tree-act tree-act--go' : 'tree-act tree-act--go tree-act--waiting'} type="submit" aria-busy={acting.value ? true : undefined}>{w('act.ask')}</button>
        </div>
      ) : (
        <>
          <span class="ask-eyebrow" id="ask-to-label">{w('ask.send_to')}</span>
          <SendTo rows={rows} to={picked} onPick={setTo} />
          <div class="ask-acts">
            <button class="tree-act" type="button" onClick={close}>{w('act.cancel')}</button>
            <button class={askable ? 'tree-act tree-act--go' : 'tree-act tree-act--go tree-act--waiting'} type="submit" aria-busy={acting.value ? true : undefined}>{w('act.ask')}</button>
          </div>
        </>
      )}
    </form>
  );
}

/** Sense reading the words (17.23): one panel where the route, its rules and
 * the practices will be; the person may pick a route themselves instead. */
function Sensing({ onPick }: { onPick: () => void }) {
  return (
    <div class="ask-sensing-wrap">
      <div class="ask-sensing" role="status">
        <span class="ask-sensing-dots" aria-hidden="true"><i /><i /><i /></span>
        <b>{w('ask.sensing')}</b>
        <span class="ask-sensing-line">{w('ask.sensing_line')}</span>
      </div>
      <button type="button" class="ask-rule-add ask-pick-yourself" onClick={onPick}>{w('ask.pick_yourself')}</button>
    </div>
  );
}

/** The draft's ROUTE, PLAN, ROUTE RULES and PRACTICES (17.1, 17.22): the route
 * is the one picked for the words, or none and the person picks; route rules
 * are shown and always sent; a practice's × takes it out, and "+ N more" lists
 * the rest, each with + to put it in. */
function AskDraft({ sheet, harness, docked, plan, picked, onRoute, onPlan, onPicked }: {
  sheet: Sheet; harness: string; docked: boolean; plan: string | null | undefined; picked: Picked;
  onRoute: (r: string) => void; onPlan: (p: string | null) => void; onPicked: (p: Picked) => void;
}) {
  const [all, setAll] = useState(false);
  const shownPlan = plan === undefined ? (sheet.plan?.path ?? '') : (plan ?? '');
  const kept = sheet.practices.filter((r) => isIn(sheet, picked, r.id));
  const out = sheet.practices.filter((r) => !isIn(sheet, picked, r.id));
  const shown = shownRules(sheet, picked, all);
  const more = moreCount(sheet, picked, all);
  const pick = (id: string, on: boolean) => onPicked(new Map([...picked, [id, on]]));
  const named = sheet.route ? `${harness} · ${routeLabel(sheet.route)}` : harness;
  return (
    <div class="ask-draft">
      <div class="ask-picks">
        <label class="ask-pick">
          <span class="ask-eyebrow">{w('ask.route')}</span>
          <select class={sheet.route ? undefined : 'ask-pick--unpicked'} value={sheet.route ?? ''} onChange={(e) => onRoute((e.target as HTMLSelectElement).value)}>
            {!sheet.route && <option value="" disabled>{w('ask.pick_route')}</option>}
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
        <span class="ask-eyebrow">{docked || !sheet.route ? w('ask.route_rules') : `${w('ask.route_rules')} · ${named}`}</span>
        <ul class="ask-rules">
          {sheet.route ? sheet.route_rules.map((r) => (
            <li key={r.id} class="ask-rule"><b>{r.label}</b><span class="ask-rule-text">{r.text}</span><span class="ask-rule-meta">{docked ? `${named} · ${w('ask.always')}` : w('ask.always')}</span></li>
          )) : <li class="ask-rule"><span class="ask-rule-meta">{w('ask.route_rules_wait')}</span></li>}
        </ul>
      </div>
      <div class="ask-rules-row">
        <span class="ask-eyebrow">{fill('ask.practices', { n: String(kept.length) })}</span>
        <ul class="ask-rules">
          {shown.map((r) => (
            <li key={r.id} class="ask-rule"><b>{r.label}</b><span class="ask-rule-text">{r.text}</span><button type="button" class="ask-rule-out" aria-label={r.label} onClick={() => pick(r.id, false)}>×</button></li>
          ))}
          {!all && more > 0 && (
            <li class="ask-rule"><button type="button" class="ask-rule-more" onClick={() => setAll(true)}>{fill('ask.more', { n: String(more) })}</button></li>
          )}
          {all && out.map((r) => (
            <li key={r.id} class="ask-rule ask-rule--out"><b>{r.label}</b><span class="ask-rule-text">{r.text}</span><button type="button" class="ask-rule-more" aria-label={r.label} onClick={() => pick(r.id, true)}>+</button></li>
          ))}
        </ul>
        {!all && out.length > 0 && <button type="button" class="ask-rule-add" onClick={() => setAll(true)}>{w('ask.add_rule')}</button>}
      </div>
    </div>
  );
}
