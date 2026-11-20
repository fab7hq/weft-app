// The Eval dialog's Reads: the commits and files since its first Ask or its
// last Seal, what is counted and not read, and a large change's note.
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { largeNote, readsRow, whenWords, type Reads } from '../src/reads';
import { use } from '../src/words';

const words: Record<string, string> = JSON.parse(readFileSync('web/public/words.json', 'utf8'));

beforeEach(() => use(words));

const NOW = Date.parse('2026-11-19T15:00:00Z');

/** 17.3: health endpoint, 3 commits and 14 files since its first Ask this morning. */
const SMALL: Reads = { since: 'ask', when: '2026-11-19T09:12:00Z', commits: 3, files: 14, skipped: { generated: 1, vendored: 0, binary: 1, lock: 0 }, large: false };

/** 17.27: weft 0.7 updates, everything committed since Nov 8. */
const LARGE: Reads = {
  since: 'ask', when: '2026-11-08T10:00:00Z', commits: 52, files: 13852, skipped: {},
  folder: 'research/papers/to-err-is-agentic/evidence/', folder_files: 13708, large: true,
};

describe('the Reads row', () => {
  it('says the commits and files, since when, and what is counted and not read', () => {
    expect(readsRow(SMALL, NOW, 0)).toMatchObject({
      what: '3 commits · 14 files',
      since: 'since its first Ask, today 09:12',
      skipped: '2 counted, not read: 1 generated, 1 binary',
    });
  });

  it('says one commit and one file in their own words, since its last Seal, and nothing skipped when none is', () => {
    expect(readsRow({ since: 'seal', when: '2026-11-08T10:00:00Z', commits: 1, files: 1 }, NOW, 0)).toMatchObject({
      what: '1 commit · 1 file', since: 'since its last Seal, Nov 8', skipped: null,
    });
  });

  it('says thousands as a person reads them', () => {
    expect(readsRow(LARGE, NOW, 0).what).toBe('52 commits · 13,852 files');
  });
});

describe('a time in a sentence', () => {
  it('is today or yesterday with its time, else its day, with the year when it is not this one', () => {
    expect(whenWords('2026-11-19T09:12:00Z', NOW, 0)).toBe('today 09:12');
    expect(whenWords('2026-11-18T18:40:00Z', NOW, 0)).toBe('yesterday 18:40');
    expect(whenWords('2026-11-08T10:00:00Z', NOW, 0)).toBe('Nov 8');
    expect(whenWords('2025-12-12T10:00:00Z', NOW, 0)).toBe('Dec 12 2025');
    // On this device's clock: 09:12 UTC is 16:12 seven hours east.
    expect(whenWords('2026-11-19T09:12:00Z', NOW, 7 * 3_600_000)).toBe('today 16:12');
  });
});

describe('a large change', () => {
  it('says so, where most of it is, and what makes the next one smaller', () => {
    expect(largeNote(LARGE, NOW, 0)).toEqual({
      title: 'This is a large change for one work.',
      where: ['It holds everything committed here since Nov 8. Most of it is in ', 'research/papers/to-err-is-agentic/evidence/', ' (13,708 files).'],
      fix: 'Seal earlier work so the next starts later, or mark data in .gitattributes as generated so it is counted, not read.',
    });
  });

  it('is not said of a change that is not large', () => {
    expect(largeNote(SMALL, NOW, 0)).toBeNull();
  });
});
