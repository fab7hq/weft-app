// Details, one level each: a unit of work's, its workflow and its acts; an
// Ask's (M11.2, D11.2), under a breadcrumb of where it stands; an Eval's (M11.3, D11.3), once;
// a Seal's (M11.4, D11.4), once. Each is read from the machine; a part of the
// record it names is a link to its own Details. On a phone a page with its
// acts under it; on a desktop the agent's place, with Close.
import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { Machine } from '../api';
import { clock, dayClock, stamp } from '../bar';
import * as m from '../machine';
import { back, go } from '../nav';
import { fill, stateWord, statusTone, statusWord, w } from '../words';
import { asking } from './Ask';
import { act, acting } from './Asked';
import { evalWork, said, sealRound, sealWork } from './Bar';
import { ReportSaid, evalName, sealName, stateOf } from './Tree';
import { undo } from './Undo';
import { Dots } from './EvalView';
import { remedyRead, type Offer } from '../offers';
import { type EvalDetail, MARK, tint, toItem } from '../evalview';

/** The record's parts, as a work's breadcrumb names them. */
interface Crumb {
  eval: { eval: string; n: number; report: m.Report | null } | null;
  seal: { seal: string; n: number } | null;
}

/** A work's Details (`read detail`). */
interface Work {
  unit: string;
  title: string;
  harness: string;
  crumb: Crumb;
  /** `state` is DONE once composed, else still being asked. */
  ask: { state: string; aside: string; lines: string[] };
  session: m.Session | null;
  proceed: boolean;
  follows: string;
}

/** A Seal's Details (`read seal`), its Asks a page at a time. */
interface Sealed {
  seal: string;
  n: number;
  decision: string;
  at: number | null;
  eval: { eval: string; n: number; report: m.Report | null } | null;
  receipt: string;
  holds: boolean | null;
  broken: string[];
  asks: m.Ask[];
  next: string | null;
  /** How many Asks it covered, all pages. */
  total: number;
}

/** Read once, and again when `again` changes. */
export function useRead<T>(message: Record<string, unknown>, what: string, again: unknown[] = []): T | null {
  const [got, setGot] = useState<T | null>(null);
  useEffect(() => {
    void m.request({ type: 'read', what, ...message })?.then((a) => a.type === 'ok' && setGot(a[what] as T));
  }, [JSON.stringify(message), ...again]);
  return got;
}

/** The parts of a breadcrumb, with `›` between them; a part with a press is a link. */
type Part = { text: ComponentChildren; go?: () => void; tone?: string };

function Crumbs({ parts }: { parts: Part[] }) {
  return (
    <span class="crumbs">
      {parts.map((p, i) => (
        <span key={i} class="crumb-part">
          {i > 0 && <span class="crumb-sep">›</span>}
          {p.go ? (
            <button class={`crumb crumb--link${i === 0 ? ' crumb--first' : ''}`} type="button" onClick={p.go}>{p.text}</button>
          ) : (
            <span class={`crumb${i === 0 ? ' crumb--first' : ''}${p.tone ? ` ${p.tone}` : ''}`}>{p.text}</span>
          )}
        </span>
      ))}
    </span>
  );
}

/**
 * One Details view: on a phone a page under the back to the tree, with its acts under
 * it, the why of an act that does not apply above them; on a desktop the
 * agent's place, its breadcrumb on top and Close among its acts.
 */
