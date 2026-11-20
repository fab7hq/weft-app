// The confirmation bar (M4.5–M4.14, D4.5–D4.14), wherever the person is:
// what the machine is about to type, Cancel beside Send; Resume a session by its id, after an act no
// agent runs for, or Start an agent when there is none to resume. Answered on the machine first, it says so and
// closes. On a phone Cancel and the go are halves of the width; on a desktop
// they sit at the right.
import { batch, signal } from '@preact/signals';
import { useEffect, useState } from 'preact/hooks';
import * as m from '../machine';
import { go, here, swap, type View } from '../nav';
import { clock, why, yesOf } from '../bar';
import { destinations, keyOf, SendTo, type Dest } from './SendTo';
import { evalAct, named, noteKey, readerOf, readerTitle, readers, type ReadNote } from '../readby';
import { judgesIn } from '../settings';
import { largeNote, readsRow, type Reads } from '../reads';
import { fill, w } from '../words';
import { during, failed, openAnswered, openSent, startOpening, working, type Working } from '../waits';
import { Asking, openView } from './Wait';
import { CheckBeforeReads } from './Skip';

/** The pending this device asked for and shows. */
export const shown = signal<string | null>(null);

/** The act this device has sent and the machine has not answered yet: its
 * button shows it is working, and a second press does nothing. */
export const acting = signal<string | null>(null);

/** The views a Send closes, as the desktop app closes its detail view. */
const CLOSED_BY_SEND: View['name'][] = ['work', 'detail', 'round', 'seal', 'session', 'eval'];

/** Once Weft types into an agent, the person goes where the keys went, as on
 * the desktop app: into that agent, in place of a Details view. */
function into(agent: string): void {
  const machine = m.current.value;
  const view = here();
  if (!machine || !agent || (view?.name === 'agent' && view.agent === agent)) return;
  const to: View = { name: 'agent', machine: machine.id, agent };
  if (view && CLOSED_BY_SEND.includes(view.name)) swap(to);
  else go(to);
}

/** A session to resume by its id, after a confirm: after an act
 * the machine refused because no agent runs where it goes (`not_running`,
 * which names the session, or none). */
interface Gone {
  project: string;
  harness: string;
  session: m.Session | null;
  /** The machine's own sentence, when it named no session. */
  said?: string;
  /** The act, sent again once the agent is back. */
  again: Record<string, unknown>;
}
const gone = signal<Gone | null>(null);

/** Start a session again by its id in a new pane, then send `again`, or else
 * go to its agent: at once from its Details (M11.5), after the confirm here. */
export async function resume(project: string, harness: string, session: string, again: Record<string, unknown> | null = null) {
  const machine = m.current.value;
  // Resuming… in the bar's place until it runs; why not, there, after.
  const started = await during({ words: w('wait.resuming'), about: `${harness} · ${shortId(session)}` }, () => m.request({ type: 'start', project, harness, resume: session }), (a) => a.code === 'running');
  // A pane holds it already: go there.
  const agent = started?.type === 'ok' ? started.agent : started?.code === 'running' ? started.agent : null;
  if (!agent) return;
  if (again) void act(again);
  else if (machine && agent) go({ name: 'agent', machine: machine.id, agent: String(agent) });
}

/** The project a unit of work is in, as the tree shows it. */
const projectOf = (unit: unknown) => m.tree.value.find((p) => p.work.units.some((u) => u.unit === unit))?.project ?? '';

/** What Weft read of a harness's setup, said in the dialog of the pending its act staged. */
const warned = signal<{ pending: string; text: string } | null>(null);

/** An act; the pending it staged is shown when the machine answers, with its
 * warning, if any, and `staged` told its id first. With `shows`, the bar says
 * it works until the machine answers. Its error, if any, also stays said
 * where the act was until the person acts again. */
export async function act(message: Record<string, unknown>, warning: string | null = null, staged?: (pending: string) => void, shows?: Omit<Working, 'since'>): Promise<Record<string, unknown> | null> {
  if (acting.value || working.value) return null;
  acting.value = String(message.act);
  failed.value = null;
  const ask = () => m.request({ type: 'act', ...message });
  const answer = shows ? await during(shows, ask, () => true) : await ask();
  acting.value = null;
  // Not sent at all: say so, rather than nothing.
  if (!answer) {
    failed.value = w('web.why.not_connected');
    return { type: 'error', code: 'not_connected', message: failed.value };
  }
  if (answer.type === 'ok' && answer.pending) {
    const id = String(answer.pending);
    batch(() => {
      staged?.(id);
      shown.value = id;
      warned.value = warning ? { pending: id, text: warning } : null;
    });
  }
  if (answer.type === 'error' && answer.code === 'not_running') {
    const project = typeof message.project === 'string' ? message.project : projectOf(message.unit);
    gone.value = { project, harness: String(answer.harness), session: (answer.session as m.Session | null) ?? null, said: String(answer.message), again: message };
    return null;
  }
  if (answer.type !== 'error') return null;
  failed.value = String(answer.message ?? answer.code);
  return answer;
}

