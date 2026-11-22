// The files an agent points at: which renderer draws each kind, how a file is
// read from its URL a slice at a time, how CSV and notebooks are read, what a
// chip and the header say, and what the desktop's buttons tell it.
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { rows, type Item } from '../src/conversation';
import { parseCsv, separatorOf } from '../src/viewer/csv';
import { KINDS, about, folderOf, kindOf, loadedWords, nameOf, sizeWord, union, type Ref } from '../src/viewer/kinds';
import { LOAD, RENDERER, SWITCHES, readsBytes, renderer } from '../src/viewer/factory';
import { load, type Progress } from '../src/viewer/source';
import { linkOfAnswer } from '../src/viewer/link';
import { desktopHost } from '../src/viewer/host';
import { openingOf } from '../src/viewer/page';
import { outputOf, parseNotebook } from '../src/viewer/notebook';
import { langNamed, langOf, tokenizer } from '../src/viewer/highlight';
import { lexMath } from '../src/viewer/mathmd';
import { blocks } from '../src/markdown';
import { csvTable, extent, sheetTable, textCell, valueCell } from '../src/viewer/table';
import { writeOds, writeXlsx } from 'hucre';
import { linesOf } from '../src/viewer/text';
import { rowsOf, spanOf, widthsOf, windowOf } from '../src/viewer/render/window';
import { use } from '../src/words';

use(JSON.parse(readFileSync('web/public/words.json', 'utf8')));

const bytes = (s: string) => new TextEncoder().encode(s);
const text = (b: Uint8Array) => new TextDecoder().decode(b);

describe('the factory', () => {
  it('maps each kind to its renderer, and draws nothing for other', () => {
    expect(RENDERER).toEqual({
      markdown: 'markdown',
      text: 'text',
      image: 'image',
      video: 'media',
      audio: 'media',
      csv: 'table',
      sheet: 'table',
      document: 'document',
      notebook: 'notebook',
      pdf: 'pdf',
      html: 'html',
      other: null,
    });
    expect(Object.keys(RENDERER).sort()).toEqual([...KINDS].sort());
    for (const name of Object.values(RENDERER)) if (name) expect(typeof LOAD[name]).toBe('function');
  });

  it('loads nothing for a kind it does not draw', async () => {
    await expect(renderer('other')).resolves.toBeNull();
  });

  it('offers Rendered | Source only where a file has both', () => {
    expect([...SWITCHES].sort()).toEqual(['html', 'markdown']);
  });

  it('reads the bytes first only for kinds drawn from them; images, video, sound, PDF and a page load from their URL', () => {
    expect(KINDS.filter((k) => readsBytes(k, 'rendered'))).toEqual(['markdown', 'text', 'csv', 'sheet', 'document', 'notebook']);
    expect(readsBytes('html', 'source')).toBe(true);
    expect(readsBytes('other', 'source')).toBe(false);
  });

  it('reads a kind it does not know as other', () => {
    expect(kindOf('notebook')).toBe('notebook');
    expect(kindOf('pptx')).toBe('other');
    expect(kindOf(undefined)).toBe('other');
  });
});

/** A file served with Range as the machine serves it, its version in Last-Modified. */
function served(file: Uint8Array, o: { modified?: () => string; status?: number; noRange?: boolean; chunks?: number } = {}) {
  const asked: string[] = [];
  const get = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    const range = (init?.headers as Record<string, string> | undefined)?.Range ?? '';
    asked.push(range);
    if (o.status) return new Response(null, { status: o.status });
    const headers = { 'Last-Modified': o.modified?.() ?? 'Sun, 22 Nov 2026 09:40:00 GMT' };
    const m = /bytes=(\d+)-(\d+)/.exec(range);
    if (!m || o.noRange) return new Response(file.slice(), { status: 200, headers: { ...headers, 'Content-Length': String(file.length) } });
    const from = Number(m[1]);
    const to = Math.min(Number(m[2]), file.length - 1);
    const part = file.slice(from, to + 1);
    // The body comes in pieces, as a network gives it.
    const step = Math.ceil(part.length / (o.chunks ?? 1)) || 1;
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        for (let i = 0; i < part.length; i += step) c.enqueue(part.slice(i, i + step));
        c.close();
      },
    });
    return new Response(body, { status: 206, headers: { ...headers, 'Content-Range': `bytes ${from}-${to}/${file.length}`, 'Content-Length': String(part.length) } });
  });
  return { get: get as unknown as typeof fetch, asked };
}

