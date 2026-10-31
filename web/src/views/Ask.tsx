// Ask (M4.1–M4.4, D4.1–D4.4): what to do, and SEND TO, the project's running
// agents and a new one of each harness; a follow-up names the work and the id
// it carries, and goes first to the agent that wrote it. A sheet on a
// phone; on a desktop a panel docked in the main column, under what is open.
import { signal } from '@preact/signals';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import * as m from '../machine';
import { act, acting } from './Asked';
import { said } from './Bar';
import { askWarning, setupOf } from '../bar';
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
  const picked = to ? keyOf(to) : '';
  // Why the machine would not draft an Ask for the agent picked: said, and the Ask can still go.
  const [refused, setRefused] = useState<{ to: string; why: string } | null>(null);
  useEffect(() => {
    if (!project || !harness) return;
    const words = text;
    const t = setTimeout(() => {
      void m.readSettings(project, 'ask', JSON.stringify({ harness, words, route })).then((r) => {
        const no = (r as { refused?: string } | null)?.refused;
        if (no) return setRefused({ to: picked, why: no });
        if (r) {
          setSheet(r as Sheet);
          setSheetFor(words);
          setRefused(null);
        }
      });
    }, 300);
    return () => clearTimeout(t);
  }, [project, harness, text, route]);
  // One warning: what Weft read of the harness's setup first, else the machine's refusal.
  const setup = setupOf(m.tree.value.find((p) => p.project === project), harness, to && 'agent' in to ? to.agent : undefined);
  const warning = askWarning(setup, refused?.to === picked ? refused.why : null, m.current.value?.name ?? '');
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
  // Every practice listed, once the person asks for more or for another rule.
  const [all, setAll] = useState(false);
  const drafting = !!sheet && !reading;
  const sendTo = (
    <div class="ask-pick ask-pick--to">
      <span class="ask-eyebrow" id="ask-to-label">{w('ask.send_to')}</span>
      <SendTo rows={rows} to={picked} onPick={setTo} />
    </div>
  );
  const planPick = sheet && <PlanPick sheet={sheet} plan={plan} onPlan={setPlan} />;
  const routePick = drafting && <RoutePick sheet={sheet} onRoute={setRoute} />;
  const addRule = drafting && !all && <button type="button" class="ask-rule-add" onClick={() => setAll(true)}>{w('ask.add_rule')}</button>;
  const hint = drafting && sheet.route === null && <span class="ask-hint">{w('ask.pick_to_ask')}</span>;
  const warn = warning && <span class="ask-hint">{warning}</span>;
  const go = <button class={askable ? 'tree-act tree-act--go' : 'tree-act tree-act--go tree-act--waiting'} type="submit" aria-busy={acting.value ? true : undefined}>{w('act.ask')}</button>;
  const cancel = <button class="tree-act" type="button" onClick={close}>{w('act.cancel')}</button>;
  return (
    <form
      class={docked ? 'ask-panel ask-panel--docked' : 'fab7-sheet ask-panel ask-sheet'}
      role="dialog"
      aria-label={w('ask.title')}
      onSubmit={send}
      onKeyDown={(e) => e.key === 'Escape' && close()}
    >
      {f && (
        <span class="ask-eyebrow ask-follow">
          <span class="ask-follow-act">{w('act.follow_up')}</span>
          {` · ${f.title} · ${f.follows}`}
        </span>
      )}
      <label class="ask-title" for="ask-text">{w('ask.title')}</label>
      <textarea ref={box} id="ask-text" class={text ? 'ask-text ask-text--said' : 'ask-text'} value={text} onInput={(e) => setText((e.target as HTMLTextAreaElement).value)} onKeyDown={sendOnEnter} />
      {/* SEND TO first; on a desktop ROUTE and PLAN beside it, on a phone under it. */}
      {docked ? (
        <div class="ask-picks">{sendTo}{routePick}{planPick}</div>
      ) : (
        <>
          {sendTo}
          {(routePick || planPick) && <div class="ask-picks">{routePick}{planPick}</div>}
        </>
      )}
      {reading && <Sensing onPick={() => setPicking(true)} />}
      {drafting && <AskDraft sheet={sheet} harness={harness} docked={docked} picked={kept} all={all} onAll={setAll} onPicked={setKept} addRule={docked ? null : addRule} />}
      {warn}
      {docked ? (
        <div class="ask-row">
          {addRule}
          <span class="spacer" />
          {hint}
          {cancel}
          {go}
        </div>
      ) : (
        <>
          {hint}
          <div class="ask-acts">{cancel}{go}</div>
        </>
      )}
    </form>
  );
}