/** An Eval's dialog this device staged: its work, and who reads it. `first`
 * is who reads unless the person picks another, known once its first dialog
 * has said; `pick` is who reads now. */
export interface Reading {
  pending: string;
  project: string;
  unit: string;
  /** The harness of the work's first Ask, when the dialog names none this project starts. */
  fallback: string;
  warning: string | null;
  first: { harness: string; note: ReadNote } | null;
  pick: string | null;
}
export const reading = signal<Reading | null>(null);

/** Stage an Eval's dialog again, read by `pick`: the new dialog takes the
 * place of the one shown, and nothing runs until its Eval. Refused, the
 * dialog stays and says why above the bar. */
async function readBy(r: Reading, first: { harness: string; note: ReadNote }, pick: string): Promise<boolean> {
  if (acting.value) return false;
  if (pick === (r.pick ?? first.harness)) return true;
  acting.value = 'eval';
  const answer = await m.request({ type: 'act', ...evalAct(r.project, r.unit, pick, first.harness) });
  acting.value = null;
  // Why not is said in the dialog, which stays, until the person acts again.
  if (!answer) return (failed.value = w('web.why.not_connected')), false;
  if (answer.type === 'error') return (failed.value = String(answer.message)), false;
  if (answer.type !== 'ok' || !answer.pending) return false;
  const id = String(answer.pending);
  const warning = pick === first.harness ? r.warning : null;
  batch(() => {
    reading.value = { ...r, pending: id, first, pick };
    shown.value = id;
    warned.value = warning ? { pending: id, text: warning } : null;
  });
  void m.request({ type: 'resolve', pending: r.pending, yes: false });
  return true;
}

/** The Eval dialog's yes: the dialog gives its place to the block that says
 * the Eval is opening until the machine answers; then its view opens,
 * or why not stays in amber. */
async function openEval(r: Reading, harness: string, pending: string): Promise<void> {
  const row = m.tree.value.find((p) => p.project === r.project)?.work.units.find((u) => u.unit === r.unit);
  startOpening({ project: r.project, unit: r.unit, title: row?.title ?? '', asks: row?.open || row?.asks || 1, harness });
  shown.value = null;
  const asked = m.request({ type: 'resolve', pending, yes: true });
  openSent(asked);
  const answer = await asked;
  const machine = m.current.value;
  if (openAnswered(answer) === 'open' && machine) await openView(machine.id, r.project, r.unit);
}

/** A session id as the cards shorten it: `3f9c2b71…a21e`. */
export const shortId = (id: string) => (id.length > 14 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id);

export function PendingBar() {
  return gone.value ? <GoneBar gone={gone.value} /> : <SendBar />;
}

