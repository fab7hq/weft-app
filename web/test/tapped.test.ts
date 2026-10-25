// A tapped notification opens what its tag names: an agent, or an Eval that
// closed, at its Seal dialog when it is ready to seal.
import { describe, expect, it } from 'vitest';
import { tapped } from '../src/tapped';

describe('a tapped notification', () => {
  it('opens the agent its tag names', () => {
    expect(tapped('3f9a1c07b2de-4')).toEqual({ open: 'agent', agent: '3f9a1c07b2de-4' });
  });

  it('opens the Seal dialog of a unit ready to seal, or the Eval that needs you', () => {
    expect(tapped('seal:ask_1:evl_1')).toEqual({ open: 'seal', unit: 'ask_1', eval: 'evl_1' });
    expect(tapped('eval:ask_1:evl_1')).toEqual({ open: 'eval', unit: 'ask_1', eval: 'evl_1' });
  });
});
