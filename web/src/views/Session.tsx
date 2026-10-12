// A session's Details (M11.5, D11.5), as weftd holds it: whichever program
// runs a session, it reads the same. Resume resumes exactly its id, at once:
// the page is that one session. A running one goes to its agent, or, run by
// another program, says why it cannot.
import type { Machine } from '../api';
import { clock, stamp } from '../bar';
import * as m from '../machine';
import { fill, stateWord, w } from '../words';
import { resume as again, shortId } from './Asked';
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
  /** It runs with no agent of Weft's, and Resume joins it there. */
  joins: boolean;
  asks: { unit: string; title: string; harness: string; word: 'asking' | 'asked' | 'evaled' | 'sealed' | 'cancelled'; eval: number | null; seal: number | null }[];
  agent: string | null;
}

/** A session as AGENTS would list it, for its state word. */
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
  // Ended when Weft on the machine stopped uncleanly, and reopened since (D13.5).
  const reopened = d.state === 'ended' && !!m.tree.value.find((p) => p.project === project)?.reopened;
  const s = asRow(d);
  // Running: its turn and when it was last heard, as the cards draw it (M11.9, D11.9).
  const state = d.state === 'ended' ? `${w('state.ended')} ${clock(d.last)}` : live ? `${stateOf(s)} ${clock(d.last)}` : stateOf(s);
  const resume = () => (d.resume ? void again(project, d.harness, d.session) : void (said.value = w('resume.nothing')));
  // Run by another program, it has no pane to go to.
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
      aside={wide ? undefined : [d.state === 'ended' ? `${w('state.ended')} ${stamp(d.last)}` : state, madeIn(d.asks.length)].join(' · ')}
      wide={wide}
      acts={
        live && !d.joins ? (
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
            {reopened ? fill('web.reopened.ended', { time: clock(d.last), machine: machine.name }) : state}
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
        {/* A session's Asks keep their state word, a cancelled one too; a desktop adds its Seal or Eval. */}
        {d.asks.map((a) => {
          const where = wide && (a.seal !== null ? ` · ${sealName(a.seal)}` : a.eval !== null ? ` · ${fill('tree.eval', { n: String(a.eval) })}` : '');
          return <AskLine key={a.unit} title={a.title} aside={`${stateWord(a.word)}${where || ''}`} onGo={() => to.work(a.unit)} />;
        })}
      </div>
      {wide && !live && <p class="detail-line dim detail-after">{fill('web.session.resume_how', { harness: d.harness, session: d.session.slice(0, 8) })}</p>}
      {/* M11.9, D11.9: running with no agent of Weft's, Resume joins it. */}
      {d.joins && (
        <p class="detail-line dim detail-after">
          {wide ? fill('web.session.resume_joins', { harness: d.harness, session: d.session.slice(0, 8) }) : fill('web.session.resume_joins_here', { harness: d.harness })}
        </p>
      )}
    </Frame>
  );
}
