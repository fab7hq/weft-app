// A Seal's one dialog. When its Eval left questions, they come first, one at
// a time (17.4), each answered before the next, then a review of every answer
// with the decision and its optional reason (17.5), and only there Seal; they
// take the screen below the bar. With none, it stays in the bar's place: the
// work it seals, the decision (accepted unless another is picked) and, for
// the others, an optional reason. Picking sends nothing; Seal records it all
// at once, and nothing is typed into an agent.
import { signal } from '@preact/signals';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import * as m from '../machine';
import * as A from '../answering';
import { DISPOSITIONS, questionsRead, reasonsFor, sealMessage, type Disposition } from '../seal';
import { fill, w } from '../words';
import { act } from './Asked';
import { said } from './Bar';

/** The Seal being decided: the work or the Eval it seals, and what the dialog says of it. */
export const sealing = signal<{
  project: string; unit?: string; eval?: string;
  title: string; asks: number;
  /** What Weft read of the harness's setup: said here, and the Seal can still go. */
  warning?: string | null;
} | null>(null);

/** The work as the dialogs name it: `health endpoint · 2 Asks`. */
export const workName = (title: string, asks: number) =>
  asks === 1 ? fill('dialog.eval.work_one', { title }) : fill('dialog.eval.work', { title, n: String(asks) });

/** A tone's colours, as CSS properties: its fill, its text on a tinted ground, and that ground. */
const TONES: Record<A.Tone, [string, string, string]> = {
  teal: ['--fab7-teal', '--fab7-teal', '--fab7-teal-bg'],
  blue: ['--fab7-accent', '--fab7-accent', '--fab7-selected'],
  amber: ['--fab7-amber', '--fab7-amber-text', '--fab7-amber-bg'],
  red: ['--fab7-danger', '--fab7-danger', '--fab7-danger-bg'],
  grey: ['--fab7-muted', '--fab7-muted', '--fab7-surface'],
};
const tone = (t: A.Tone) => {
  const [c, t2, b] = TONES[t];
  return `--c: var(${c}); --t: var(${t2}); --b: var(${b})`;
};

/** A word as a button says it: its first letter capital. */
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** The questions as far as they are known: being read, none, or being answered. */
type Questions = 'reading' | null | A.Answering;

