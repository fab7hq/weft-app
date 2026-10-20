// A wheel gesture is one `keys` message: what the wheel or a finger moved,
// in rows, gathered over an animation frame, one report per row, and nothing
// new while a message is unacked.
import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/machine', () => ({}));
vi.mock('../src/views/Bar', () => ({ paneActive: { value: false } }));
const { wheelGatherer, wheelRows } = await import('../src/views/Screen');

const UP = '\x1b[<64;10;5M';
const DOWN = '\x1b[<65;10;5M';
const report = (up: boolean) => (up ? UP : DOWN);
const text = (bytes: number[]) => String.fromCharCode(...bytes);

/** Everything an ack set going has run. */
const acked = () => new Promise((done) => setTimeout(done, 0));

/** Animation frames run when the test says so. */
function frames() {
  let waiting: (() => void)[] = [];
  return {
    next: (f: () => void) => void waiting.push(f),
    run: () => {
      const now = waiting;
      waiting = [];
      now.forEach((f) => f());
    },
  };
}

describe('a wheel gesture', () => {
  it('counts rows as a terminal counts lines', () => {
    expect(wheelRows({ deltaY: 100, deltaMode: 0 }, 16, 34)).toBe(6.25);
    expect(wheelRows({ deltaY: -3, deltaMode: 1 }, 16, 34)).toBe(-3);
    expect(wheelRows({ deltaY: 1, deltaMode: 2 }, 16, 34)).toBe(34);
  });

  it('sends 3 mouse notches of 100 px at a 16 px cell as one message of 18 reports', () => {
    const sent: string[] = [];
    const f = frames();
    const gather = wheelGatherer((bytes) => void sent.push(text(bytes)), f.next);
    for (let i = 0; i < 3; i++) gather(wheelRows({ deltaY: 100, deltaMode: 0 }, 16, 34), report);
    f.run();
    expect(sent).toEqual([DOWN.repeat(18)]);
  });

  it('sends a trackpad stream at most once per round trip, and loses none of it', async () => {
    const sent: string[] = [];
    const acks: (() => void)[] = [];
    const f = frames();
    const gather = wheelGatherer((bytes) => {
      sent.push(text(bytes));
      return new Promise<void>((done) => acks.push(done));
    }, f.next);
    // Sixty frames of a trackpad's small deltas, up; the round trip is ten frames.
    for (let frame = 0; frame < 60; frame++) {
      gather(wheelRows({ deltaY: -4, deltaMode: 0 }, 16, 34), report);
      f.run();
      if (frame % 10 === 9) {
        acks.shift()?.();
        await acked();
      }
    }
    // The rest, once the frames run on with no wheel.
    for (f.run(); acks.length; f.run()) {
      acks.shift()!();
      await acked();
    }
    expect(sent.length).toBeLessThanOrEqual(7);
    expect(sent.join('')).toBe(UP.repeat(15));
  });
});