export function Frame({ machine, project, label, crumbs, right, mono = false, aside, wide, acts, children }: {
  machine: Machine;
  project: string;
  label: string;
  crumbs: Part[];
  right?: string;
  mono?: boolean;
  aside?: ComponentChildren;
  wide: boolean;
  acts?: ComponentChildren;
  children?: ComponentChildren;
}) {
  const rightSaid = right && <span class={mono ? 'detail-id' : 'detail-harness'}>{right}</span>;
  if (wide) {
    return (
      <div class="detail-pane" role="region" aria-label={label}>
        <div class="detail-top">
          <Crumbs parts={crumbs} />
          <span class="spacer" />
          {rightSaid}
        </div>
        <div class="detail detail-v3">
          {aside && <p class="detail-prov">{aside}</p>}
          {children}
        </div>
        <div class="detail-acts detail-acts--wide">
          {acts}
          <span class="spacer" />
          <button class="tree-act" type="button" onClick={back}>{w('act.close')}</button>
        </div>
      </div>
    );
  }
  return (
    <div class="app">
      <div class="appbar">
        <button class="back" type="button" onClick={back}>{w('web.back.tree')}</button>
        <span class="spacer" />
        {rightSaid}
      </div>
      <div class="page detail-page detail-v3" role="region" aria-label={label}>
        <h2 class="detail-crumbs"><Crumbs parts={crumbs} /></h2>
        {aside && <p class="detail-prov">{aside}</p>}
        {children}
      </div>
      {(acts || said.value) && (
        <div class="detail-foot">
          {said.value && <p class="tree-said" role="status">{said.value}</p>}
          {acts && <div class="detail-acts">{acts}</div>}
        </div>
      )}
    </div>
  );
}

/** A labelled line of a Details view, as `Found  1 found`; with a press, a › at its end. */
export function Fact({ label, children, go: onGo }: { label: string; children: ComponentChildren; go?: () => void }) {
  const body = (
    <>
      <span class="fact-label">{label}</span>
      <span class="fact-value">{children}</span>
      {onGo && <span class="tree-more" aria-hidden="true">›</span>}
    </>
  );
  return onGo ? (
    <button class="fact fact--link" type="button" onClick={onGo}>{body}</button>
  ) : (
    <div class="fact">{body}</div>
  );
}

/** A section's head: its label in capitals, and how many. */
export function Head({ label, n, inline = false }: { label: string; n?: number; inline?: boolean }) {
  return (
    <div class={inline ? 'detail-head-row detail-head-row--inline' : 'detail-head-row'}>
      <span class="detail-label">{label}</span>
      {n !== undefined && <span class="detail-count">{inline ? `· ${n}` : n}</span>}
    </div>
  );
}

/** A desktop's labelled lines (D11.4, D11.5): a small capital label, its value beside it. */
export function Grid({ rows }: { rows: [string, ComponentChildren][] }) {
  return (
    <div class="detail-grid">
      {rows.map(([label, value]) => (
        <div key={label} class="grid-row" role="group" aria-label={label}>
          <span class="grid-label">{label}</span>
          <span class="grid-value">{value}</span>
        </div>
      ))}
    </div>
  );
}

/** An Ask in a list of Details: its title, then its harness or its word, and › to its own Details. */
export function AskLine({ title, aside, onGo }: { title: string; aside: string; onGo: () => void }) {
  return (
    <button class="detail-ask" type="button" onClick={onGo} aria-label={title}>
      <span class="tree-name">{title}</span>
      <span class="tree-aside">{aside}</span>
      <span class="tree-more" aria-hidden="true">›</span>
    </button>
  );
}

/** Where the Details views lead. */
export function moves(machine: Machine, project: string) {
  return {
    ask: (unit: string) => go({ name: 'detail', machine: machine.id, project, unit }),
    round: (eval_: string) => go({ name: 'round', machine: machine.id, project, eval: eval_ }),
    seal: (seal: string) => go({ name: 'seal', machine: machine.id, project, seal }),
    session: (session: string) => go({ name: 'session', machine: machine.id, project, session }),
    agent: (agent: string) => go({ name: 'agent', machine: machine.id, agent }),
    view: (eval_: string, at?: string) => go({ name: 'eval', machine: machine.id, project, eval: eval_, at }),
  };
}

/** One step of a unit's workflow (`read work`). */
type Step =
  | { step: 'ask'; unit: string; title: string; follow_up: boolean; aside: string }
  | { step: 'eval'; eval: string; n: number; report: m.Report | null; aside: string }
  | { step: 'seal'; seal: string; n: number; decision: string; reason?: string | null; aside: string }
  | { step: 'not_sealed' };

/** A unit of work's Details (`read work`). */
interface Unit {
  unit: string;
  title: string;
  harness: string;
  status: m.Status;
  aside: string;
  steps: Step[];
  follows: string;
  eval: m.Why | null;
  seal: m.Why | null;
  /** What it offers now it is sealed. */
  offers?: Offer[];
}