describe('reading a file from its URL', () => {
  const file = bytes('abcdefghij');

  it('reads it a slice at a time, each from where the last ended', async () => {
    const s = served(file);
    const r = await load('https://m/f/t/a.txt', 10, { slice: 4, fetch: s.get });
    expect('bytes' in r && text(r.bytes)).toBe('abcdefghij');
    expect(s.asked).toEqual(['bytes=0-3', 'bytes=4-7', 'bytes=8-9']);
  });

  it('says how far it has come, within a slice as its pieces arrive', async () => {
    const seen: Progress[] = [];
    await load('u', 10, { slice: 4, fetch: served(file, { chunks: 2 }).get, progress: (p) => seen.push(p) });
    const done = seen.map((p) => p.done);
    expect(done[0]).toBe(0);
    expect(done).toContain(2);
    expect(done).toContain(6);
    expect(done.at(-1)).toBe(10);
    expect(seen.every((p) => p.total === 10)).toBe(true);
    expect([...done].sort((x, y) => x - y)).toEqual(done);
  });

  it('starts again from the start when the file changed between slices', async () => {
    let n = 0;
    const s = served(file, { modified: () => (n++ === 1 ? 'changed' : 'same') });
    const r = await load('u', 10, { slice: 6, fetch: s.get });
    expect('bytes' in r && text(r.bytes)).toBe('abcdefghij');
    expect(s.asked).toEqual(['bytes=0-5', 'bytes=6-9', 'bytes=0-5', 'bytes=6-9']);
  });

  it('gives up on a file that keeps changing, and takes the size the file says it has', async () => {
    let n = 0;
    expect(await load('u', 10, { slice: 4, tries: 3, fetch: served(file, { modified: () => String(n++) }).get })).toEqual({ failed: 'changed' });
    // Said to be 6 bytes, it has 10: the first slice says so, and all 10 are read.
    const grown = await load('u', 6, { slice: 4, fetch: served(file).get });
    expect('bytes' in grown && text(grown.bytes)).toBe('abcdefghij');
  });

  it('learns the size from the first slice when it is not known', async () => {
    const s = served(file);
    const r = await load('u', 0, { slice: 4, fetch: s.get });
    expect('bytes' in r && text(r.bytes)).toBe('abcdefghij');
    expect(s.asked[0]).toBe('bytes=0-3');
  });

  it('takes the whole file from a server that ignores the range', async () => {
    const s = served(file, { noRange: true });
    const r = await load('u', 10, { slice: 4, fetch: s.get });
    expect('bytes' in r && text(r.bytes)).toBe('abcdefghij');
    expect(s.asked).toHaveLength(1);
  });

  it('says a file gone on a 404, and anything else as failed', async () => {
    expect(await load('u', 10, { fetch: served(file, { status: 404 }).get })).toEqual({ gone: true });
    expect(await load('u', 10, { fetch: served(file, { status: 500 }).get })).toEqual({ failed: 'HTTP 500' });
  });

  it('stops when the viewer closes', async () => {
    const stop = new AbortController();
    const get = vi.fn(async (_u: string | URL | Request, init?: RequestInit) => {
      stop.abort();
      init?.signal?.throwIfAborted();
      return new Response('x', { status: 206 });
    });
    await expect(load('u', 10, { slice: 4, fetch: get as unknown as typeof fetch, signal: stop.signal })).rejects.toMatchObject({ name: 'AbortError' });
    expect(get).toHaveBeenCalledTimes(1);
  });
});