export function SealDialog() {
  const on = sealing.value;
  const [disposition, setDisposition] = useState<Disposition>('accepted');
  const [reason, setReason] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Questions>('reading');
  // The own-words field, and since when the question shown is shown.
  const [words, setWords] = useState('');
  const shownAt = useRef(0);
  const close = () => {
    sealing.value = null;
    setDisposition('accepted');
    setReason(null);
    setQuestions('reading');
    setWords('');
  };
  useLayoutEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && close();
    addEventListener('keydown', esc);
    return () => removeEventListener('keydown', esc);
  }, []);
  /** Show `a`: its question's time counts from now, and one that takes words has them back. */
  const show = (a: A.Answering) => {
    shownAt.current = performance.now();
    const q = A.shown(a);
    setWords(q && A.answersOf(q).includes('words') ? (a.given[a.at]?.words ?? '') : '');
    setQuestions(a);
  };
  // Its Eval's questions are read once, as it opens.
  useEffect(() => {
    if (!on) return;
    let gone = false;
    setQuestions('reading');
    // Not connected: nothing to ask, and the Seal says why it cannot go.
    const read = m.request(questionsRead(on.project, on.eval ?? on.unit ?? '')) ?? Promise.resolve(null);
    void read.then((answer) => {
      if (gone || sealing.value !== on) return;
      const read = answer?.type === 'ok' ? (answer.questions as { questions?: A.Question[] } | undefined)?.questions : undefined;
      if (read?.length) show(A.start(read));
      else setQuestions(null);
    });
    return () => {
      gone = true;
    };
  }, [on]);
  if (!on) return null;
  const { project, unit, eval: eval_ } = on;
  const answers = questions && questions !== 'reading' ? A.sealAnswers(questions) : null;
  const seal = async () => {
    // The Seal goes with every answer, or not at all.
    if (questions === 'reading' || (questions && !answers)) return;
    close();
    const refused = await act(sealMessage({ project, ...(unit ? { unit } : {}), ...(eval_ ? { eval: eval_ } : {}) }, disposition, reason, answers), null);
    if (refused) said.value = String(refused.message);
  };
  const pick = (d: Disposition) => {
    setDisposition(d);
    setReason(null);
  };
  const work = workName(on.title, on.asks);

  if (questions === 'reading') {
    return (
      <div class="pending-bar seal-bar" role="dialog" aria-label={w('dialog.seal.title')}>
        <div class="pending-head">
          <span class="pending-what">{w('dialog.seal.title')}</span>
          <span class="pending-into">{work}</span>
        </div>
        <p class="pending-why" aria-busy="true">{w('seal.q.reading')}</p>
        <div class="pending-acts">
          <span class="spacer" />
          <button type="button" class="tree-act" onClick={close}>{w('act.cancel')}</button>
        </div>
      </div>
    );
  }

  if (questions) {
    const title = fill('seal.q.title', { title: on.title });
    const q = A.shown(questions);
    return (
      <div class="seal-asks" role="dialog" aria-label={title}>
        <div class={`seal-col${q ? '' : ' seal-col--review'}`}>
          <div class="seal-top">
            <span class="seal-title">{title}</span>
            <span class="spacer" />
            <span>{q ? A.counter(questions) : fill('seal.q.all_answered', { n: String(questions.questions.length) })}</span>
            <button type="button" class="seal-quiet" onClick={close}>{w('act.cancel')}</button>
          </div>
          <div class="seal-progress" role="progressbar" aria-valuemin={0} aria-valuemax={questions.questions.length} aria-valuenow={Math.min(questions.at + 1, questions.questions.length)}>
            <div style={{ width: `${(100 * Math.min(questions.at + 1, questions.questions.length)) / questions.questions.length}%` }} />
          </div>
          {q
            ? <Asking a={questions} q={q} words={words} setWords={setWords} show={show} setQuestions={setQuestions} shownAt={shownAt.current} />
            : <Review a={questions} show={show} disposition={disposition} reason={reason} pick={pick} setReason={setReason} warning={on.warning ?? null} seal={() => void seal()} />}
        </div>
      </div>
    );
  }

  const records = fill(reason ? 'dialog.seal.records_why' : 'dialog.seal.records', { disposition: w(`seal.d.${disposition}`), work });
  return (
    <div class="pending-bar seal-bar" role="dialog" aria-label={w('dialog.seal.title')}>
      <div class="pending-head">
        <span class="pending-what">{w('dialog.seal.title')}</span>
        <span class="pending-into">{work}</span>
      </div>
      <div class="seal-kv">
        <span class="ask-eyebrow">{w('dialog.seal.decision')}</span>
        <Decisions disposition={disposition} pick={pick} />
      </div>
      {reasonsFor(disposition).length > 0 && (
        <div class="seal-kv">
          <span class="ask-eyebrow">{w('dialog.seal.why')}<span class="seal-optional seal-optional--inline">{` · ${w('dialog.seal.optional')}`}</span></span>
          <Reasons disposition={disposition} reason={reason} setReason={setReason} />
          <span class="seal-optional seal-optional--after">{w('dialog.seal.optional')}</span>
        </div>
      )}
      {/* What Weft read of the harness's setup takes the note's place by the acts, as the Ask's does; the note goes above. */}
      {on.warning && <p class="pending-why seal-records">{records}</p>}
      <div class="pending-acts">
        {on.warning
          ? <><span class="pending-why ask-hint pending-warn">{on.warning}</span><span class="spacer" /></>
          : <span class="pending-why seal-records">{records}</span>}
        <button type="button" class="tree-act" onClick={close}>{w('act.cancel')}</button>
        <button type="button" class="tree-act tree-act--go" onClick={() => void seal()}>{w('act.seal')}</button>
      </div>
    </div>
  );
}

/** The decision, each in its own colour: the one picked fills with it, the others are outlined with a dot of theirs. */
function Decisions({ disposition, pick }: { disposition: Disposition; pick: (d: Disposition) => void }) {
  return (
    <div class="seal-seg seal-seg--decision" role="radiogroup" aria-label={w('seal.q.decision')}>
      {DISPOSITIONS.map((d) => (
        <button key={d} type="button" class="seal-opt" role="radio" aria-checked={d === disposition} style={tone(A.decisionTone(d))} onClick={() => pick(d)}>
          <i class="seal-dot" aria-hidden="true" />{capital(w(`seal.d.${d}`))}
        </button>
      ))}
    </div>
  );
}

/** The optional reasons of a decision that is not a yes: the one picked in its decision's colour. */
function Reasons({ disposition, reason, setReason }: { disposition: Disposition; reason: string | null; setReason: (r: string | null) => void }) {
  return (
    <div class="seal-seg seal-seg--reason" role="radiogroup" aria-label={w('seal.q.why')} style={tone(A.decisionTone(disposition))}>
      {reasonsFor(disposition).map((r) => (
        <button key={r} type="button" class="seal-opt" role="radio" aria-checked={r === reason} onClick={() => setReason(r === reason ? null : r)}>{capital(w(`seal.r.${r}`))}</button>
      ))}
    </div>
  );
}