/** One step: its number, what it is, what it says, and where it leads. */
function StepRow({ n, step, to }: { n: number; step: Step; to: ReturnType<typeof moves> }) {
  const [kind, text, aside, open, name]: [string, ComponentChildren, string | null, (() => void) | null, string] =
    step.step === 'ask'
      ? [w(step.follow_up ? 'act.follow_up' : 'act.ask'), step.title, step.aside, () => to.ask(step.unit), step.title]
      : step.step === 'eval'
        ? [
            evalName(step.n),
            step.report ? <ReportSaid report={step.report} /> : <span class="needs">{w('tree.judging')}</span>,
            step.aside,
            () => to.round(step.eval),
            evalName(step.n),
          ]
        : step.step === 'seal'
          ? [w('act.seal'), [step.decision, step.reason].filter(Boolean).join(' · '), step.aside, () => to.seal(step.seal), sealName(step.n)]
          : [w('act.seal'), <span class="faint">{w('unit.not_sealed')}</span>, null, null, w('unit.not_sealed')];
  const body = (
    <>
      <span class="step-n">{n}</span>
      <span class="step-body">
        <span class="step-kind">{kind}</span>
        <span class="step-text">{text}</span>
        {aside && <span class="step-aside">{aside}</span>}
      </span>
    </>
  );
  // The whole row opens the Eval's Details; Eval view › is its own link.
  if (step.step === 'eval')
    return (
      <div class="step step--link" role="button" tabIndex={0} aria-label={name} onClick={open!}>
        {body}
        <button class="step-view" type="button" onClick={(e) => (e.stopPropagation(), to.view(step.eval))}>{`${w('act.eval_view')} ›`}</button>
      </div>
    );
  return open ? (
    <button class="step step--link" type="button" aria-label={name} onClick={open}>
      {body}
      <span class="tree-more" aria-hidden="true">›</span>
    </button>
  ) : (
    <div class="step" role="group" aria-label={name}>{body}</div>
  );
}

/** An offer on sealed work. Follow up opens the Ask sheet with what the Eval
 * found already written; Undo opens its one dialog. */
async function offer(project: string, d: Unit, o: Offer): Promise<void> {
  if (o === 'follow_up') {
    const answer = await m.request(remedyRead(project, d.unit));
    if (answer?.type !== 'ok') return void (said.value = String(answer?.message ?? w('web.why.not_connected')));
    const r = answer.remedy as { words: string; eval: string; n: number | null };
    const from = r.n === null ? r.eval : fill('follow_up.from_eval', { n: String(r.n) });
    // First to an agent of the harness that did the work, as a follow-up from its Details goes.
    const agent = m.agents.value.find((a) => a.running && a.project === project && a.harness === d.harness)?.agent;
    asking.value = { project, agent, follow: { unit: d.unit, title: d.title, follows: from }, words: r.words };
    return;
  }
  return undo(project, d.unit);
}