describe('the machine’s answer to opening a file', () => {
  it('is a link on the address the connection reached', () => {
    const r = linkOfAnswer({ type: 'ok', file: { path: 'out/a.md', kind: 'markdown', size: 5, modified: 7, url: '/f/tok/a.md' } }, 'https://studio.example.com');
    expect(r).toEqual({ file: { path: 'out/a.md', kind: 'markdown', size: 5, modified: 7, url: 'https://studio.example.com/f/tok/a.md' } });
  });

  it('says no_file as a refusal, a lost connection as lost, and anything else in the machine’s words', () => {
    expect(linkOfAnswer({ type: 'error', code: 'no_file', message: 'gone' }, 'https://m')).toEqual({ refused: 'no_file' });
    expect(linkOfAnswer({ type: 'error', code: 'unknown', lost: true }, 'https://m')).toEqual({ refused: 'lost' });
    expect(linkOfAnswer(null, 'https://m')).toEqual({ refused: 'lost' });
    expect(linkOfAnswer({ type: 'error', code: 'io', message: 'Permission denied' }, 'https://m')).toEqual({ failed: 'Permission denied' });
    expect(linkOfAnswer({ type: 'ok', file: { path: 'a' } }, 'https://m')).toEqual({ failed: 'unknown' });
  });
});

describe('the desktop’s window', () => {
  it('is opened with the file in its hash', () => {
    const o = openingOf('#u=weft%3A%2F%2Ffile%2F0&path=out%2Freport.md&kind=markdown&size=4600&modified=1795312120486&agent=codex&project=gl-maintain');
    expect(o).toEqual({ file: { url: 'weft://file/0', path: 'out/report.md', kind: 'markdown', size: 4600, modified: 1795312120486 }, agent: 'codex', project: 'gl-maintain' });
    expect(openingOf('#kind=pptx').file).toMatchObject({ kind: 'other', size: 0, url: '' });
  });

  it('tells the desktop Reveal and Close over its IPC', () => {
    const said: string[] = [];
    const host = desktopHost({ ipc: { postMessage: (m) => said.push(m) }, close: () => said.push('closed') });
    host.reveal?.();
    host.close();
    expect(said.map((m) => JSON.parse(m))).toEqual([{ act: 'reveal' }, { act: 'close' }]);
  });

  it('opened without the desktop, closes itself and has no Reveal', () => {
    const close = vi.fn();
    const host = desktopHost({ close });
    expect(host.reveal).toBeUndefined();
    host.close();
    expect(close).toHaveBeenCalled();
  });
});

