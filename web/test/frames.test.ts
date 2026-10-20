// weftd's screen frames drawn by xterm.js (web-app.md §11
// test 1). The fixtures are written by weft's crates/weft-term/tests/round_trip.rs
// from recorded harness output: a full frame, then differences, each with
// the text the daemon's terminal shows after it. xterm.js, given them as the
// page gives them, must show the same text.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { Terminal } from '@xterm/headless';

// The page's machine and bar hold a connection and the document; frames need neither.
vi.mock('../src/machine', () => ({}));
vi.mock('../src/views/Bar', () => ({ paneActive: { value: false } }));
const { drawWithWebgl, frameWriter, wholeFont } = await import('../src/views/Screen');

const fixtures = process.env.WEFT_SCREEN_FIXTURES
  ?? join(import.meta.dirname, '../../../weft/crates/weftd/tests/fixtures/screens');

interface Frames {
  rows: number;
  cols: number;
  frames: { full: boolean; bytes: string; contents: string }[];
}

function fixture(name: string): Frames {
  return JSON.parse(readFileSync(join(fixtures, name), 'utf8'));
}

/** Every frame the page was given has been drawn. */
const drawn = (term: Terminal) => write(term, new Uint8Array());

function write(term: Terminal, data: Uint8Array): Promise<void> {
  return new Promise((done) => term.write(data, done));
}

// The daemon's contents(): each row ending at its last character (a space
// with a background is still a space), rows joined by newlines, trailing
// empty rows dropped.
function text(term: Terminal): string {
  const buffer = term.buffer.active;
  const rows: string[] = [];
  for (let y = 0; y < term.rows; y++) {
    rows.push((buffer.getLine(buffer.viewportY + y)?.translateToString(true) ?? '').replace(/ +$/, ''));
  }
  return rows.join('\n').replace(/\n+$/, '');
}

describe('weftd frames drawn by xterm.js', () => {
  const names = readdirSync(fixtures).filter((f) => f.endsWith('.frames.json'));

  it('has fixtures', () => expect(names.length).toBeGreaterThanOrEqual(3));

  for (const name of names) {
    it(name, async () => {
      const { rows, cols, frames } = fixture(name);
      const term = new Terminal({ rows: 5, cols: 20, scrollback: 0, allowProposedApi: true });
      const draw = frameWriter(term, () => {});
      for (const [i, frame] of frames.entries()) {
        draw({ agent: 'a', seq: i, rows, cols, full: frame.full, bytes: frame.bytes });
        await drawn(term);
        expect(text(term), `${name} frame ${i}`).toBe(frame.contents.replace(/\n+$/, ''));
      }
    });
  }
});

describe('the page draws a frame whole', () => {
  it('writes a whole screen of the same size in order, with no reset and no new fit', async () => {
    const { rows, cols, frames } = fixture('codex.frames.json');
    const term = new Terminal({ rows, cols, scrollback: 0, allowProposedApi: true });
    const reset = vi.spyOn(term, 'reset');
    const fits: string[] = [];
    const draw = frameWriter(term, (r, c) => fits.push(`${r}x${c}`));
    const whole = frames.find((f) => f.full)!;
    draw({ agent: 'a', seq: 1, rows, cols, full: true, bytes: whole.bytes });
    draw({ agent: 'a', seq: 2, rows, cols, full: false, bytes: btoa('changed') });
    draw({ agent: 'a', seq: 3, rows, cols, full: true, bytes: whole.bytes });
    await drawn(term);
    expect(reset).not.toHaveBeenCalled();
    expect(fits).toEqual([`${rows}x${cols}`]);
    expect(text(term)).toBe(whole.contents.replace(/\n+$/, ''));
    // Painted whole: inside one synchronized update, closed at its end.
    expect(term.modes.synchronizedOutputMode).toBe(false);
  });

  it('fits once when the size is new', async () => {
    const term = new Terminal({ rows: 24, cols: 80, scrollback: 0, allowProposedApi: true });
    const fits: string[] = [];
    const draw = frameWriter(term, (r, c) => fits.push(`${r}x${c}`));
    for (const [seq, [rows, cols]] of [[24, 80], [34, 124], [34, 124], [24, 80]].entries()) {
      draw({ agent: 'a', seq, rows, cols, full: true, bytes: btoa('x') });
    }
    await drawn(term);
    expect(fits).toEqual(['24x80', '34x124', '24x80']);
    expect([term.rows, term.cols]).toEqual([24, 80]);
  });
});

describe('the page draws with WebGL', () => {
  /** WebGL's addon as xterm.js loads it, its context lost for good on demand. */
  function addon() {
    const lost: (() => void)[] = [];
    // xterm.js wraps `dispose` with its own as it loads an addon.
    const gl = {
      disposed: false,
      lose: () => lost.forEach((f) => f()),
      activate: vi.fn(),
      dispose: () => void (gl.disposed = true),
      onContextLoss: (f: () => void) => (lost.push(f), { dispose() {} }),
    };
    return gl;
  }

  it('leaves the screen to the DOM once the context is lost for good', async () => {
    const term = new Terminal({ rows: 5, cols: 20, allowProposedApi: true });
    const gl = addon();
    drawWithWebgl(term as never, true, () => gl as never);
    expect(gl.activate).toHaveBeenCalled();
    gl.lose();
    expect(gl.disposed).toBe(true);
    await write(term, new TextEncoder().encode('still drawn'));
    expect(text(term)).toBe('still drawn');
  });

  it('starts on the DOM where WebGL2 is missing', () => {
    const gl = addon();
    drawWithWebgl(new Terminal({ allowProposedApi: true }) as never, false, () => gl as never);
    expect(gl.activate).not.toHaveBeenCalled();
  });
});

describe('the fit', () => {
  it('takes the largest whole font size that fits, from 9 to 13', () => {
    expect([14.2, 13, 12.99, 10.4, 9, 8.1].map(wholeFont)).toEqual([13, 13, 12, 10, 9, 9]);
  });
});