/** A unit of work's Details: its workflow in order, each step opening its own Details, and the unit's acts. */
export function UnitDetails({ machine, project, unit, wide = false }: { machine: Machine; project: string; unit: string; wide?: boolean }) {
  const d = useRead<Unit>({ project, unit }, 'work', [JSON.stringify(m.tree.value.find((p) => p.project === project)?.work)]);
  const to = moves(machine, project);
  if (!d) return <Frame machine={machine} project={project} label="" crumbs={[]} wide={wide} />;
  const followUp = () => (asking.value = { project, follow: { unit: d.unit, title: d.title, follows: d.follows } });
  // The act its status puts forward is the primary one.
  const primary = d.status.state === 'evaluated' ? 'seal' : d.status.state === 'sealed' ? 'follow_up' : 'eval';
  const tone = (a: string) => (a === primary ? 'tree-act tree-act--go' : 'tree-act');
  // Sealed work offers only what it offers: accepted work, nothing (17.11).
  const sealed = d.status.state === 'sealed' && d.offers !== undefined;
  const acts = sealed ? (d.offers!.length > 0 && (
    <>
      <span class="ask-eyebrow offers-eyebrow">{w('offer.after_seal')}</span>
      {d.offers!.map((o, i) => (
        <button key={o} class={i === 0 ? 'tree-act tree-act--go' : 'tree-act'} type="button" onClick={() => void offer(project, d, o)}>{w(`offer.${o}`)}</button>
      ))}
    </>
  )) : (
    <>
      <button class={tone('follow_up')} type="button" onClick={followUp}>{w('act.follow_up')}</button>
      <button class={tone('eval')} type="button" aria-busy={acting.value === 'eval' || undefined} onClick={() => void evalWork(project, d.unit, d.eval)}>{w('act.eval')}</button>
      <button class={tone('seal')} type="button" aria-busy={acting.value === 'seal' || undefined} onClick={() => void sealWork(project, d.unit, d.seal)}>{w('act.seal')}</button>
    </>
  );
  const head = (
    <div class="unit-head">
      <div class="unit-title-row">
        <span class="unit-title">{d.title}</span>
        <span class={`work-status ${statusTone(d.status)}`}>{statusWord(d.status)}</span>
      </div>
      <span class="unit-aside">{d.aside}</span>
    </div>
  );
  const flow = (
    <>
      <span class="detail-label unit-label">{w('unit.workflow')}</span>
      <div class="workflow">
        {d.steps.map((step, i) => <StepRow key={i} n={i + 1} step={step} to={to} />)}
      </div>
    </>
  );
  if (wide)
    return (
      <div class="detail-pane" role="region" aria-label={d.title}>
        {head}
        <div class="detail unit-body">{flow}</div>
        <div class="detail-acts detail-acts--wide">
          {acts}
          <span class="spacer" />
          <button class="tree-act" type="button" onClick={back}>{w('act.close')}</button>
        </div>
      </div>
    );
  return (
    <div class="app">
      <div class="appbar">
        <button class="back" type="button" onClick={back}>{w('web.back.tree')}</button>
        <span class="spacer" />
        <span class="detail-harness">{d.harness}</span>
      </div>
      <div class="page unit-page" role="region" aria-label={d.title}>
        {head}
        <div class="unit-body">{flow}</div>
      </div>
      {(acts || said.value) && (
        <div class="detail-foot">
          {said.value && <p class="tree-said" role="status">{said.value}</p>}
          {acts && <div class="detail-acts">{acts}</div>}
        </div>
      )}
    </div>
  );
}

const coverage = (n: number) => (n === 1 ? w('web.detail.covers_one') : fill('web.detail.covers', { n: String(n) }));

