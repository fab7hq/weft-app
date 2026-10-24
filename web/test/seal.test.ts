// A Seal's dialog sends the disposition and the reason the person picked.
import { describe, expect, it } from 'vitest';
import { reasonsFor, sealMessage } from '../src/seal';

describe('the Seal dialog', () => {
  it('sends the disposition and the reason picked, on the work or the Eval it seals', () => {
    expect(sealMessage({ project: '/p', unit: 'ask_1' }, 'rejected', 'not_what_i_asked')).toEqual({
      act: 'seal', project: '/p', unit: 'ask_1', text: 'rejected', draft: { reason: 'not_what_i_asked' },
    });
    expect(sealMessage({ project: '/p', eval: 'evl_2' }, 'accepted', null)).toEqual({
      act: 'seal', project: '/p', eval: 'evl_2', text: 'accepted',
    });
  });

  it('offers a reason only for what is not a yes, from each one\'s own list', () => {
    expect(reasonsFor('accepted')).toEqual([]);
    expect(reasonsFor('rejected')).toEqual(['wrong_approach', 'broke_something', 'not_what_i_asked']);
    expect(reasonsFor('deferred')).toEqual(['finish_later', 'waiting_on_something']);
    expect(reasonsFor('abandoned')).toEqual(['not_needed', 'superseded']);
  });
});
