// The earlier sessions, a page at a time: their count, an earlier row's
// second line, and the row that reads the next page.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { use } from '../src/words';
import { PAGE, count, moreOf, pastAbout } from '../src/earlier';

use(JSON.parse(readFileSync('web/public/words.json', 'utf8')));

describe('the earlier sessions\' count', () => {
  it('says a number with thousands separators', () => {
    expect(count(0)).toBe('0');
    expect(count(12)).toBe('12');
    expect(count(1204)).toBe('1,204');
    expect(count(1_234_567)).toBe('1,234,567');
  });
});

describe('Show more', () => {
  it('offers the next page, and how many are shown of all', () => {
    expect(moreOf(50, 1204)).toEqual({ more: 'Show 50 more', shown: '50 of 1,204' });
    expect(moreOf(1150, 1204)).toEqual({ more: 'Show 50 more', shown: '1,150 of 1,204' });
  });

  it('offers only those left when fewer than a page are', () => {
    expect(PAGE).toBe(50);
    expect(moreOf(100, 120)).toEqual({ more: 'Show 20 more', shown: '100 of 120' });
    expect(moreOf(50, 51)).toEqual({ more: 'Show 1 more', shown: '50 of 51' });
  });

  it('is gone once every one is shown', () => {
    expect(moreOf(120, 120)).toBeNull();
    expect(moreOf(0, 0)).toBeNull();
    // A count that went down while the rows were read still ends the list.
    expect(moreOf(60, 55)).toBeNull();
  });
});

describe('an earlier session\'s second line', () => {
  const MIN = 60_000;
  const DAY = 24 * 60 * MIN;
  const NOON = new Date(2026, 9, 8, 12, 0).getTime();

  it('says its harness and its day and time', () => {
    expect(pastAbout({ harness: 'claude-code', title: 'eval view rows', at: NOON - DAY + 5 * 60 * MIN + 40 * MIN }, NOON)).toBe('claude-code · Yesterday 17:40');
    expect(pastAbout({ harness: 'codex', title: 'turn-state map', at: NOON - 2 * DAY }, NOON)).toBe('codex · Oct 6 12:00');
  });

  it('leaves out its harness when its title is its harness', () => {
    expect(pastAbout({ harness: 'codex', title: null, at: NOON - 30 * MIN }, NOON)).toBe('Today 11:30');
  });

  it('says only its harness when it has no time', () => {
    expect(pastAbout({ harness: 'codex', title: 'x', at: 0 }, NOON)).toBe('codex');
  });
});