/** A work's Details (M11.2, D11.2): the Ask only, and the session it was asked in. */
export function Details({ machine, project, unit, wide = false }: { machine: Machine; project: string; unit: string; wide?: boolean }) {
  // A desktop folds the Ask under its ▾ (D11.2).
  const [folded, setFolded] = useState(false);
  // Read again as the tree moves on.
  const d = useRead<Work>({ unit }, 'detail', [JSON.stringify(m.tree.value.find((p) => p.project === project)?.work)]);
  const to = moves(machine, project);
  if (!d) return <Frame machine={machine} project={project} label="" crumbs={[]} wide={wide} />;
  const e = d.crumb.eval;
  const crumbs: Part[] = [{ text: d.title }];
  if (!e) crumbs.push({ text: w('web.detail.not_evaluated'), tone: 'dim' });
  else {
    crumbs.push({ text: <>{`${evalName(e.n)} `}{e.report ? <ReportSaid report={e.report} /> : w('tree.judging')}</>, go: () => to.round(e.eval) });
    if (d.crumb.seal) {
      const s = d.crumb.seal;
      crumbs.push({ text: sealName(s.n), go: () => to.seal(s.seal) });
    } else crumbs.push({ text: w('tree.not_sealed'), tone: wide ? 'needs' : 'dim' });
  }
  const proceed = async () => {
    const refused = await act({ act: 'proceed', unit });
    if (refused) said.value = String(refused.message);
  };
  const followUp = () => (asking.value = { project, agent: d.session?.agent ?? undefined, follow: { unit, title: d.title, follows: d.follows } });
  const s = d.session;
  // Its session: its agent while a pane holds it, else its Details.
  const toSession = s && (() => (s.agent ? to.agent(s.agent) : to.session(s.session)));
  const waiting = s?.state === 'running' && (s.turn === 'waiting' || Boolean(s.asked));
  const lines = d.ask.lines.filter((l) => l.trim() !== '');
  // While a prompt waits for your yes, how it was sent (the Ask's last line) is amber on a desktop (D11.2).
  const waits = (i: number) => d.proceed && i === lines.length - 1 && Boolean(lines[i - 1]?.endsWith(':'));
  return (
    <Frame
      machine={machine}
      project={project}
      label={d.title}
      crumbs={crumbs}
      right={d.harness}
      aside={d.ask.aside}
      wide={wide}
      acts={
        <>
          {d.proceed && <button class="tree-act tree-act--go" type="button" aria-busy={acting.value === 'proceed' || undefined} onClick={() => void proceed()}>{w('act.proceed')}</button>}
          <button class="tree-act" type="button" onClick={followUp}>{w('act.follow_up')}</button>
        </>
      }
    >
      <section class="detail-section" aria-label={w('act.ask')}>
        {wide ? (
          <button class="detail-section-head detail-fold" type="button" aria-expanded={!folded} onClick={() => setFolded(!folded)}>
            <span class="detail-caret">{folded ? '▸' : '▾'}</span>
            <span class="detail-name">{w('act.ask')}</span>
          </button>
        ) : (
          <div class="detail-section-head">
            <span class="detail-name">{w('act.ask')}</span>
            <span class="detail-aside detail-aside--end">{stateWord(d.ask.state === 'DONE' ? 'asked' : 'asking')}</span>
          </div>
        )}
        {!folded && lines.map((l, i) => (
          <p key={i} class={l.endsWith(':') ? 'detail-line dim' : / is not on disk$/.test(l) || (wide && waits(i)) ? 'detail-line detail-line--needs' : 'detail-line'}>{l}</p>
        ))}
        {/* D11.2: its session as a line and a link, under the Ask. */}
        {wide && !folded && s && toSession && (
          <>
            <p class="detail-line dim">{`${w('web.detail.its_session')}:`}</p>
            <button class="detail-link" type="button" onClick={toSession}>{`${s.harness} · ${s.state === 'running' ? clock(s.at) : stateOf(s)} ›`}</button>
          </>
        )}
      </section>
      {!wide && s && toSession && (
        <button class="fact fact--link fact--session" type="button" onClick={toSession}>
          <span class="fact-label">{w('web.detail.its_session')}</span>
          <span class="fact-value">
            <span class={waiting ? 'needs' : s.state === 'running' ? 'good' : 'dim'}>{waiting ? '■ ' : s.state === 'running' ? '● ' : '□ '}</span>
            {`${s.harness} · ${s.state === 'running' ? clock(s.at) : stateOf(s)}`}
          </span>
          <span class="tree-more" aria-hidden="true">›</span>
        </button>
      )}
    </Frame>
  );
}

