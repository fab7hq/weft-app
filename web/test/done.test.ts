// Done: the sealed units of a project, read from the machine with a search,
// each row saying what was decided, why, and what the Eval it was sealed on found.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { use } from '../src/words';
import { doneLine, doneRead, sealedWhen, type Done } from '../src/done';

use(JSON.parse(readFileSync('web/public/words.json', 'utf8')));

const row = (over: Partial<Done>): Done => ({
  unit: 'ask_1', title: 'health endpoint', harness: 'codex', report: { faults: 1, cannot_settle: 0, declared: 0, against_decisions: 0 },
  decision: 'rejected', reason: 'broke something', at: '2026-10-25T11:32:00Z', parked: false, ...over,
});

describe('Done', () => {
  it('reads a project\'s sealed units, narrowed by what is typed, a page at a time', () => {
    expect(doneRead('/w', '', null)).toEqual({ type: 'read', what: 'done', project: '/w' });
    expect(doneRead('/w', ' broke ', 'ask_9')).toEqual({ type: 'read', what: 'done', project: '/w', q: 'broke', after: 'ask_9' });
  });

  it('says a row\'s decision, its reason when one was given, and what its Eval found', () => {
    const none = { faults: 0, cannot_settle: 0, declared: 0, against_decisions: 0 };
    expect(doneLine(row({}))).toBe('rejected · broke something · 1 found');
    expect(doneLine(row({ decision: 'accepted', reason: null, report: none }))).toBe('accepted · nothing found');
    expect(doneLine(row({ decision: 'parked', reason: null, report: null }))).toBe('parked');
  });

  it('says when a row was sealed: the time today, else the month and day', () => {
    const now = Date.parse('2026-10-25T18:00:00Z');
    expect(sealedWhen('2026-10-25T11:32:00Z', now)).toBe('11:32');
    expect(sealedWhen('2026-10-24T09:40:00Z', now)).toBe('Oct 24');
    expect(sealedWhen('not a time', now)).toBe('not a time');
  });
});