describe('a notebook', () => {
  const nb = {
    nbformat: 4,
    metadata: { kernelspec: { language: 'python' } },
    cells: [
      { cell_type: 'markdown', source: ['### Revenue by region\n', 'Q3 against Q2.'] },
      {
        cell_type: 'code',
        execution_count: 3,
        source: ['import pandas as pd\n', 'df.plot.bar()'],
        outputs: [
          { output_type: 'execute_result', data: { 'text/plain': ["<Axes: xlabel='Region'>"] } },
          { output_type: 'display_data', data: { 'image/png': 'iVBORw0K\nGgo=', 'text/plain': ['<Figure>'] } },
        ],
      },
      { cell_type: 'code', execution_count: null, source: 'df.head()', outputs: [{ output_type: 'execute_result', data: { 'text/html': '<table></table>', 'text/plain': 'x' } }] },
      { cell_type: 'code', execution_count: 5, source: '1/0', outputs: [{ output_type: 'error', ename: 'ZeroDivisionError', evalue: 'division by zero', traceback: ['\u001b[0;31mZeroDivisionError\u001b[0m: division by zero'] }] },
      { cell_type: 'code', execution_count: 6, source: 'print(1)', outputs: [{ output_type: 'stream', name: 'stdout', text: ['1\n'] }] },
    ],
  };

  it('is its cells: markdown, code with its number, and each output', () => {
    expect(parseNotebook(JSON.stringify(nb))).toEqual({
      lang: 'python',
      cells: [
        { kind: 'markdown', text: '### Revenue by region\nQ3 against Q2.' },
        {
          kind: 'code',
          count: 3,
          source: 'import pandas as pd\ndf.plot.bar()',
          outputs: [
            { kind: 'text', text: "<Axes: xlabel='Region'>" },
            { kind: 'image', src: 'data:image/png;base64,iVBORw0KGgo=' },
          ],
        },
        { kind: 'code', count: null, source: 'df.head()', outputs: [{ kind: 'html', html: '<table></table>' }] },
        { kind: 'code', count: 5, source: '1/0', outputs: [{ kind: 'text', text: 'ZeroDivisionError: division by zero', error: true }] },
        { kind: 'code', count: 6, source: 'print(1)', outputs: [{ kind: 'text', text: '1\n' }] },
      ],
    });
  });

  it('draws an SVG as an image, stderr as an error, and nothing for an output it does not know', () => {
    expect(outputOf({ output_type: 'display_data', data: { 'image/svg+xml': '<svg/>' } })).toEqual({ kind: 'image', src: 'data:image/svg+xml;charset=utf-8,%3Csvg%2F%3E' });
    expect(outputOf({ output_type: 'stream', name: 'stderr', text: 'warn' })).toEqual({ kind: 'text', text: 'warn', error: true });
    expect(outputOf({ output_type: 'update_display_data' })).toBeNull();
  });

  it('is not one when it is not a notebook', () => {
    expect(() => parseNotebook('{"a":1}')).toThrow();
    expect(() => parseNotebook('not json')).toThrow();
  });
});

describe('highlighting', () => {
  it('picks a grammar by the file’s name, and none for plain text', () => {
    expect(langOf('scripts/q3.py')).toBe('python');
    expect(langOf('src/App.TSX')).toBe('tsx');
    expect(langOf('Dockerfile')).toBe('docker');
    expect(langOf('Makefile')).toBe('make');
    expect(langOf('out/run.log')).toBeNull();
    expect(langNamed('Python')).toBe('python');
    expect(langNamed('R')).toBe('r');
    expect(langNamed(undefined)).toBeNull();
  });

  it('colours code as the cards do, going on from where the block before ended', async () => {
    const tk = (await tokenizer('python'))!;
    const first = tk.tokenize('def margin(r):\n    x = """Doc\nstill doc');
    expect(first.lines[0].find((t) => t.text === 'def')?.color?.toLowerCase()).toBe('#58a6ff');
    expect(first.lines[0].find((t) => t.text === 'margin')?.bold).toBe(true);
    // The next block starts inside the string the first one opened.
    const next = tk.tokenize('more"""\nx = 3', first.state);
    expect(next.lines[0][0].color?.toLowerCase()).toBe('#39c5bb');
    expect(next.lines[1].find((t) => t.text === '3')?.color?.toLowerCase()).toBe('#edbb5b');
    await expect(tokenizer(null)).resolves.toBeNull();
  });
});

describe('a markdown file’s math and diagrams', () => {
  it('reads $…$ in a line and $$…$$ as a block, never money', () => {
    const b = blocks('Area is $\\pi r^2$, costs $5 and $10.\n\n$$\nE = mc^2\n$$\n', lexMath);
    expect(b[0]).toEqual({ kind: 'paragraph', spans: [{ text: 'Area is ' }, { text: '\\pi r^2', math: true }, { text: ', costs $5 and $10.' }] });
    expect(b[1]).toEqual({ kind: 'math', tex: 'E = mc^2' });
  });

  it('keeps a fenced block’s language, so a mermaid one is drawn', () => {
    expect(blocks('```mermaid\ngraph TD; A-->B\n```\n')).toEqual([{ kind: 'code', text: 'graph TD; A-->B', lang: 'mermaid' }]);
  });

  it('is text in a message: only the viewer reads math', () => {
    expect(blocks('$x$')).toEqual([{ kind: 'paragraph', spans: [{ text: '$x$' }] }]);
  });
});

