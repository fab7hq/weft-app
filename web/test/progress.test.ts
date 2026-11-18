// A running Eval's ring: three arcs of one circle, one per read.
import { describe, expect, it } from 'vitest';
import { RING } from '../src/progress';

describe('the ring', () => {
  it('is three arcs of 122 on a circle of radius 64, a gap between each', () => {
    expect(RING.r).toBe(64);
    expect(RING.dash).toBe('122 280');
    // 2πr is about 402: three arcs and three gaps of 12 go round once.
    expect(Math.round(2 * Math.PI * RING.r)).toBe(122 + 280);
    expect(RING.offsets).toEqual([0, -134, -268]);
  });
});
