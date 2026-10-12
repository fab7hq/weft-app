// Details, one level each: a work's (M11.2, D11.2), its Ask
// only, under a breadcrumb of where it stands; an Eval's (M11.3, D11.3), once;
// a Seal's (M11.4, D11.4), once. Each is read from the machine; a part of the
// record it names is a link to its own Details. On a phone a page with its
// acts under it; on a desktop the agent's place, with Close.
import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { Machine } from '../api';
import { clock, stamp } from '../bar';
import * as m from '../machine';
import { back, go } from '../nav';
import { fill, stateWord, w } from '../words';
import { asking } from './Ask';
import { act, acting } from './Asked';
import { said, sealRound } from './Bar';
import { Verdict, evalName, sealName, sealedCount, stateOf } from './Tree';

/** The record's parts, as a work's breadcrumb names them. */
interface Crumb {
  eval: { eval: string; n: number; verdict: m.Round['verdict'] } | null;
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

/** An Eval's Details (`read eval`). */
interface Judged {
  eval: string;
  n: number;
  judging: boolean;
  verdict: m.Round['verdict'];
  agreement: string | null;
  judged_by: string | null;
  at: number | null;
  findings: { mark: string; text: string }[];
  checks: { mark: string; text: string; result: string }[];
  asks: m.Ask[];
  sealed: { seal: string; n: number } | null;
  seal: m.Why | null;
}

/** A Seal's Details (`read seal`), its Asks a page at a time. */
interface Sealed {
  seal: string;
  n: number;
  decision: string;
  at: number | null;
  eval: { eval: string; n: number; verdict: m.Round['verdict']; agreement: string | null } | null;
  receipt: string;
  holds: boolean | null;
  broken: string[];
  asks: m.Ask[];
  next: string | null;
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

/** A labelled line of a Details view, as `Verdict  aligned`; with a press, a › at its end. */
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
    work: (unit: string) => go({ name: 'detail', machine: machine.id, project, unit }),
    round: (eval_: string) => go({ name: 'round', machine: machine.id, project, eval: eval_ }),
    seal: (seal: string) => go({ name: 'seal', machine: machine.id, project, seal }),
    session: (session: string) => go({ name: 'session', machine: machine.id, project, session }),
    agent: (agent: string) => go({ name: 'agent', machine: machine.id, agent }),
    view: (eval_: string, at?: string) => go({ name: 'eval', machine: machine.id, project, eval: eval_, at }),
  };
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
    crumbs.push({ text: <>{`${evalName(e.n)} `}{e.verdict ? w(`verdict.${e.verdict}`) : w('tree.judging')}</>, go: () => to.round(e.eval) });
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
  const waiting = s?.state === 'running' && s.turn === 'waiting';
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
            <span class={waiting ? 'needs' : s.state === 'running' ? 'good' : 'dim'}>{s.state === 'running' ? '● ' : '○ '}</span>
            {`${s.harness} · ${s.state === 'running' ? clock(s.at) : stateOf(s)}`}
          </span>
          <span class="tree-more" aria-hidden="true">›</span>
        </button>
      )}
    </Frame>
  );
}

