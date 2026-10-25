// "Not what I meant" names the Eval and the sentence; the machine shows its one dialog.
import { describe, expect, it } from 'vitest';
import { NOT_MEANT, markMessage } from '../src/mark';

describe('Not what I meant', () => {
  it('is worded as the desktop app words it', () => {
    expect(NOT_MEANT).toBe('eval_view.not_meant');
  });

  it('sends the Eval and the sentence it marks', () => {
    expect(markMessage('/p', 'evl_1', 'ask_1/f0')).toEqual({ act: 'mark', project: '/p', eval: 'evl_1', text: 'ask_1/f0' });
  });
});
