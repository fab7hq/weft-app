// Done: the sealed units of a project, read from the machine with a search,
// each row saying what was decided, why, and the verdict it was sealed on.
import { describe, expect, it } from 'vitest';
import { doneLine, doneRead, type Done } from '../src/done';

const row = (over: Partial<Done>): Done => ({
  unit: 'ask_1', title: 'health endpoint', harness: 'codex', verdict: 'drifted',
  decision: 'rejected', reason: 'broke something', at: '2026-10-25T11:32:00Z', parked: false, ...over,
});

describe('Done', () => {
  it('reads a project\'s sealed units, narrowed by what is typed, a page at a time', () => {
    expect(doneRead('/w', '', null)).toEqual({ type: 'read', what: 'done', project: '/w' });
    expect(doneRead('/w', ' broke ', 'ask_9')).toEqual({ type: 'read', what: 'done', project: '/w', q: 'broke', after: 'ask_9' });
  });

  it('says a row\'s decision, its reason when one was given, and its verdict', () => {
    expect(doneLine(row({}))).toBe('rejected · broke something · drifted');
    expect(doneLine(row({ decision: 'accepted', reason: null, verdict: 'aligned' }))).toBe('accepted · aligned');
    expect(doneLine(row({ decision: 'parked', reason: null, verdict: null }))).toBe('parked');
  });
});
