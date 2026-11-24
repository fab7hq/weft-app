// A project's settings list the person's decisions as the machine words them:
// each row's answer, day and files, the files in mono; a stale one says which
// file changed, also in mono; none, and the section is not shown.
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { type Decision, type Decisions, rowParts, shown, staleParts, toneOf } from '../src/decisions';
import { use } from '../src/words';

const words: Record<string, string> = JSON.parse(readFileSync('web/public/words.json', 'utf8'));

beforeEach(() => use(words));

const row = (more: Partial<Decision>): Decision => ({
  id: 'd', behaviour: 'b', answer: 'wanted', answer_words: 'Wanted', tone: 'teal', day: '10 Nov', files: [], stale: false, ...more,
});

/** 9.15: four decisions, one asked again. */
const FOUR: Decisions = {
  title: 'YOUR DECISIONS', count: '4 · 1 to ask again', changed: 'changed since',
  list: [
    row({ id: 'sel_2/d1', behaviour: 'The sign-in button is off while it sends.', files: ['src/login.rs'] }),
    row({ id: 'sel_1/d1', behaviour: 'Emails are written to the server log.', answer: 'not_wanted', answer_words: 'Not wanted', tone: 'amber', day: '3 Nov', files: ['src/log.rs', 'AGENTS.md'] }),
    row({ id: 'sel_1/d2', behaviour: 'A session ends after 1 hour without activity.', day: '3 Nov', files: ['src/session.rs'], stale: true,
      stale_line: 'src/session.rs has changed since; the next Eval that touches it asks again' }),
    row({ id: 'sel_0/d1', behaviour: 'The health page shows the build number.', day: '1 Nov', files: ['plans/weft/plan.md'] }),
  ],
};

describe('your decisions', () => {
  it('says each answer’s day and its files, each file in mono', () => {
    expect(rowParts(FOUR.list[0])).toEqual([{ text: ' · 10 Nov' }, { text: ' · ' }, { text: 'src/login.rs', mono: true }]);
    expect(rowParts(FOUR.list[1])).toEqual([
      { text: ' · 3 Nov' }, { text: ' · ' }, { text: 'src/log.rs', mono: true }, { text: ', ' }, { text: 'AGENTS.md', mono: true },
    ]);
  });

  it('says a stale one’s changed file in mono in place of its files', () => {
    expect(rowParts(FOUR.list[2])).toEqual([
      { text: ' · 3 Nov' }, { text: ' · ' }, { text: 'src/session.rs', mono: true },
      { text: ' has changed since; the next Eval that touches it asks again' },
    ]);
    expect(staleParts('a.rs, b.rs have changed since; the next Eval that touches them asks again')).toEqual([
      { text: 'a.rs', mono: true }, { text: ', ' }, { text: 'b.rs', mono: true }, { text: ' have changed since; the next Eval that touches them asks again' },
    ]);
    // Words it was not made from are said as they are.
    expect(staleParts('something else')).toEqual([{ text: 'something else' }]);
  });

  it('gives each its answer’s colour, grey for one it does not know', () => {
    expect(FOUR.list.map(toneOf)).toEqual(['teal', 'amber', 'teal', 'teal']);
    expect(toneOf(row({ tone: 'purple' }))).toBe('grey');
  });

  it('is shown only when there are decisions', () => {
    expect(shown(FOUR)).toBe(FOUR);
    expect(shown({ ...FOUR, count: '0', list: [] })).toBeNull();
    expect(shown(null)).toBeNull();
  });

  it('says a decision with no files with its day alone', () => {
    expect(rowParts(row({ day: '1 Nov' }))).toEqual([{ text: ' · 1 Nov' }]);
  });
});
