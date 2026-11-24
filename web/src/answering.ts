// The Seal's questions (17.4, 17.5), as weft-core's `seal_questions` holds
// them: one question at a time, each answered before the next, then a review
// of every answer, and only then the Seal. A question carried from an earlier
// Seal says so in one quiet line. What the person picks is theirs: nothing is
// sent until the Seal. Each step returns a new state, or null when refused.
import { fill, w } from './words';

/** Where a question comes from before this Eval: the decision it answers again, and the Seal and day it was made. */
export interface Before {
  decision: string;
  seal: string;
  /** `2026-11-10`, as the record writes it. */
  date: string;
  /** What was answered then, for a decision asked again. */
  answer?: string | null;
  /** Asked again because a file it is about has changed since: those files. */
  stale?: boolean;
  changed?: string[];
}

/** A rule of the project a question's behaviour goes against, as RingFrame cites it: `./AGENTS.md@<commit>`, and its words. */
export interface QuestionRule {
  source: string;
  quote?: string;
}

/** A question an Eval left for its Seal, as RingFrame stored it. */
export interface Question {
  id: string;
  /** `did_you_want`, `still_want` or `what_did_you_mean`. */
  ask: string;
  behaviour: string;
  why?: string | null;
  /** Left not sure at an earlier Seal. */
  asked_before?: Before | null;
  /** About a behaviour that goes against an earlier decision. */
  against?: Before | null;
  /** The rules of the project it goes against. */
  rules?: QuestionRule[] | null;
}

/** One answer given: what, the person's words for `words`, and how long the question was shown before it. */
export interface Given {
  answer: string;
  words: string | null;
  ms: number;
}

/** What the Seal sends of one answer. */
export interface SealAnswer {
  question: string;
  answer: string;
  words?: string;
  ms?: number;
}

/** Where the person is in the Seal's questions: `at` is the question shown, or `questions.length` for the review. */
export interface Answering {
  questions: Question[];
  given: (Given | null)[];
  at: number;
}

/** The answers a question takes, in the order they are offered. `words` is the person's own. */
export function answersOf(q: Question): string[] {
  switch (q.ask) {
    case 'did_you_want':
      return ['wanted', 'not_wanted', 'not_sure'];
    case 'still_want':
      return ['now', 'later', 'drop', 'not_sure'];
    default:
      return ['words', 'not_sure'];
  }
}