/** An Eval's Details (M11.3, D11.3): what it leaves to look at, each item opening its own detail in the Eval view; the Asks it covers; Seal. */
export function RoundDetails({ machine, project, eval: id, wide = false }: { machine: Machine; project: string; eval: string; wide?: boolean }) {
  const d = useRead<EvalDetail & { title?: string }>({ project, eval: id }, 'eval', [JSON.stringify(m.tree.value.find((p) => p.project === project)?.work)]);
  const to = moves(machine, project);
  const label = d ? evalName(d.n) : '';
  let page: ComponentChildren = null;
  let foot: ComponentChildren = null;
  if (d) {
    const where = d.judging ? <span>{w('tree.judging')}</span>
      : d.sealed ? <button class="crumb--link rd-sealed" type="button" onClick={() => to.seal(d.sealed!.seal)}>{`${sealName(d.sealed.n)} ›`}</button>
      : <span>{w('tree.not_sealed')}</span>;
    const by = d.judged_by && (d.at !== null ? fill('details.read_by', { who: d.judged_by, time: dayClock(d.at) }) : fill('details.read_by_untimed', { who: d.judged_by }));
    const [first, ...rest] = (d.headline ?? w('tree.judging')).split(' · ');
    const asks = d.asks.map((a) => a.title).join(' · ');
    page = (
      <>
        <div class="rd-top">
          <span class="rd-where">{[evalName(d.n), d.title].filter(Boolean).join(' · ')}{' · '}{where}</span>
          {by && <span class="faint rd-by">{by}</span>}
        </div>
        <div class="rd-headline">{first}{rest.length > 0 && <span class="rd-headline-rest">{` · ${rest.join(' · ')}`}</span>}</div>
        {d.items.length > 0 && (
          <div class="rd-items">
            {d.items.map((i) => (
              <button key={i.key} class={`rd-item rd-item--${i.kind}`} style={tint(i.kind)} type="button" aria-label={i.text} onClick={() => to.view(d.eval, toItem(i.key))}>
                <span class="ev-mark">{MARK[i.kind]}</span>
                <span class="rd-text">{i.text}</span>
                {!i.again && <Dots dots={i.dots} />}
                <span class="ev-chev" aria-hidden="true">›</span>
              </button>
            ))}
          </div>
        )}
        {d.asks.length > 0 && <p class="rd-covers">{d.asks.length === 1 ? fill('details.covers_one', { asks }) : fill('details.covers', { n: String(d.asks.length), asks })}</p>}
      </>
    );
    const sealWhat = d.questions === 0
      ? (d.asks.length === 1 ? w('web.eval.seal_what_one') : fill('web.eval.seal_what', { n: String(d.asks.length) }))
      : d.questions === 1 ? w('details.seal_asks_one') : fill('details.seal_asks', { n: String(d.questions) });
    const view = <button class="rd-view" type="button" onClick={() => to.view(d.eval)}>{w('act.eval_view')}</button>;
    const seal = (
      <button class="tree-act tree-act--go rd-seal" type="button" aria-busy={acting.value === 'seal' || undefined}
        onClick={() => void sealRound(project, d.eval, d.seal, { title: evalName(d.n), asks: d.asks.length })}>{`${w('act.seal')}…`}</button>
    );
    const what = !d.sealed && !d.judging && <span class="faint rd-what">{sealWhat}</span>;
    foot = wide ? <>{view}<span class="spacer" />{what}{seal}</> : <>{what}<div class="rd-acts">{view}{seal}</div></>;
  }
  if (wide) {
    return (
      <div class="detail-pane rd rd--wide" role="region" aria-label={label}>
        <div class="rd-page">{page}</div>
        {foot && <div class="detail-acts rd-foot">{foot}</div>}
      </div>
    );
  }
  return (
    <div class="app">
      <div class="appbar">
        <button class="back" type="button" onClick={back}>{w('web.back.tree')}</button>
      </div>
      <div class="page rd rd-page" role="region" aria-label={label}>{page}</div>
      {(foot || said.value) && (
        <div class="detail-foot rd-foot-phone">
          {said.value && <p class="tree-said" role="status">{said.value}</p>}
          {foot && <div class="detail-acts rd-foot">{foot}</div>}
        </div>
      )}
    </div>
  );
}

/** Whether a Seal's receipt still holds (M5.8): teal when it does; when it does not, why, in amber. */
function Holds({ d }: { d: Sealed }) {
  if (d.holds === true) return <p class="detail-line detail-line--good">{w('web.seal.holds')}</p>;
  if (d.holds === false)
    return (
      <>
        <p class="detail-line detail-line--loud">{w('web.seal.broken')}</p>
        {d.broken.map((b) => <p key={b} class="detail-line detail-line--needs">{b}</p>)}
      </>
    );
  return null;
}