function SendBar() {
  const id = shown.value;
  const pending = m.pendings.value.find((p) => p.id === id) ?? null;
  const [kept, setKept] = useState<m.Pending | null>(null);
  const [answered, setAnswered] = useState(false);
  // SEND TO, for a send: the agent that wrote it until the person picks another.
  const [to, setTo] = useState<Dest | null>(null);
  // This device's own answer, sent and not yet answered: the machine says it
  // was resolved before it answers, and that is not "answered on the machine".
  const [sending, setSending] = useState(false);
  // Its yes went: the bar works in its place until the machine answers.
  const [went, setWent] = useState(false);
  if (pending && pending !== kept) setKept(pending);
  // Answered on the machine first: say so, then go. The timer hangs on
  // `answered` alone, so a later message cannot cancel it.
  const r = m.resolved.value;
  if (r && r.id === id && !answered && !sending) setAnswered(true);
  useEffect(() => {
    if (!answered) return;
    const t = setTimeout(() => {
      shown.value = null;
      setAnswered(false);
    }, 2500);
    return () => clearTimeout(t);
  }, [answered]);
  const showing = pending ?? (kept?.id === id ? kept : null);
  if (!id || !showing || went) return null;
  const answer = async (yes: boolean) => {
    if (sending || working.value) return;
    // An Eval's yes: RingFrame opens it, which can take long; its block shows until the machine answers.
    const opens = yes && read && first && showing.go?.word === 'act.eval' ? read : null;
    if (opens) return void openEval(opens, opens.pick ?? first!.harness, id);
    setSending(true);
    if (yes) setWent(true);
    // Another agent here, or a new one the machine starts for it.
    const where = !yes || !to ? {} : 'agent' in to ? (to.agent === showing.agent ? {} : { to: to.agent }) : { start: to.start };
    const resolve = () => m.request({ type: 'resolve', pending: id, yes, ...where });
    const said = yes
      ? await during({ words: w(stops ? 'wait.stopping_eval' : 'wait.sending'), about: stops ? (work ?? showing.what) : target }, resolve)
      : await resolve();
    setSending(false);
    setWent(false);
    shown.value = null;
    if (yes && said?.type === 'ok' && (!to || 'agent' in to)) into(to?.agent ?? showing.agent);
  };
  const of = m.agents.value.find((a) => a.agent === showing.agent);
  const warning = warned.value?.pending === id ? warned.value.text : null;
  const yes = yesOf(showing);
  // Its yes stops an Eval.
  const stops = showing.go?.word === 'dialog.stop_eval.go';
  const harness = of?.harness ?? '';
  // Where it types, as the desktop app names it: `weft · claude`.
  const target = of ? `${of.project.split('/').pop()} · ${harness}` : harness;
  // A dialog that types nothing names its work in its head, and says the rest in one line (17.3, 17.10).
  const raw = showing.why.split('\n').map((l) => l.trim()).filter(Boolean);
  const work = !showing.text && raw.length > 1 && !/[.?!:]$/.test(raw[0]) ? raw[0] : null;
  const said = why(work ? raw.slice(1).join('\n') : showing.why);
  const lines = showing.text ? said : [said.join(' ')];
  // An Eval's Read by, worked out from the first dialog the machine staged.
  const read = reading.value?.pending === id ? reading.value : null;
  const first = read && (read.first ?? readerOf(judgesIn(m.settings.value[read.project]?.effective), said.map((s) => named(s, w('dialog.eval.judges'))).find(Boolean) ?? null, m.harnesses.value.filter((h) => h.project === read.project), read.fallback));
  // Its read and its first reader are known before any of its dialogs is drawn: an answer reads them.
  if (answered) {
    return (
      <div class="pending-bar pending-bar--answered" role="dialog" aria-label={showing.what}>
        <span class="pending-what">{showing.what}</span>
        <p class="pending-answered" role="status">{w('web.bar.answered')}</p>
      </div>
    );
  }
  return (
    <div class={yes.tone === 'warn' ? 'pending-bar pending-bar--warn' : 'pending-bar'} role="dialog" aria-label={showing.what}>
      <div class="pending-head">
        <span class="pending-what">{showing.what}</span>
        {!showing.sends && showing.text && <span class="pending-into">{fill('web.bar.into', { harness: target })}</span>}
        {work && <span class="pending-into">{work}</span>}
      </div>
      {read && first && <ReadBy r={read} first={first} />}
      {showing.reads && <ReadsRow reads={showing.reads} />}
      {showing.reads?.findings && <CheckBeforeReads findings={showing.reads.findings} project={read?.project ?? null} />}
      {showing.reads && <Large reads={showing.reads} />}
      {read && failed.value && <p class="pending-why ask-hint" role="alert">{failed.value}</p>}
      {lines.filter(Boolean).map((s) => (
        <p key={s} class="pending-why">{s}</p>
      ))}
      {showing.sends && warning && <p class="pending-why ask-hint">{warning}</p>}
      {showing.text && <pre class="pending-text"><Command text={showing.text} /></pre>}
      {showing.sends ? (
        <SendBarTo rows={destinations(of?.project, showing.agent)} to={keyOf(to ?? { agent: showing.agent })} onPick={setTo}>
          <Acts cancel={() => void answer(false)} go={[w('act.send'), () => void answer(true)]} busy={sending} />
        </SendBarTo>
      ) : (
        <Acts cancel={() => void answer(false)} go={[showing.reads && largeNote(showing.reads) ? w('reads.anyway') : yes.label, () => void answer(true)]} tone={yes.tone} busy={sending} warn={warning} />
      )}
    </div>
  );
}

/** Read by: the harness that reads the work, every one the project starts to pick from, and why it starts where it does. */
function ReadBy({ r, first }: { r: Reading; first: { harness: string; note: ReadNote } }) {
  const pick = r.pick ?? first.harness;
  const starts = m.harnesses.value.filter((h) => h.project === r.project);
  return (
    <div class="pending-read">
      <label class="pending-read-label" for="read-by">{w('dialog.eval.read_by')}</label>
      <select id="read-by" class="settings-select pending-read-pick" value={pick} aria-busy={acting.value === 'eval' || undefined}
        onChange={(e) => {
          // Refused, the list goes back to who reads now.
          const list = e.target as HTMLSelectElement;
          void readBy(r, first, list.value).then((taken) => taken || (list.value = pick));
        }}>
        {readers(starts.map((s) => s.harness), first.harness).map((h) => <option key={h} value={h}>{readerTitle(h, starts)}</option>)}
      </select>
      {/* Staged again with the harness picked: asking, beside the list. */}
      {acting.value === 'eval' ? <Asking words={w('wait.asking')} /> : pick === first.harness && <span class="pending-read-note">{w(noteKey(first.note))}</span>}
    </div>
  );
}