/** What it asks: `Did you want this?`, `Still want it?` or `What did you mean?`. */
export function label(q: Question): string {
  return w(`seal.q.${q.ask === 'did_you_want' || q.ask === 'still_want' ? q.ask : 'what_did_you_mean'}`);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** `10 Nov` for `2026-11-10`. */
export function day(date: string): string {
  const [, m, d] = date.split('-');
  const month = Number(m);
  const n = Number(d);
  return Number.isInteger(month) && month >= 1 && month <= 12 && d && Number.isInteger(n) ? `${n} ${MONTHS[month - 1]}` : date;
}

/** The quiet line above a question asked before: `Asked before · not sure on 10 Nov`, or `… not wanted on 3 Nov`;
 * `Asked before · wanted on 3 Nov` for a decision asked again because its file changed;
 * `Against a rule of this project` for one against a rule. Null for this Eval's own. */
export function beforeLine(q: Question): string | null {
  const b = q.asked_before;
  if (b?.stale) {
    const key = b.answer === 'wanted' ? 'seal.q.before_wanted' : b.answer === 'not_wanted' ? 'seal.q.before_not_wanted' : 'seal.q.before_answered';
    return fill(key, { date: day(b.date) });
  }
  if (b) return fill('seal.q.before_not_sure', { date: day(b.date) });
  if (q.against) return fill('seal.q.before_not_wanted', { date: day(q.against.date) });
  if (q.rules?.length) return w('seal.q.against_rule');
  return null;
}

/** Why a decision is asked again: `src/session.rs has changed since, so it’s asked again.`, the files apart to set them in mono. Null for any other question. */
export function changedLine(q: Question): [string, string, string] | null {
  const b = q.asked_before;
  if (!b?.stale || !b.changed?.length) return null;
  const files = b.changed.join(', ');
  const said = w(b.changed.length === 1 ? 'seal.q.changed_since' : 'seal.q.changed_since_n');
  const at = said.indexOf('{files}');
  return at < 0 ? [said, '', ''] : [said.slice(0, at), files, said.slice(at + '{files}'.length)];
}

/** A rule's file as the person reads it: `./AGENTS.md@3f2a9c1` is `AGENTS.md`, `api/docs/rules.md@abc` stays `api/docs/rules.md`. */
export function ruleFile(source: string): string {
  const at = source.lastIndexOf('@');
  const path = at < 0 ? source : source.slice(0, at);
  return path.startsWith('./') ? path.slice(2) : path;
}

/** The rule a question goes against: its file and its words in quotes. Null for one against none. */
export function ruleOf(q: Question): { label: string; quote: string } | null {
  const r = q.rules?.[0];
  return r ? { label: ruleFile(r.source), quote: r.quote ? `“${r.quote}”` : '' } : null;
}

/** An answer in the words a person reads; the person's own in quotes. */
export function answerWords(answer: string, words?: string | null): string {
  return answer === 'words' && words ? `“${words}”` : w(`seal.a.${answer}`);
}

export type Tone = 'teal' | 'blue' | 'amber' | 'red' | 'grey';

/** The colour an answer is said in, the same wherever it is shown: teal for what the person wants, amber for what they do not (a decision, never an error), blue for later and their own words, grey for not sure. */
export function answerTone(answer: string): Tone {
  switch (answer) {
    case 'wanted':
    case 'now':
      return 'teal';
    case 'not_wanted':
    case 'drop':
      return 'amber';
    case 'later':
    case 'words':
      return 'blue';
    default:
      return 'grey';
  }
}

/** The colour a Seal's decision is said in, on the answers' scale, cool to hot: teal accepted, blue parked, red rejected, grey dropped. A reason picked takes its decision's colour. */
export function decisionTone(disposition: string): Tone {
  switch (disposition) {
    case 'accepted':
      return 'teal';
    case 'deferred':
      return 'blue';
    case 'rejected':
      return 'red';
    default:
      return 'grey';
  }
}

export function start(questions: Question[]): Answering {
  return { questions, given: questions.map(() => null), at: 0 };
}

/** The question shown, none on the review. */
export const shown = (a: Answering): Question | null => a.questions[a.at] ?? null;

/** `Question 2 of 5`. */
export const counter = (a: Answering): string => fill('seal.q.counter', { n: String(a.at + 1), of: String(a.questions.length) });

/** Answer the question shown. `words` needs some; another answer takes none. A question answered again keeps its new answer. */
export function answer(a: Answering, picked: string, words: string | null, ms: number): Answering | null {
  const q = shown(a);
  if (!q || !answersOf(q).includes(picked)) return null;
  const said = words?.trim() || null;
  if (picked === 'words' && !said) return null;
  const given = a.given.slice();
  given[a.at] = { answer: picked, words: picked === 'words' ? said : null, ms };
  return { ...a, given };
}

/** The answer of the question shown taken back: it waits for one again. */
export function unanswer(a: Answering): Answering {
  const given = a.given.slice();
  given[a.at] = null;
  return { ...a, given };
}

/** On to the next question, or to the review after the last: only once the one shown has an answer. */
export function forward(a: Answering): Answering | null {
  if (a.at >= a.questions.length || !a.given[a.at]) return null;
  return { ...a, at: a.at + 1 };
}

export function back(a: Answering): Answering | null {
  return a.at === 0 ? null : { ...a, at: a.at - 1 };
}

/** From the review, back to one question to change its answer. */
export function change(a: Answering, i: number): Answering {
  return i >= 0 && i < a.questions.length ? { ...a, at: i } : a;
}

/** On the review, with every question answered: the Seal can go. Not sure counts as an answer. */
export function maySeal(a: Answering): boolean {
  return a.at === a.questions.length && a.given.every((g) => g !== null);
}

/** What the Seal sends, once it may. */
export function sealAnswers(a: Answering): SealAnswer[] | null {
  if (!maySeal(a)) return null;
  return a.questions.map((q, i) => {
    const g = a.given[i]!;
    return { question: q.id, answer: g.answer, ...(g.words ? { words: g.words } : {}), ms: g.ms };
  });
}