/** A Seal's Details (M11.4, D11.4): once, with no act; its Asks a page at a time, the next read as the last comes into view. */
export function SealDetails({ machine, project, seal, wide = false }: { machine: Machine; project: string; seal: string; wide?: boolean }) {
  const first = useRead<Sealed>({ project, seal }, 'seal');
  const [more, setMore] = useState<{ asks: m.Ask[]; next: string | null } | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const asks = [...(first?.asks ?? []), ...(more?.asks ?? [])];
  const next = more ? more.next : first?.next ?? null;
  useEffect(() => {
    const el = end.current;
    if (!el || !next) return;
    const seen = new IntersectionObserver((e) => {
      if (!e.some((x) => x.isIntersecting)) return;
      seen.disconnect();
      void m.request({ type: 'read', what: 'seal', project, seal, after: next })?.then((a) => {
        if (a.type !== 'ok') return;
        const page = a.seal as Sealed;
        setMore((had) => ({ asks: [...(had?.asks ?? []), ...page.asks], next: page.next }));
      });
    });
    seen.observe(el);
    return () => seen.disconnect();
  }, [next]);
  const to = moves(machine, project);
  const d = first;
  if (!d) return <Frame machine={machine} project={project} label="" crumbs={[]} wide={wide} />;
  const n = d.total ?? asks.length;
  const accepted = d.decision === 'accepted';
  return (
    <Frame
      machine={machine}
      project={project}
      label={sealName(d.n)}
      crumbs={wide ? [{ text: sealName(d.n) }, { text: d.decision, tone: accepted ? 'good' : undefined }]
        : [{ text: <>{sealName(d.n)}<span class={accepted ? 'chip chip--good detail-chip' : 'chip detail-chip'}>{d.decision.toUpperCase()}</span></> }]}
      right={d.seal}
      mono
      aside={wide ? undefined : [d.at !== null ? fill('web.seal.sealed', { time: stamp(d.at) }) : null, coverage(n)].filter(Boolean).join(' · ')}
      wide={wide}
      acts={wide && d.eval ? <button class="tree-act" type="button" onClick={() => to.view(d.eval!.eval)}>{w('act.eval_view')}</button> : undefined}
    >
      {/* D11.4: the decision large, then its facts as labelled lines, the receipt's line under them. */}
      {wide && (
        <>
          <p class={accepted ? 'summary-head summary-head--large good' : 'summary-head summary-head--large'}>{d.decision}</p>
          <div class="detail-block">
            <Grid rows={[
              ...(d.at !== null ? [[w('web.seal.when'), stamp(d.at)] as [string, ComponentChildren]] : []),
              ...(d.eval ? [[w('web.seal.eval'), (
                <>
                  <button class="detail-link" type="button" onClick={() => to.round(d.eval!.eval)}>{`${evalName(d.eval.n)} ›`}</button>
                  {' · '}
                  <ReportSaid report={d.eval.report} />
                </>
              )] as [string, ComponentChildren]] : []),
              [w('web.seal.receipt'), <span class="mono">{d.receipt}</span>],
            ]} />
            <Holds d={d} />
          </div>
          <Head label={w('web.seal.asks')} n={n} inline />
        </>
      )}
      {!wide && (
      <>
      <div class="facts">
        <Fact label={w('web.seal.decision')}><span class={accepted ? 'good' : undefined}>{d.decision}</span></Fact>
        {d.at !== null && <Fact label={w('web.seal.when')}>{stamp(d.at)}</Fact>}
        {d.eval && (
          <Fact label={w('web.seal.eval')} go={() => to.round(d.eval!.eval)}>
            <span class="fact-strong">{`${evalName(d.eval.n)} · `}</span>
            <ReportSaid report={d.eval.report} />
          </Fact>
        )}
        <Fact label={w('web.seal.receipt')}><span class="mono">{d.receipt}</span></Fact>
      </div>
      <Head label={w('web.seal.asks')} n={n} />
      </>
      )}
      <div class="detail-asks">
        {asks.map((a) => <AskLine key={a.unit} title={a.title} aside={a.harness} onGo={() => to.ask(a.unit)} />)}
        {next && <div ref={end} class="tree-more-rows" aria-hidden="true" />}
      </div>
      <div class="detail-note">
        {!wide && <Holds d={d} />}
        <p class="detail-line dim">{w('web.seal.final')}</p>
      </div>
    </Frame>
  );
}