describe('CSV', () => {
  it('reads quoted cells holding commas, doubled quotes and line breaks', () => {
    expect(parseCsv('a,b,c\n"x, y","say ""hi""","one\ntwo"\n')).toEqual([
      ['a', 'b', 'c'],
      ['x, y', 'say "hi"', 'one\ntwo'],
    ]);
  });

  it('reads tabs for a .tsv, CRLF line ends and a byte order mark', () => {
    expect(separatorOf('out/q3.tsv')).toBe('\t');
    expect(separatorOf('out/q3.csv')).toBe(',');
    expect(parseCsv('\ufeffname\tunits\r\nNorth\t1,204\r\n', '\t')).toEqual([
      ['name', 'units'],
      ['North', '1,204'],
    ]);
  });

  it('keeps empty cells, and a quote inside an unquoted cell is a character', () => {
    expect(parseCsv('a,,c\n5" disk,x')).toEqual([
      ['a', '', 'c'],
      ['5" disk', 'x'],
    ]);
    expect(parseCsv('')).toEqual([]);
    expect(parseCsv('"",x')).toEqual([['', 'x']]);
  });

  it('becomes one sheet whose numbers are set as numbers', async () => {
    const t = await csvTable(bytes('Region,Units\nNorth,"1,204"\nSouth,-8.5%\n'), 'q3.csv');
    expect(t.sheets).toHaveLength(1);
    expect(t.sheets[0].rows[1]).toEqual([{ text: 'North' }, { text: '1,204', number: true }]);
    expect(t.sheets[0].rows[2][1]).toEqual({ text: '-8.5%', number: true });
    expect(extent(t.sheets[0])).toEqual({ rows: 3, columns: 2 });
  });

  it('sets as a number only what reads as one', () => {
    expect(textCell('Q3').number).toBeUndefined();
    expect(textCell('2026-11-22').number).toBeUndefined();
    expect(textCell('').number).toBeUndefined();
    expect(textCell('482,000').number).toBe(true);
  });
});

describe('a spreadsheet', () => {
  const sheets = [
    { name: 'By month', rows: [['Region', 'Units'], ['North', 1204], ['South', 871]] },
    { name: 'Summary', rows: [['Total', 2075]] },
  ];

  it('becomes the same table from xlsx and from ods, every sheet by its name', async () => {
    for (const write of [writeXlsx, writeOds]) {
      const file = (await write({ sheets })) as Uint8Array;
      const t = await sheetTable(new Uint8Array(file), 'q3');
      expect(t.sheets.map((s) => s.name)).toEqual(['By month', 'Summary']);
      expect(t.sheets[0].rows.map((r) => r.map((c) => c.text))).toEqual([['Region', 'Units'], ['North', valueCell(1204).text], ['South', '871']]);
      expect(t.sheets[0].rows[1][1].number).toBe(true);
    }
  });
});

describe('a spreadsheet cell', () => {
  it('is drawn as text, numbers and dates set as numbers', () => {
    expect(valueCell(null)).toEqual({ text: '' });
    expect(valueCell(true)).toEqual({ text: 'TRUE' });
    expect(valueCell(1204).number).toBe(true);
    expect(valueCell(new Date('2026-07-01T00:00:00Z'))).toEqual({ text: '2026-07-01', number: true });
    expect(valueCell('North')).toEqual({ text: 'North' });
  });
});

const ref = (path: string, size = 100, kind: Ref['kind'] = 'markdown'): Ref => ({ path, kind, size, modified: 1 });

