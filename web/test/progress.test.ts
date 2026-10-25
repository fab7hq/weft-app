// A running Eval's ring: the arc a percent fills, on a ring of radius 56.
import { describe, expect, it } from 'vitest';
import { ring } from '../src/progress';

describe('the progress ring', () => {
  it('fills as much of its circle as is checked, and never past it', () => {
    expect(ring(0)).toBe('0 352');
    expect(ring(40)).toBe('141 352');
    expect(ring(100)).toBe('352 352');
    expect(ring(140)).toBe('352 352');
  });
});
