// The Seal's questions, as weft-core's `seal_questions` holds them: one at a
// time, each answered before the next, a review, and only then the Seal.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as A from '../src/answering';
import { use } from '../src/words';

use(JSON.parse(readFileSync('web/public/words.json', 'utf8')));

const q = (id: string, ask: string, more: Partial<A.Question> = {}): A.Question => ({ id, ask, behaviour: `${id} changed.`, ...more });

describe('the Seal\'s questions', () => {
  it('answers each before the next, and the Seal waits for every answer', () => {
    let a = A.start([q('q1', 'did_you_want'), q('q2', 'what_did_you_mean')]);
    expect(A.counter(a)).toBe('Question 1 of 2');
    expect(A.forward(a)).toBeNull();
    expect(A.answer(a, 'now', null, 10)).toBeNull();
    a = A.answer(a, 'not_wanted', null, 4200)!;
    a = A.forward(a)!;
    expect(A.answer(a, 'words', '  ', 5)).toBeNull();
    a = A.answer(a, 'not_sure', null, 900)!;
    expect(A.maySeal(a)).toBe(false);
    expect(A.sealAnswers(a)).toBeNull();
    a = A.forward(a)!;
    expect(A.maySeal(a)).toBe(true);
    expect(A.shown(a)).toBeNull();
    // Changed from the review: the new answer stands.
    a = A.change(a, 1);
    a = A.forward(A.answer(a, 'words', 'only the login form', 1800)!)!;
    expect(A.sealAnswers(a)).toEqual([
      { question: 'q1', answer: 'not_wanted', ms: 4200 },
      { question: 'q2', answer: 'words', words: 'only the login form', ms: 1800 },
    ]);
    expect(A.back(A.back(A.back(a)!)!)).toBeNull();
  });

  it('takes an answer back, and then waits for one again', () => {
    let a = A.answer(A.start([q('q1', 'what_did_you_mean')]), 'words', 'that', 1)!;
    a = A.unanswer(a);
    expect(A.forward(a)).toBeNull();
  });

  it('says in one quiet line where a question from an earlier Seal comes from', () => {
    const before = { decision: 'sel_1/d1', seal: 'sel_1', date: '2026-11-10' };
    expect(A.beforeLine(q('q1', 'did_you_want', { asked_before: before }))).toBe('Asked before · not sure on 10 Nov');
    expect(A.beforeLine(q('q2', 'did_you_want', { against: { ...before, date: '2026-11-03' } }))).toBe('Asked before · not wanted on 3 Nov');
    expect(A.beforeLine(q('q3', 'still_want'))).toBeNull();
    expect(A.day('not a date')).toBe('not a date');
    expect(A.changedLine(q('q1', 'did_you_want', { asked_before: before }))).toBeNull();
    expect(A.ruleOf(q('q1', 'did_you_want', { asked_before: before }))).toBeNull();
  });

  it('asks a decision again when its file changed, saying what was answered and which file', () => {
    const stale = { decision: 'sel_1/d2', seal: 'sel_1', date: '2026-11-03', answer: 'wanted', stale: true, changed: ['src/session.rs'] };
    const again = q('q4', 'did_you_want', { asked_before: stale });
    expect(A.beforeLine(again)).toBe('Asked before · wanted on 3 Nov');
    expect(A.changedLine(again)).toEqual(['', 'src/session.rs', ' has changed since, so it’s asked again.']);
    expect(A.beforeLine(q('q4', 'did_you_want', { asked_before: { ...stale, answer: 'not_wanted' } }))).toBe('Asked before · not wanted on 3 Nov');
    const two = q('q5', 'still_want', { asked_before: { ...stale, answer: 'later', changed: ['a.rs', 'b.rs'] } });
    expect(A.beforeLine(two)).toBe('Asked before · answered on 3 Nov');
    expect(A.changedLine(two)?.join('')).toBe('a.rs, b.rs have changed since, so it’s asked again.');
    expect(A.changedLine(q('q6', 'did_you_want', { asked_before: { ...stale, changed: [] } }))).toBeNull();
  });

  it('names the rule a question goes against, by its file', () => {
    const asked = q('q3', 'did_you_want', { rules: [{ source: './AGENTS.md@3f2a9c1', quote: 'Never write a person’s email or password to a log.' }] });
    expect(A.beforeLine(asked)).toBe('Against a rule of this project');
    expect(A.ruleOf(asked)).toEqual({ label: 'AGENTS.md', quote: '“Never write a person’s email or password to a log.”' });
    expect(A.label(asked)).toBe('Did you want this?');
    expect(A.ruleFile('api/docs/rules.md@abc')).toBe('api/docs/rules.md');
    expect(A.ruleFile('./AGENTS.md')).toBe('AGENTS.md');
    // Asked before, it says so above, not the rule.
    expect(A.beforeLine({ ...asked, against: { decision: 'd', seal: 's', date: '2026-11-03' } })).toBe('Asked before · not wanted on 3 Nov');
    expect(A.beforeLine({ ...asked, rules: [] })).toBeNull();
  });

  it('gives every answer its words and one colour, and no answer is red', () => {
    for (const [answer, tone] of [['wanted', 'teal'], ['now', 'teal'], ['not_wanted', 'amber'], ['drop', 'amber'], ['later', 'blue'], ['words', 'blue'], ['not_sure', 'grey']]) {
      expect(A.answerTone(answer)).toBe(tone);
      expect(A.answerWords(answer)).not.toMatch(/^seal\.a\./);
    }
    expect(A.answerWords('words', 'in red')).toBe('“in red”');
    expect(A.answersOf(q('q', 'still_want'))).toEqual(['now', 'later', 'drop', 'not_sure']);
  });

  it('gives every decision one colour on the same scale', () => {
    expect(['accepted', 'deferred', 'rejected', 'abandoned'].map(A.decisionTone)).toEqual(['teal', 'blue', 'red', 'grey']);
  });

  it('says what each question asks', () => {
    expect(A.label(q('q', 'did_you_want'))).toBe('Did you want this?');
    expect(A.label(q('q', 'still_want'))).toBe('Still want it?');
    expect(A.label(q('q', 'what_did_you_mean'))).toBe('What did you mean?');
  });
});
