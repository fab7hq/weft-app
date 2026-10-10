// A session's Details (M11.5, D11.5) and the earlier sessions (M11.6,
// D11.6), as weftd holds them (ADR-0029 D1): whichever program runs a
// session, it reads the same. Resume this session resumes exactly its id,
// after a confirm (D4); a running one goes to its agent, or, run by another
// program, says why it cannot (D9).
import { useEffect, useRef, useState } from 'preact/hooks';
import type { Machine } from '../api';
import { clock, stamp, weekday } from '../bar';
import * as m from '../machine';
import { fill, stateWord, w } from '../words';
import { offerResume, shortId } from './Asked';
import { said } from './Bar';
import { AskLine, Fact, Frame, Grid, Head, moves, useRead } from './Details';
import { sealName, stateOf } from './Tree';

/** A session's Details (`read session`). */
interface Held {
  session: string;
  harness: string;
  state: m.Session['state'];
  turn: m.Session['turn'];
  started: number;
  last: number;
  resume: boolean;
  asks: { unit: string; title: string; harness: string; word: 'asking' | 'asked' | 'evaled' | 'sealed' | 'cancelled'; eval: number | null; seal: number | null }[];
  agent: string | null;
}

/** A session as AGENTS would list it, for the confirm. */
const asRow = (d: Held): m.Session => ({
  session: d.session, harness: d.harness, state: d.state, turn: d.turn, title: d.asks[0]?.title ?? null, at: d.last, asks: d.asks.length, agent: d.agent, ask: null,
});

const madeIn = (n: number) => (n === 1 ? w('web.session.asks_one') : fill('web.session.asks', { n: String(n) }));

export function SessionDetails({ machine, project, session, wide = false }: { machine: Machine; project: string; session: string; wide?: boolean }) {
  const row = m.tree.value.find((p) => p.project === project)?.agents.rows.find((r) => r.session === session);
  // Read again as its row in the tree changes.
  const d = useRead<Held>({ project, session }, 'session', [JSON.stringify(row)]);
  const to = moves(machine, project);
  if (!d) return <Frame machine={machine} project={project} label="" crumbs={[]} wide={wide} />;
  const live = d.state === 'running';
  const s = asRow(d);
  const state = d.state === 'ended' ? `${w('state.ended')} ${clock(d.last)}` : stateOf(s);
  const resume = () => (d.resume ? offerResume(project, s) : void (said.value = w('resume.nothing')));
  // Run by another program, it has no pane to go to (D9).
  const goTo = () => (d.agent ? to.agent(d.agent) : void (said.value = fill('why.elsewhere', { harness: d.harness })));
  const chip = d.state === 'quiet' ? stateOf(s) : w(`state.${d.state}`).toUpperCase();
  return (
    <Frame
      machine={machine}
      project={project}
      label={`${d.harness} · ${shortId(d.session)}`}
      crumbs={wide ? [{ text: d.harness }, { text: state, tone: 'dim' }] : [{
        text: (
          <>
            <span class={live && d.turn === 'waiting' ? 'needs crumb-dot' : live ? 'good crumb-dot' : 'dim crumb-dot'}>{live ? '●' : '○'}</span>
            {d.harness}
            <span class="chip detail-chip">{chip}</span>
          </>
        ),
      }]}
      right={d.session.slice(0, 8)}
      mono
      aside={wide ? undefined : [d.state === 'ended' ? `${w('state.ended')} ${stamp(d.last)}` : stateOf(s), madeIn(d.asks.length)].join(' · ')}
      wide={wide}
      acts={
        live ? (
          <button class="tree-act tree-act--go" type="button" onClick={goTo}>{w('web.session.go')}</button>
        ) : (
          <button class="tree-act tree-act--go" type="button" onClick={resume}>{w('web.session.resume')}</button>
        )
      }
    >
      {wide ? (
        // D11.5: its state large, then its facts as labelled lines.
        <>
          <p class="summary-head">
            <span class={live && d.turn === 'waiting' ? 'needs' : live ? 'good' : 'dim'}>{live ? '● ' : '○ '}</span>
            {state}
          </p>
          <div class="detail-block">
            <Grid rows={[
              [w('web.session.harness'), d.harness],
              [w('web.session.started'), stamp(d.started)],
              ...(d.state === 'ended' ? [[w('state.ended'), stamp(d.last)] as [string, string]] : []),
              [w('web.session.session'), <span class="mono">{d.session.slice(0, 8)}</span>],
              [w('web.session.project'), project],
            ]} />
          </div>
          <Head label={w('web.session.made')} n={d.asks.length} inline />
        </>
      ) : (
        <>
          <div class="facts">
            <Fact label={w('web.session.state')}>{state}</Fact>
            <Fact label={w('web.session.started')}>{stamp(d.started)}</Fact>
            <Fact label={w('web.session.session')}><span class="mono">{shortId(d.session)}</span></Fact>
            <Fact label={w('web.session.project')}>{project}</Fact>
          </div>
          <Head label={w('web.session.made')} n={d.asks.length} />
        </>
      )}
      <div class="detail-asks">
        {/* A session's Asks keep their state word (D6), a cancelled one too (D12.2); a desktop adds its Seal or Eval. */}
        {d.asks.map((a) => {
          const where = wide && (a.seal !== null ? ` · ${sealName(a.seal)}` : a.eval !== null ? ` · ${fill('tree.eval', { n: String(a.eval) })}` : '');
          return <AskLine key={a.unit} title={a.title} aside={`${stateWord(a.word)}${where || ''}`} onGo={() => to.work(a.unit)} />;
        })}
      </div>
      {wide && !live && <p class="detail-line dim detail-after">{fill('web.session.resume_how', { harness: d.harness, session: d.session.slice(0, 8) })}</p>}
    </Frame>
  );
}