/** An Eval's Details (M11.3, D11.3): once, with the Asks it covers; Seal stays drawn, and says why when it does not apply. */
export function RoundDetails({ machine, project, eval: id, wide = false }: { machine: Machine; project: string; eval: string; wide?: boolean }) {
  const d = useRead<Judged>({ project, eval: id }, 'eval', [JSON.stringify(m.tree.value.find((p) => p.project === project)?.work.evals)]);
  const to = moves(machine, project);
  if (!d) return <Frame machine={machine} project={project} label="" crumbs={[]} wide={wide} />;
  const crumbs: Part[] = [{ text: evalName(d.n) }];
  // D11.3 names the verdict in its breadcrumb too.
  if (wide && d.verdict) crumbs.push({ text: <Verdict verdict={d.verdict} /> });
  if (d.judging) crumbs.push({ text: w('tree.judging'), tone: 'dim' });
  else if (d.sealed) {
    const s = d.sealed;
    crumbs.push({ text: sealName(s.n), go: () => to.seal(s.seal) });
  } else crumbs.push({ text: w('tree.not_sealed'), tone: wide ? 'needs' : 'dim' });
  const aside = [d.at !== null ? fill('web.eval.judged', { time: stamp(d.at) }) : null, coverage(d.asks.length)].filter(Boolean).join(' · ');
  const check = d.checks[0];
  return (
    <Frame
      machine={machine}
      project={project}
      label={evalName(d.n)}
      crumbs={crumbs}
      right={d.eval}
      mono
      aside={wide ? undefined : aside}
      wide={wide}
      acts={
        <>
          <button class="tree-act tree-act--go" type="button" aria-busy={acting.value === 'seal' || undefined} onClick={() => void sealRound(project, d.eval, d.seal)}>{w('act.seal')}</button>
          <button class="tree-act" type="button" onClick={() => to.view(d.eval)}>{w('act.eval_view')}</button>
        </>
      }
    >
      {/* D11.3: the verdict and its agreement, then who judged it, when, and what it covers, in two lines. */}
      {wide && (
        <div class="detail-summary">
          <p class="summary-head">
            {d.verdict ? <Verdict verdict={d.verdict} /> : w('tree.judging')}
            {d.agreement && <>{' · '}<span class="lower">{w('web.eval.agreement')}</span>{` ${d.agreement}`}</>}
          </p>
          <p class="detail-prov">
            {d.judged_by && <><span class="lower">{w('web.eval.judged_by')}</span>{` ${d.judged_by} · `}</>}
            {[d.at !== null ? stamp(d.at) : null, coverage(d.asks.length)].filter(Boolean).join(' · ')}
          </p>
        </div>
      )}
      <div class="facts">
        {!wide && <Fact label={w('web.eval.verdict')}>{d.verdict ? <Verdict verdict={d.verdict} /> : w('tree.judging')}</Fact>}
        {!wide && d.agreement && <Fact label={w('web.eval.agreement')}>{d.agreement}</Fact>}
        {!wide && d.judged_by && <Fact label={w('web.eval.judged_by')}>{d.judged_by}</Fact>}
        <Fact label={w('eval_view.findings')} go={() => to.view(d.eval, 'h:findings')}>{d.findings.length}</Fact>
        <Fact label={w('eval_view.checks')} go={() => to.view(d.eval, 'h:checks')}>
          {check && (
            <>
              {/* A desktop says it by colour alone (D11.3). */}
              {!wide && <span class={check.mark === '✓' ? 'good' : check.mark === '✗' ? 'needs' : undefined}>{`${check.mark} `}</span>}
              <span class={wide ? (check.mark === '✓' ? 'good' : check.mark === '✗' ? 'needs' : undefined) : undefined}>{`${check.text} ${check.result}`}</span>
            </>
          )}
        </Fact>
      </div>
      <Head label={w('web.eval.asks')} n={wide ? undefined : d.asks.length} />
      <div class="detail-asks">
        {d.asks.map((a) => <AskLine key={a.unit} title={a.title} aside={a.harness} onGo={() => to.work(a.unit)} />)}
      </div>
      {d.sealed ? (
        <button class="detail-sealed" type="button" onClick={() => to.seal(d.sealed!.seal)}>
          {fill('web.eval.sealed_in', { n: String(d.sealed.n) })}
          <span class="tree-more" aria-hidden="true">›</span>
        </button>
      ) : (
        !d.judging && (
          <div class="detail-note">
            <p class={wide ? 'detail-note-head needs' : 'detail-note-head'}>{w('tree.not_sealed')}</p>
            <p class="detail-line dim">{fill('web.eval.seal_what', { n: String(d.asks.length) })}</p>
          </div>
        )
      )}
    </Frame>
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
  const n = sealedCount(project, d.seal) ?? asks.length;
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
                  <Verdict verdict={d.eval.verdict} />
                  {d.eval.agreement && ` · ${d.eval.agreement}`}
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
            <Verdict verdict={d.eval.verdict} />
            {d.eval.agreement && ` · ${d.eval.agreement}`}
          </Fact>
        )}
        <Fact label={w('web.seal.receipt')}><span class="mono">{d.receipt}</span></Fact>
      </div>
      <Head label={w('web.seal.asks')} n={n} />
      </>
      )}
      <div class="detail-asks">
        {asks.map((a) => <AskLine key={a.unit} title={a.title} aside={a.harness} onGo={() => to.work(a.unit)} />)}
        {next && <div ref={end} class="tree-more-rows" aria-hidden="true" />}
      </div>
      <div class="detail-note">
        {!wide && <Holds d={d} />}
        <p class="detail-line dim">{w('web.seal.final')}</p>
      </div>
    </Frame>
  );
}
