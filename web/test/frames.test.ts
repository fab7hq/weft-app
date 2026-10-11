// weftd's screen frames drawn by xterm.js (web-app.md §11
// test 1). The fixtures are written by weft's crates/weftd/tests/screen_frames.rs
// from recorded harness output: a full frame, then differences, each with
// the text vt100 shows after it. xterm.js must show the same text.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { Terminal } from '@xterm/headless';

const fixtures = process.env.WEFT_SCREEN_FIXTURES
  ?? join(import.meta.dirname, '../../../weft/crates/weftd/tests/fixtures/screens');

interface Frames {
  rows: number;
  cols: number;
  frames: { full: boolean; bytes: string; contents: string }[];
}

function write(term: Terminal, data: Uint8Array): Promise<void> {
  return new Promise((done) => term.write(data, done));
}

// vt100's contents(): each row with its trailing blanks dropped, rows joined
// by newlines, trailing empty rows dropped.
function text(term: Terminal): string {
  const buffer = term.buffer.active;
  const rows: string[] = [];
  for (let y = 0; y < term.rows; y++) {
    rows.push(buffer.getLine(buffer.viewportY + y)?.translateToString(true) ?? '');
  }
  return rows.join('\n').replace(/\n+$/, '');
}

describe('weftd frames drawn by xterm.js', () => {
  const names = readdirSync(fixtures).filter((f) => f.endsWith('.frames.json'));

  it('has fixtures', () => expect(names.length).toBeGreaterThanOrEqual(3));

  for (const name of names) {
    it(name, async () => {
      const fixture: Frames = JSON.parse(readFileSync(join(fixtures, name), 'utf8'));
      const term = new Terminal({ rows: fixture.rows, cols: fixture.cols, scrollback: 0, allowProposedApi: true });
      for (const [i, frame] of fixture.frames.entries()) {
        if (frame.full) term.reset();
        await write(term, Uint8Array.from(Buffer.from(frame.bytes, 'base64')));
        expect(text(term), `${name} frame ${i}`).toBe(frame.contents.replace(/\n+$/, ''));
      }
    });
  }
});