/** One of the earlier sessions (`read sessions`). */
interface Earlier {
  session: string;
  harness: string;
  title: string | null;
  asks: number;
  at: number;
  group: 'today' | 'yesterday' | 'week' | 'earlier';
}

const GROUPS = ['today', 'yesterday', 'week', 'earlier'] as const;

/** When an earlier session ended, as its group says it: a time today and yesterday, a weekday this week, else its day. */
const when = (e: Earlier) => (e.group === 'week' ? weekday(e.at) : e.group === 'earlier' ? stamp(e.at).slice(0, 10) : clock(e.at));

/**
 * The earlier sessions (M11.6, D11.6): every ended session past the tree's,
 * newest first, grouped by the Mac's date, a page at a time as it scrolls;
 * the search sends what is typed, and keeps the groups.
 */
export function EarlierSessions({ machine, project, wide = false }: { machine: Machine; project: string; wide?: boolean }) {
  const [q, setQ] = useState('');
  const [got, setGot] = useState<{ q: string; rows: Earlier[]; next: string | null; total: number } | null>(null);
  const asked = useRef('');
  const reading = useRef(false);
  const readFrom = async (query: string, after: string | null) => {
    asked.current = query;
    if (after) reading.current = true;
    const answer = await m.request({ type: 'read', what: 'sessions', project, ...(query ? { q: query } : {}), ...(after ? { after } : {}) });
    if (after) reading.current = false;
    // An answer to what was typed before is not shown.
    if (answer?.type !== 'ok' || asked.current !== query) return;
    const page = answer.sessions as { total: number; rows: Earlier[]; next: string | null };
    setGot((had) => ({ q: query, rows: after && had ? [...had.rows, ...page.rows] : page.rows, next: page.next, total: page.total }));
  };
  useEffect(() => void readFrom(q, null), [q]);
  const end = useRef<HTMLDivElement>(null);
  const next = got?.next ?? null;
  useEffect(() => {
    const el = end.current;
    if (!el || !next) return;
    const seen = new IntersectionObserver((e) => e.some((x) => x.isIntersecting) && !reading.current && void readFrom(q, next));
    seen.observe(el);
    return () => seen.disconnect();
  }, [next, q]);
  const to = moves(machine, project);
  const p = m.tree.value.find((x) => x.project === project);
  const count = p?.agents.earlier ?? got?.total ?? 0;
  const rows = got?.rows ?? [];
  return (
    <Frame
      machine={machine}
      project={project}
      label={w('earlier.title')}
      crumbs={wide ? [{ text: w('earlier.title') }, { text: `${project} · ${fill('web.earlier.wide', { n: String(count) })}`, tone: 'dim' }] : [{ text: w('earlier.title') }]}
      right={wide ? undefined : fill('web.earlier.count', { n: String(count) })}
      wide={wide}
      acts={wide ? <span class="dim detail-note">{w('web.earlier.foot')}</span> : undefined}
    >
      <label class="earlier-search">
        <span class="earlier-glass" aria-hidden="true">⌕</span>
        <input
          class="earlier-field"
          type="search"
          aria-label={w('web.earlier.search')}
          placeholder={w('web.earlier.search')}
          value={q}
          onInput={(e) => setQ((e.target as HTMLInputElement).value)}
        />
      </label>
      <div class="earlier" role="list" aria-label={w('earlier.title')}>
        {GROUPS.map((g) => {
          const mine = rows.filter((r) => r.group === g);
          if (mine.length === 0) return null;
          return (
            <div key={g} role="none">
              <Head label={w(`earlier.${g}`)} n={mine.length} inline={wide && 'plain'} />
              {mine.map((r) => (
                <button key={r.session} class="earlier-row" role="listitem" type="button" aria-label={`${r.harness} · ${r.title ?? w('tree.no_ask')}`} onClick={() => to.session(r.session)}>
                  {wide ? (
                    <>
                      <span class="agent-dot">○</span>
                      <span class="agent-harness agent-harness--off">{r.harness}</span>
                      <span class={r.title ? 'earlier-title' : 'earlier-title agent-title--none'}>{r.title ?? w('tree.no_ask')}</span>
                      <span class="agent-state">{w('state.ended')}</span>
                      <span class="earlier-id">{r.session.slice(0, 8)}</span>
                      <span class="agent-at">{when(r)}</span>
                    </>
                  ) : (
                    <span class="agent-lines">
                      <span class="agent-top">
                        <span class="agent-dot">○</span>
                        <span class="agent-harness agent-harness--off">{r.harness}</span>
                        <span class="agent-state agent-state--off">{w('state.ended')}</span>
                        <span class="agent-at">{when(r)}</span>
                      </span>
                      <span class={r.title ? 'agent-title' : 'agent-title agent-title--none'}>{r.title ?? w('tree.no_ask')}</span>
                    </span>
                  )}
                  <span class="tree-more" aria-hidden="true">›</span>
                </button>
              ))}
            </div>
          );
        })}
        {next && <div ref={end} class="tree-more-rows" aria-hidden="true" />}
      </div>
    </Frame>
  );
}
