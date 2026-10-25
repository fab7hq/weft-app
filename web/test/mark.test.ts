// A mark on a closed Eval names its item; the machine shows its one dialog.
import { describe, expect, it } from 'vitest';
import { markMessage, markOf, markWords } from '../src/mark';

describe('a mark', () => {
  it('is offered on the items the machine says take one, and only those', () => {
    const marks = { w_3ae3: 'asked_for', 'ask_1/f0': 'not_meant' } as const;
    expect(markOf(marks, 'w_3ae3')).toBe('asked_for');
    expect(markOf(marks, 'ask_1/f0')).toBe('not_meant');
    expect(markOf(marks, 'w_65bb')).toBeNull();
    expect(markOf(undefined, 'w_3ae3')).toBeNull();
  });

  it('is worded as the desktop app words it', () => {
    expect(markWords('asked_for')).toBe('eval_view.asked_for');
    expect(markWords('not_meant')).toBe('eval_view.not_meant');
  });

  it('sends the Eval and the item it marks', () => {
    expect(markMessage('/p', 'evl_1', 'w_3ae3')).toEqual({ act: 'mark', project: '/p', eval: 'evl_1', text: 'w_3ae3' });
  });
});
