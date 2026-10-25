// What sealed work offers: each offer is its own act on the unit, and Keep
// a rule's Save sends the rule as the person left it.
import { describe, expect, it } from 'vitest';
import { keepMessage, offerMessage, remedyRead, type Drafted } from '../src/offers';

const drafted: Drafted = { name: 'Degraded health', rule: 'Answer 503 when a dependency is down.', when: 'A health endpoint changes.', family: 'domain' };

describe('offers after a Seal', () => {
  it('asks the machine for each offer on the unit, and nothing else', () => {
    expect(offerMessage('/w', 'ask_1', 'commit')).toEqual({ act: 'commit', project: '/w', unit: 'ask_1' });
    expect(offerMessage('/w', 'ask_1', 'undo')).toEqual({ act: 'undo', project: '/w', unit: 'ask_1' });
    expect(offerMessage('/w', 'ask_1', 'keep_rule')).toEqual({ act: 'draft_rule', project: '/w', unit: 'ask_1' });
  });

  it('saves the rule as edited, for the team only when asked', () => {
    expect(keepMessage('/w', 'ask_1', drafted, ' Answer 503 and name what is down. ', false)).toEqual({
      act: 'keep_rule', project: '/w', unit: 'ask_1',
      draft: { rule: { ...drafted, rule: 'Answer 503 and name what is down.' } },
    });
    expect(keepMessage('/w', 'ask_1', drafted, drafted.rule, true).draft).toEqual({ rule: drafted, share: true });
  });

  it('reads a follow-up\'s words for rejected work', () => {
    expect(remedyRead('/w', 'ask_1')).toEqual({ type: 'read', what: 'remedy', project: '/w', unit: 'ask_1' });
  });
});