/** Reads: the commits and files the Eval reads and since when, and what it counts and does not read. */
function ReadsRow({ reads }: { reads: Reads }) {
  const r = readsRow(reads);
  return (
    <div class="pending-reads">
      <span class="pending-reads-label">{w('reads.label')}</span>
      <span class="pending-reads-what">
        <span class="mono">{r.commits}{' · '}{r.before && <><s class="pending-reads-before">{r.before}</s>{' '}</>}{r.files}</span>{' '}<span class="pending-reads-since">{r.since}</span>
        {r.skipped && <span class="pending-reads-skipped">{r.skipped}</span>}
      </span>
    </div>
  );
}

/** A large change: said in amber, where most of it is, and what makes the next one smaller. */
function Large({ reads }: { reads: Reads }) {
  const note = largeNote(reads);
  if (!note) return null;
  return (
    <div class="pending-large" role="note">
      <span class="pending-large-title">{note.title}</span>
      {note.where && <span class="pending-large-line">{note.where[0]}<span class="mono">{note.where[1]}</span>{note.where[2]}</span>}
      <span class="pending-large-line">{note.fix.split(/(\.gitattributes)/).map((part, i) => (i % 2 ? <span key={i} class="mono">{part}</span> : part))}</span>
    </div>
  );
}

/** A send's SEND TO, above its acts on a phone and beside them on a desktop (M4.6, D4.6). */
function SendBarTo({ rows, to, onPick, children }: { rows: ReturnType<typeof destinations>; to: string; onPick: (d: Dest) => void; children: preact.ComponentChildren }) {
  return (
    <div class="pending-to">
      <span class="ask-eyebrow" id="ask-to-label">{w('ask.send_to')}</span>
      <SendTo rows={rows} to={to} onPick={onPick} />
      {children}
    </div>
  );
}

/** Resume a session by its id (M4.12, M11.5): what Weft will start, then Resume; with no session to resume, Start an agent. */
function GoneBar({ gone: g }: { gone: Gone }) {
  const close = () => (gone.value = null);
  const machine = m.current.value;
  const s = g.session;
  const back = () => {
    close();
    if (s) void resume(g.project, g.harness, s.session, g.again);
  };
  const fresh = () => {
    close();
    if (machine) go({ name: 'start', machine: machine.id, from: g.project, project: g.project, harness: g.harness });
  };
  const title = s ? fill('web.resume.ask', { harness: g.harness, session: shortId(s.session) }) : g.said ?? '';
  return (
    <div class="pending-bar" role="dialog" aria-label={title}>
      <div class="pending-head">
        <span class="pending-what">{title}</span>
      </div>
      {s ? (
        <>
          <p class="pending-why">{s.state === 'quiet' ? fill('resume.quiet', { time: clock(s.at) }) : fill('resume.how', { harness: g.harness })}</p>
          <p class="pending-why">{w('resume.either_way')}</p>
          <Acts cancel={close} go={[w('act.resume'), back]} />
        </>
      ) : (
        <>
          <p class="pending-why">{w('resume.either_way')}</p>
          <Acts cancel={close} go={[w('start.title'), fresh]} />
        </>
      )}
    </div>
  );
}

/** A dialog's acts; what Weft read of the harness's setup beside them on a desktop, over them on a phone. */
function Acts({ cancel, go: [label, onGo], tone = 'go', busy = false, warn = null }: { cancel: () => void; go: [string, () => void]; tone?: 'go' | 'warn'; busy?: boolean; warn?: string | null }) {
  return (
    <div class="pending-acts">
      {warn && <span class="pending-why ask-hint pending-warn">{warn}</span>}
      <span class="spacer" />
      <button class="tree-act" type="button" onClick={cancel}>{w('act.cancel')}</button>
      <button class={`tree-act tree-act--${tone}`} type="button" onClick={onGo} aria-busy={busy || undefined}>{label}</button>
    </div>
  );
}

/** A prompt with the route's command at its front, as 17.2 marks it. */
function Command({ text }: { text: string }) {
  const command = /^[/$][\w:-]+ /.exec(text)?.[0] ?? '';
  // A line that only heads a section, as `Rules:`, is dim.
  const rest = text.slice(command.length).split('\n').map((line, i, all) => {
    const end = i < all.length - 1 ? '\n' : '';
    return /^[^\s-][^:]*:$/.test(line) ? <span key={i} class="pending-head-line">{line + end}</span> : line + end;
  });
  return <>{command && <span class="pending-command">{command}</span>}{rest}</>;
}