describe('chips', () => {
  it('under a message are the files it named', () => {
    const items: Item[] = [{ id: '0', kind: 'agent', at: 1, text: 'see `out/report.md`', refs: [ref('out/report.md'), ref('out/report.md')] }];
    expect(rows(items)).toEqual([{ kind: 'agent', id: '0', text: 'see `out/report.md`', at: 1, refs: [ref('out/report.md')] }]);
  });

  it('only an agent’s message carries chips', () => {
    const items: Item[] = [
      { id: '0', kind: 'person', at: 1, text: 'read `notes.md`', refs: [ref('notes.md')] },
      { id: '1', kind: 'step', at: 1, tool: 'Write', arg: 'out/report.md', failed: false, refs: [ref('out/report.md')] },
    ];
    const r = rows(items);
    expect(r[0]).toEqual({ kind: 'person', id: '0', text: 'read `notes.md`', at: 1 });
    expect(r[1]).toEqual({ kind: 'steps', id: '1', steps: [{ tool: 'Write', arg: 'out/report.md', state: 'done' }] });
  });

  it('keep a file’s first place and its newest size', () => {
    expect(union([[ref('a', 1), ref('b', 2)], undefined, [ref('a', 3)]])).toEqual([ref('a', 3), ref('b', 2)]);
  });

  it('say a file by its name and its size', () => {
    expect(nameOf('out/report.md')).toBe('report.md');
    expect(nameOf('/tmp/codex-board/board-pack.pdf')).toBe('board-pack.pdf');
    expect(folderOf('out/report.md')).toBe('out/');
    expect(folderOf('/tmp/codex-board/board-pack.pdf')).toBe('/tmp/codex-board/');
    expect(folderOf('README.md')).toBe('');
    expect([812, 4210, 41_000, 112_400, 1_200_000, 25_000_000].map(sizeWord)).toEqual(['812 B', '4.2 KB', '41 KB', '112 KB', '1.2 MB', '25 MB']);
  });

  it('head the viewer with its folder, size, time and harness; on the desktop, when it changed', () => {
    const r: Ref = { path: 'out/report.md', kind: 'markdown', size: 4600, modified: Date.UTC(2026, 10, 22, 9, 20) };
    expect(about(r, 'codex')).toMatch(/^out\/ · 4\.6 KB · \d\d:\d\d · codex$/);
    expect(about(r, 'codex', true)).toMatch(/^out\/ · 4\.6 KB · changed \d\d:\d\d · codex$/);
    expect(about(ref('README.md', 10), '')).toMatch(/^10 B · \d\d:\d\d$/);
    expect(about({ ...r, modified: 0 }, '')).toBe('out/ · 4.6 KB');
  });

  it('say how far a file has loaded in the unit of its size', () => {
    expect(loadedWords(61_300_000, 184_000_000)).toEqual({ done: '61', total: '184 MB' });
    expect(loadedWords(1_234_000, 8_300_000)).toEqual({ done: '1.2', total: '8.3 MB' });
    expect(loadedWords(300, 812)).toEqual({ done: '300', total: '812 B' });
    expect(loadedWords(900, 400)).toEqual({ done: '400', total: '400 B' });
  });
});

describe('long files', () => {
  it('draw only the lines in sight and a few around them', () => {
    expect(windowOf(0, 400, 100_000, 20, 10)).toEqual({ first: 0, last: 30 });
    expect(windowOf(20_000, 400, 100_000, 20, 10)).toEqual({ first: 990, last: 1030 });
    expect(windowOf(0, 400, 5, 20, 10)).toEqual({ first: 0, last: 5 });
  });

  it('wrap on a phone: each line as many rows as its width needs, a tab to its next stop', () => {
    const lines = ['ab', '\tx', 'a'.repeat(25), ''];
    const widths = widthsOf(lines);
    expect([...widths]).toEqual([2, 5, 25, 0]);
    const rows = rowsOf(widths, 10);
    expect([...rows]).toEqual([0, 1, 2, 5, 6]);
    expect(spanOf(rows, 4, 2 * 20, 20, 20, 0)).toEqual({ first: 2, last: 3, before: 2, total: 6 });
    expect(spanOf(null, 4, 0, 40, 20, 0)).toEqual({ first: 0, last: 2, before: 0, total: 4 });
  });

  it('split into lines, a last line break making no line of its own', () => {
    expect(linesOf('a\r\nb\nc\n')).toEqual(['a', 'b', 'c']);
    expect(linesOf('')).toEqual(['']);
  });
});
