// A project's settings: YOUR DECISIONS, read when the page opens. Nothing in it is pressable.
import { useEffect, useState } from 'preact/hooks';
import * as m from '../machine';
import { type Decisions, type Part, rowParts, shown, toneOf } from '../decisions';
import { tone } from './Seal';

const said = (parts: Part[]) => parts.map((p, i) => (p.mono ? <span key={i} class="dec-file">{p.text}</span> : p.text));

/** Each decision: its dot and behaviour, then its answer in its colour, its day and its files; a stale one says what changed and is marked. */
export function DecisionsSection({ project }: { project: string }) {
  const [read, setRead] = useState<Decisions | null>(null);
  useEffect(() => {
    let on = true;
    setRead(null);
    void m.readDecisions(project).then((d) => on && setRead(d));
    return () => {
      on = false;
    };
  }, [project]);
  const d = shown(read);
  if (!d) return null;
  return (
    <section class="dec-section" aria-label={d.title}>
      <div class="dec-head">
        <span>{d.title}</span>
        <span class="dec-count">{d.count}</span>
      </div>
      {d.list.map((x) => (
        <div key={x.id} class="dec-row" style={tone(toneOf(x))}>
          <svg class="dec-dot" width="8" height="8" viewBox="0 0 8 8" aria-hidden="true"><circle cx="4" cy="4" r="4" fill="var(--c)" /></svg>
          <div class="dec-text">
            <span>{x.behaviour}</span>
            <span class="dec-sub"><span class="dec-answer">{x.answer_words}</span>{said(rowParts(x))}</span>
          </div>
          {x.stale && <span class="dec-changed">{d.changed}</span>}
        </div>
      ))}
    </section>
  );
}