/** ROUTE: the one picked for the words, or none and the person picks (17.22). */
function RoutePick({ sheet, onRoute }: { sheet: Sheet; onRoute: (r: string) => void }) {
  return (
    <label class="ask-pick">
      <span class="ask-eyebrow">{w('ask.route')}</span>
      <span class="ask-select">
        <select class={sheet.route ? undefined : 'ask-pick--unpicked'} value={sheet.route ?? ''} onChange={(e) => onRoute((e.target as HTMLSelectElement).value)}>
          {!sheet.route && <option value="" disabled>{w('ask.pick_route')}</option>}
          {sheet.routes.map((r) => <option key={r} value={r}>{routeLabel(r)}</option>)}
        </select>
      </span>
    </label>
  );
}

/** PLAN: the one offered, another, or none; there while Sense reads the words too (17.23). */
function PlanPick({ sheet, plan, onPlan }: { sheet: Sheet; plan: string | null | undefined; onPlan: (p: string | null) => void }) {
  const shown = plan === undefined ? (sheet.plan?.path ?? '') : (plan ?? '');
  return (
    <label class="ask-pick ask-pick--plan">
      <span class="ask-eyebrow">{w('ask.plan')}</span>
      <span class="ask-select">
        <select value={shown} onChange={(e) => onPlan((e.target as HTMLSelectElement).value || null)}>
          <option value="">{w('ask.no_plan')}</option>
          {sheet.plans.map((p) => <option key={p.path} value={p.path}>{p.path}</option>)}
        </select>
      </span>
    </label>
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
        <span class="ask-sensing-bars" aria-hidden="true"><i /><i /><i /></span>
      </div>
      <button type="button" class="ask-rule-add ask-pick-yourself" onClick={onPick}>{w('ask.pick_yourself')}</button>
    </div>
  );
}

/** The draft's ROUTE RULES and PRACTICES (17.1, 17.22): route rules are
 * shown and always sent, once a route is picked; a practice's × takes it out,
 * and "+ N more" lists the rest, each with + to put it in. */
function AskDraft({ sheet, harness, docked, picked, all, onAll, onPicked, addRule }: {
  sheet: Sheet; harness: string; docked: boolean; picked: Picked; all: boolean;
  onAll: (all: boolean) => void; onPicked: (p: Picked) => void; addRule: preact.ComponentChildren;
}) {
  const kept = sheet.practices.filter((r) => isIn(sheet, picked, r.id));
  const out = sheet.practices.filter((r) => !isIn(sheet, picked, r.id));
  const shown = shownRules(sheet, picked, all);
  const more = moreCount(sheet, picked, all);
  const pick = (id: string, on: boolean) => onPicked(new Map([...picked, [id, on]]));
  const named = sheet.route ? `${harness} · ${routeLabel(sheet.route)}` : harness;
  return (
    <div class="ask-draft">
      {/* A route with no rules of its own has no row. */}
      {(!sheet.route || sheet.route_rules.length > 0) && (
        <div class="ask-rules-row">
          <span class="ask-eyebrow">{docked || !sheet.route ? w('ask.route_rules') : `${w('ask.route_rules')} · ${named}`}</span>
          <ul class="ask-rules">
            {sheet.route ? sheet.route_rules.map((r) => (
              <li key={r.id} class="ask-rule"><b>{r.label}</b><span class="ask-rule-text">{r.text}</span><span class="ask-rule-meta">{docked ? `${named} · ${w('ask.always')}` : w('ask.always')}</span></li>
            )) : <li class="ask-rule"><span class="ask-rule-meta">{w('ask.route_rules_wait')}</span></li>}
          </ul>
        </div>
      )}
      <div class="ask-rules-row">
        <span class="ask-eyebrow ask-practices">{fill('ask.practices', { n: String(kept.length) })}{addRule}</span>
        <ul class="ask-rules">
          {shown.map((r) => (
            <li key={r.id} class="ask-rule"><b>{r.label}</b><span class="ask-rule-text">{r.text}</span><button type="button" class="ask-rule-out" aria-label={r.label} onClick={() => pick(r.id, false)}>×</button></li>
          ))}
          {!all && more > 0 && (
            <li class="ask-rule"><button type="button" class="ask-rule-more" onClick={() => onAll(true)}>{fill('ask.more', { n: String(more) })}</button></li>
          )}
          {all && out.map((r) => (
            <li key={r.id} class="ask-rule ask-rule--out"><b>{r.label}</b><span class="ask-rule-text">{r.text}</span><button type="button" class="ask-rule-more" aria-label={r.label} onClick={() => pick(r.id, true)}>+</button></li>
          ))}
        </ul>
      </div>
    </div>
  );
}