/** One question: where it comes from, the behaviour, why, what it asks, its answers; Back and Next. */
function Asking({ a, q, words, setWords, show, setQuestions, shownAt }: {
  a: A.Answering; q: A.Question; words: string; setWords: (w: string) => void;
  show: (a: A.Answering) => void; setQuestions: (a: A.Answering) => void; shownAt: number;
}) {
  const ms = () => Math.round(performance.now() - shownAt);
  const given = a.given[a.at];
  const takesWords = A.answersOf(q).includes('words');
  const typed = takesWords && words.trim() !== '';
  // Typed words are the answer; Not sure only while nothing is typed.
  const picked = (answer: string) => !typed && given?.answer === answer;
  const ready = typed || (!!given && given.answer !== 'words');
  const answer = (x: string) => {
    const next = A.answer(a, x, null, ms());
    if (!next) return;
    setWords('');
    setQuestions(next);
  };
  const next = () => {
    let now = a;
    if (typed) now = A.answer(now, 'words', words, ms()) ?? now;
    else if (given?.answer === 'words') now = A.unanswer(now);
    const moved = A.forward(now);
    if (moved) show(moved);
  };
  const back = A.back(a);
  const before = A.beforeLine(q);
  const label = A.label(q);
  return (
    <>
      {before && <p class="seal-before">{before}</p>}
      <p class="seal-behaviour">{q.behaviour}</p>
      {q.why && <p class="seal-why">{q.why}</p>}
      <p class="seal-label" id="seal-label">{label}</p>
      <div class="seal-answers" role="radiogroup" aria-labelledby="seal-label">
        {A.answersOf(q).map((x) => x === 'words'
          ? (
            <label key={x} class="seal-answer seal-answer--words" data-typed={typed || undefined} style={tone(A.answerTone(x))}>
              <i class="seal-dot" aria-hidden="true" />
              <input type="text" value={words} placeholder={w('seal.a.words')} aria-label={w('seal.a.words')} onInput={(e) => setWords(e.currentTarget.value)} onKeyDown={(e) => e.key === 'Enter' && next()} />
            </label>
          )
          : (
            <button key={x} type="button" class="seal-answer" role="radio" aria-checked={picked(x)} style={tone(A.answerTone(x))} onClick={() => answer(x)}>
              <i class="seal-dot" aria-hidden="true" /><span>{A.answerWords(x)}</span>{picked(x) && <span class="seal-check">✓</span>}
            </button>
          ))}
      </div>
      <div class="seal-acts">
        <button type="button" class="seal-quiet seal-back" data-waits={!back || undefined} onClick={() => back && show(back)}>{w('seal.q.back')}</button>
        <span class="spacer" />
        <button type="button" class="seal-go" data-waits={!ready || undefined} onClick={next}>{w('seal.q.next')}</button>
      </div>
    </>
  );
}

/** Every answer, each with Change; the decision and its reason; Back and Seal. */
function Review({ a, show, disposition, reason, pick, setReason, warning, seal }: {
  a: A.Answering; show: (a: A.Answering) => void; disposition: Disposition; reason: string | null;
  pick: (d: Disposition) => void; setReason: (r: string | null) => void; warning: string | null; seal: () => void;
}) {
  const back = A.back(a);
  return (
    <>
      <h2 class="seal-answers-title">{w('seal.q.your_answers')}</h2>
      <ul class="seal-review">
        {a.questions.map((q, i) => {
          const g = a.given[i];
          const before = A.beforeLine(q);
          const answer = g?.answer ?? 'not_sure';
          return (
            <li key={q.id} class="seal-row">
              <div class="seal-row-text">
                <span>{q.behaviour}</span>
                {before && <span class="seal-before">{before}</span>}
              </div>
              <div class="seal-row-answer">
                <span class="seal-pill" style={tone(A.answerTone(answer))}><i class="seal-dot" aria-hidden="true" />{A.answerWords(answer, g?.words)}</span>
                <span class="spacer" />
                <button type="button" class="seal-quiet" aria-label={`${w('seal.q.change')}: ${q.behaviour}`} onClick={() => show(A.change(a, i))}>{w('seal.q.change')}</button>
              </div>
            </li>
          );
        })}
      </ul>
      <div class="seal-decide">
        <span class="seal-key">{w('seal.q.decision')}</span>
        <Decisions disposition={disposition} pick={pick} />
      </div>
      {reasonsFor(disposition).length > 0 && (
        <div class="seal-decide">
          <span class="seal-key">{w('seal.q.why')}<span class="seal-optional seal-optional--inline">{` · ${w('dialog.seal.optional')}`}</span></span>
          <Reasons disposition={disposition} reason={reason} setReason={setReason} />
          <span class="seal-optional seal-optional--after">{w('dialog.seal.optional')}</span>
        </div>
      )}
      <div class="seal-acts seal-acts--review">
        <button type="button" class="seal-quiet seal-back" data-waits={!back || undefined} onClick={() => back && show(back)}>{w('seal.q.back')}</button>
        <span class="spacer" />
        {warning ? <span class="seal-records ask-hint pending-warn">{warning}</span> : <span class="seal-records">{w('seal.q.records')}</span>}
        {A.maySeal(a) && <button type="button" class="seal-go" onClick={seal}>{w('act.seal')}</button>}
      </div>
    </>
  );
}
